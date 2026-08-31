import { url } from '@nuxt/test-utils/e2e'

let allocated = 0

/** Better Auth caps `/sign-in*` and `/sign-up*` at 3 per 10s per IP, read from a single-value `x-forwarded-for`. */
function nextClientIp() {
  allocated += 1
  return `10.0.${Math.floor(allocated / 254) % 254}.${(allocated % 254) + 1}`
}

/** A browser-shaped caller: it keeps the cookies it is handed and sends them back. */
export class ApiClient {
  readonly ip = nextClientIp()
  private readonly cookies = new Map<string, string>()

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('x-forwarded-for', this.ip)
    if (this.cookies.size > 0) {
      headers.set('cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '))
    }
    if (init.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    const response = await fetch(url(path), { ...init, headers, redirect: 'manual' })

    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const separator = pair?.indexOf('=') ?? -1
      if (!pair || separator < 1) continue
      const name = pair.slice(0, separator)
      const value = pair.slice(separator + 1)
      // An expired cookie is how Better Auth signs a caller out.
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }

    return response
  }

  get(path: string) {
    return this.request(path)
  }

  post(path: string, body?: unknown) {
    return this.request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  }

  put(path: string, body?: unknown) {
    return this.request(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) })
  }

  patch(path: string, body?: unknown) {
    return this.request(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })
  }

  delete(path: string, body?: unknown) {
    return this.request(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) })
  }
}

export async function json<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}
