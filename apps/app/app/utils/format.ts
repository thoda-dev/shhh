const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

// Binary units (1024), so the numbers line up with what `df` reports on the volume.
export function formatBytes(bytes: number | null) {
  if (bytes === null) return ''
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`
}
