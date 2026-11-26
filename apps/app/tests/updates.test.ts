import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isNewerVersion } from '../server/utils/updates'

const HOUR = 60 * 60 * 1000

function release(tag: string, url = `https://github.com/thoda-dev/shhh/releases/tag/${tag}`) {
  return new Response(JSON.stringify({ tag_name: tag, html_url: url }), { status: 200 })
}

// The cache lives in the module, so each test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('../server/utils/updates')
}

describe('isNewerVersion', () => {
  it('compares each part as a number, not as text', () => {
    expect(isNewerVersion('1.10.0', '1.9.3')).toBe(true)
    expect(isNewerVersion('1.3.10', '1.3.9')).toBe(true)
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
  })

  it('is false for the same or an older version', () => {
    expect(isNewerVersion('1.3.2', '1.3.2')).toBe(false)
    expect(isNewerVersion('1.3.1', '1.3.2')).toBe(false)
    expect(isNewerVersion('0.9.0', '1.0.0')).toBe(false)
  })

  it('accepts a leading v on either side', () => {
    expect(isNewerVersion('v1.4.0', '1.3.2')).toBe(true)
    expect(isNewerVersion('1.4.0', 'v1.3.2')).toBe(true)
  })

  it('never offers a prerelease', () => {
    expect(isNewerVersion('1.4.0-beta.1', '1.3.2')).toBe(false)
    expect(isNewerVersion('1.4.0-rc.2', '1.4.0-rc.1')).toBe(false)
  })

  it('offers the stable release to an instance running one of its prereleases', () => {
    expect(isNewerVersion('1.4.0', '1.4.0-rc.1')).toBe(true)
    expect(isNewerVersion('v1.4.0', 'v1.4.0-beta.2')).toBe(true)
    expect(isNewerVersion('1.4.1', '1.4.0-rc.1')).toBe(true)
  })

  it('does not offer an older stable release to a prerelease', () => {
    expect(isNewerVersion('1.3.2', '1.4.0-rc.1')).toBe(false)
    expect(isNewerVersion('1.4.0', '1.5.0-rc.1')).toBe(false)
  })

  it('ignores build metadata', () => {
    expect(isNewerVersion('1.4.0', '1.4.0+sha.5114f85')).toBe(false)
    expect(isNewerVersion('1.4.1', '1.4.0+sha.5114f85')).toBe(true)
    expect(isNewerVersion('1.4.0', '1.4.0-rc.1+sha.5114f85')).toBe(true)
  })

  it('never announces something it cannot read', () => {
    expect(isNewerVersion('latest', '1.3.2')).toBe(false)
    expect(isNewerVersion('1.4.0', 'dev')).toBe(false)
    expect(isNewerVersion('1.4', '1.3.2')).toBe(false)
  })
})

describe('getUpdateStatus', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('reports a newer release with its notes', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.4.0'))

    const status = await getUpdateStatus('1.3.2')

    expect(status).toMatchObject({
      current: '1.3.2',
      latest: { version: '1.4.0', url: 'https://github.com/thoda-dev/shhh/releases/tag/v1.4.0' },
      updateAvailable: true
    })
  })

  it('reports the stable release to an instance on its release candidate', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.4.0'))

    expect((await getUpdateStatus('1.4.0-rc.1')).updateAvailable).toBe(true)
  })

  it('reports nothing to do when the instance runs the latest release', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.3.2'))

    expect((await getUpdateStatus('1.3.2')).updateAvailable).toBe(false)
  })

  it('asks GitHub once for concurrent callers and for the next hours', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockImplementation(async () => release('v1.4.0'))

    await Promise.all([getUpdateStatus('1.3.2'), getUpdateStatus('1.3.2'), getUpdateStatus('1.3.2')])
    vi.advanceTimersByTime(5 * HOUR)
    await getUpdateStatus('1.3.2')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2 * HOUR)
    await getUpdateStatus('1.3.2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lets a forced check through, but not twice in the same minute', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockImplementation(async () => release('v1.4.0'))

    await getUpdateStatus('1.3.2')
    await getUpdateStatus('1.3.2', { force: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(61 * 1000)
    await getUpdateStatus('1.3.2', { force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('turns a failure into no release, and retries it sooner', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    expect(await getUpdateStatus('1.3.2')).toMatchObject({ latest: null, updateAvailable: false })

    fetchMock.mockResolvedValueOnce(release('v1.4.0'))
    vi.advanceTimersByTime(30 * 60 * 1000)
    await getUpdateStatus('1.3.2')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(31 * 60 * 1000)
    expect((await getUpdateStatus('1.3.2')).updateAvailable).toBe(true)
  })

  it('says when asking again is worth it: six hours after a success, one after a failure', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.4.0'))
    const success = await getUpdateStatus('1.3.2')
    expect(Date.parse(success.nextCheckAt) - Date.parse(success.checkedAt)).toBe(6 * HOUR)

    vi.advanceTimersByTime(6 * HOUR)
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const failure = await getUpdateStatus('1.3.2')
    expect(Date.parse(failure.nextCheckAt) - Date.parse(failure.checkedAt)).toBe(HOUR)
  })

  it('treats an error status as a failure', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 403 }))

    expect((await getUpdateStatus('1.3.2')).latest).toBeNull()
  })

  it('refuses a prerelease, should GitHub ever return one as latest', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.5.0-rc.1'))

    expect((await getUpdateStatus('1.4.0')).latest).toBeNull()
  })

  it('refuses a release link pointing anywhere but this repository', async () => {
    const { getUpdateStatus } = await load()
    fetchMock.mockResolvedValueOnce(release('v1.4.0', 'https://evil.example/releases/v1.4.0'))

    expect((await getUpdateStatus('1.3.2')).latest).toBeNull()
  })
})
