import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  base64UrlToBytes,
  bytesToBase64,
  bytesToBase64Url,
  decryptBytes,
  deriveAesKey,
  encryptBytes,
  generateFragmentKey
} from '../app/utils/crypto'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe('fragment key', () => {
  it('is a 256-bit key, which is what AES-256 needs', () => {
    expect(generateFragmentKey()).toHaveLength(32)
  })

  it('never repeats', () => {
    const keys = new Set(Array.from({ length: 50 }, () => bytesToBase64(generateFragmentKey())))
    expect(keys.size).toBe(50)
  })
})

describe('encoding', () => {
  it('round-trips arbitrary bytes through base64', () => {
    const bytes = generateFragmentKey()
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('round-trips through base64url', () => {
    const bytes = generateFragmentKey()
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
  })

  it('produces base64url that is safe in a URL fragment', () => {
    // The whole scheme depends on this surviving the address bar untouched: `+`, `/` and `=` would each be mangled or ambiguous there.
    for (let i = 0; i < 50; i++) {
      expect(bytesToBase64Url(generateFragmentKey())).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('handles every possible byte value', () => {
    const all = new Uint8Array(256).map((_, i) => i) as Uint8Array<ArrayBuffer>
    expect(base64ToBytes(bytesToBase64(all))).toEqual(all)
  })
})

describe('encryption without a password', () => {
  it('round-trips a message', async () => {
    const key = await deriveAesKey(generateFragmentKey())
    const { ciphertext, iv } = await encryptBytes(key, encoder.encode('hello'))
    expect(decoder.decode(await decryptBytes(key, ciphertext, iv))).toBe('hello')
  })

  it('never reuses an IV, even for identical plaintext under the same key', async () => {
    // Reusing an IV under the same key breaks GCM catastrophically, so this is not a style point.
    const key = await deriveAesKey(generateFragmentKey())
    const results = await Promise.all(
      Array.from({ length: 20 }, () => encryptBytes(key, encoder.encode('same')))
    )
    const ivs = new Set(results.map(r => bytesToBase64(r.iv)))
    const ciphertexts = new Set(results.map(r => bytesToBase64(r.ciphertext)))
    expect(ivs.size).toBe(20)
    expect(ciphertexts.size).toBe(20)
  })

  it('cannot be decrypted with a different key', async () => {
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(generateFragmentKey()), encoder.encode('secret'))
    const otherKey = await deriveAesKey(generateFragmentKey())
    await expect(decryptBytes(otherKey, ciphertext, iv)).rejects.toThrow()
  })

  it('rejects tampered ciphertext', async () => {
    // GCM authenticates as well as encrypts: a flipped bit must fail loudly rather than decrypt to garbage.
    const key = await deriveAesKey(generateFragmentKey())
    const { ciphertext, iv } = await encryptBytes(key, encoder.encode('secret'))
    ciphertext[0] ^= 0xff
    await expect(decryptBytes(key, ciphertext, iv)).rejects.toThrow()
  })
})

describe('encryption with a password', () => {
  it('round-trips when the same fragment key and password are supplied', async () => {
    const fragmentKey = generateFragmentKey()
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(fragmentKey, 'correct horse'), encoder.encode('hello'))
    const again = await deriveAesKey(fragmentKey, 'correct horse')
    expect(decoder.decode(await decryptBytes(again, ciphertext, iv))).toBe('hello')
  })

  it('fails on a wrong password', async () => {
    const fragmentKey = generateFragmentKey()
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(fragmentKey, 'correct horse'), encoder.encode('hello'))
    const wrong = await deriveAesKey(fragmentKey, 'wrong horse')
    await expect(decryptBytes(wrong, ciphertext, iv)).rejects.toThrow()
  })

  it('fails when the password is right but the fragment key is not', async () => {
    // Both halves are required: the password alone is not enough to reach the plaintext.
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(generateFragmentKey(), 'shared'), encoder.encode('hello'))
    const otherLink = await deriveAesKey(generateFragmentKey(), 'shared')
    await expect(decryptBytes(otherLink, ciphertext, iv)).rejects.toThrow()
  })

  it('derives a different key than the passwordless path for the same fragment key', async () => {
    const fragmentKey = generateFragmentKey()
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(fragmentKey, 'pw'), encoder.encode('hello'))
    const noPassword = await deriveAesKey(fragmentKey)
    await expect(decryptBytes(noPassword, ciphertext, iv)).rejects.toThrow()
  })

  it('uses the fragment key as salt, so the same password yields different keys per paste', async () => {
    const a = generateFragmentKey()
    const b = generateFragmentKey()
    const { ciphertext, iv } = await encryptBytes(await deriveAesKey(a, 'same password'), encoder.encode('hello'))
    await expect(decryptBytes(await deriveAesKey(b, 'same password'), ciphertext, iv)).rejects.toThrow()
    expect(decoder.decode(await decryptBytes(await deriveAesKey(a, 'same password'), ciphertext, iv))).toBe('hello')
  })
})

describe('realistic payloads', () => {
  it('round-trips unicode text', async () => {
    const key = await deriveAesKey(generateFragmentKey())
    const text = 'мой секрет · 秘密 · 🤫 · accentué'
    const { ciphertext, iv } = await encryptBytes(key, encoder.encode(text))
    expect(decoder.decode(await decryptBytes(key, ciphertext, iv))).toBe(text)
  })

  it('round-trips binary file content', async () => {
    const key = await deriveAesKey(generateFragmentKey())
    const file = crypto.getRandomValues(new Uint8Array(64 * 1024)) as Uint8Array<ArrayBuffer>
    const { ciphertext, iv } = await encryptBytes(key, file)
    expect(await decryptBytes(key, ciphertext, iv)).toEqual(file)
  })

  it('encrypts a filename under a separate IV from its content', async () => {
    // Content and filename share the key but must never share an IV.
    const key = await deriveAesKey(generateFragmentKey())
    const content = await encryptBytes(key, encoder.encode('file body'))
    const name = await encryptBytes(key, encoder.encode('secret.txt'))
    expect(bytesToBase64(content.iv)).not.toBe(bytesToBase64(name.iv))
    expect(decoder.decode(await decryptBytes(key, name.ciphertext, name.iv))).toBe('secret.txt')
  })
})
