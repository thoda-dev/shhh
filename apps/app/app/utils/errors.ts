/**
 * Pulls the two message fields a failed `$fetch` may carry out of an unknown thrown value.
 * Nitro's `createError` sets `data.statusMessage`, Better Auth sets `data.message`, a network failure sets neither.
 * Call sites keep their own precedence between the two, so the message never shifts if a future version populates both.
 * Exists so those call sites can catch `unknown` instead of `any`.
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
