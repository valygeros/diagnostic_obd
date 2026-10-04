/**
 * "Supported PIDs" bitmaps (service 01 PIDs 00, 20, 40… and service 09 PID 00).
 * 4 bytes, MSB first: bit 31 = PID base+1 … bit 0 = PID base+32 (which says whether the next
 * bitmap exists).
 */

export function decodeSupportedBitmap(base: number, bytes: readonly number[]): number[] {
  const pids: number[] = []
  for (let i = 0; i < 4; i++) {
    const byte = bytes[i] ?? 0
    for (let bit = 0; bit < 8; bit++) {
      if (byte & (0x80 >> bit)) pids.push(base + i * 8 + bit + 1)
    }
  }
  return pids
}

export function encodeSupportedBitmap(base: number, pids: Iterable<number>): number[] {
  const bytes = [0, 0, 0, 0]
  for (const pid of pids) {
    const offset = pid - base - 1
    if (offset < 0 || offset > 31) continue
    const i = offset >> 3
    bytes[i] = (bytes[i] ?? 0) | (0x80 >> (offset & 7))
  }
  return bytes
}

export const BITMAP_PIDS = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0] as const

export function isBitmapPid(pid: number): boolean {
  return pid % 0x20 === 0
}
