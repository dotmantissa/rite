export function fmt(raw: bigint, decimals: number, dp = 4): string {
  if (raw === 0n) return '0'
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac  = raw % divisor
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, dp).replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}

export function parse(value: string, decimals: number): bigint {
  if (!value || value === '.') return 0n
  const [whole, frac = ''] = value.split('.')
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0')
  try {
    return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded)
  } catch {
    return 0n
  }
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function unlockLabel(endTime: bigint): string {
  const ms   = Number(endTime) * 1000
  const now  = Date.now()
  if (ms <= now) return 'Unlocked'
  const diff = ms - now
  const h    = Math.floor(diff / 3_600_000)
  const m    = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`
}

export function fmtDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleString()
}
