/**
 * Pulls the two message fields a failed `$fetch` may carry out of an unknown thrown value.
 *
 * Nitro's `createError` puts the text on `data.statusMessage`, Better Auth's endpoints put it on
 * `data.message`, and a network failure or a non-JSON response carries neither. Call sites keep
 * their own precedence between the two — whichever field their endpoint actually sets comes first —
 * rather than having one imposed here, so the message shown never shifts if a future version
 * happens to populate the other field as well.
 *
 * Exists so those call sites can catch `unknown` instead of `any`: `any` would silently allow any
 * property access on a value that is frequently not the shape we expect.
 */
export function fetchErrorMessages(error: unknown): { statusMessage?: string, message?: string } {
  const data = (error as { data?: unknown } | null | undefined)?.data
  if (!data || typeof data !== 'object') return {}

  const { statusMessage, message } = data as Record<string, unknown>
  return {
    statusMessage: typeof statusMessage === 'string' ? statusMessage : undefined,
    message: typeof message === 'string' ? message : undefined
  }
}
