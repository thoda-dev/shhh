import { argon2id } from 'hash-wasm'

// TypeScript 5.7+ made `Uint8Array` generic over its backing buffer, and WebCrypto's `BufferSource`
// only accepts `ArrayBuffer`-backed views (a `SharedArrayBuffer` can't be passed to it). A bare
// `Uint8Array` widens to `ArrayBufferLike` and no longer matches. Pinning the buffer type once here
// keeps every signature below assignable without scattering `as BufferSource` casts around.
export type Bytes = Uint8Array<ArrayBuffer>

// OWASP 2023 minimum recommendation for Argon2id used interactively.
const ARGON2_MEMORY_KIB = 19_456
const ARGON2_ITERATIONS = 2
const ARGON2_PARALLELISM = 1
const AES_KEY_LENGTH_BYTES = 32
const GCM_IV_LENGTH_BYTES = 12

export function generateFragmentKey(): Bytes {
  return crypto.getRandomValues(new Uint8Array(AES_KEY_LENGTH_BYTES))
}

export function bytesToBase64(bytes: Bytes): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBytes(base64: string): Bytes {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64Url(bytes: Bytes): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(base64url: string): Bytes {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return base64ToBytes(base64)
}

// Without a password, the fragment key IS the AES key — it's already a random 256-bit secret,
// deriving further would add cost with no security benefit. With a password, the fragment key
// doubles as the Argon2id salt: it's unique per paste and already high-entropy, so it also
// prevents rainbow-table reuse across pastes that happen to share the same password.
export async function deriveAesKey(fragmentKeyBytes: Bytes, password?: string): Promise<CryptoKey> {
  const keyBytes = password
    ? await argon2id({
        password,
        salt: fragmentKeyBytes,
        memorySize: ARGON2_MEMORY_KIB,
        iterations: ARGON2_ITERATIONS,
        parallelism: ARGON2_PARALLELISM,
        hashLength: AES_KEY_LENGTH_BYTES,
        outputType: 'binary'
      })
    : fragmentKeyBytes

  return crypto.subtle.importKey('raw', keyBytes as Bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptBytes(key: CryptoKey, plaintext: Bytes): Promise<{ ciphertext: Bytes, iv: Bytes }> {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH_BYTES))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { ciphertext: new Uint8Array(ciphertext), iv }
}

export async function decryptBytes(key: CryptoKey, ciphertext: Bytes, iv: Bytes): Promise<Bytes> {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Uint8Array(plaintext)
}
