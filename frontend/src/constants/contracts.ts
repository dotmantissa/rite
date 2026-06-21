export const ADDRESSES = {
  rit:     '0xB3c243DE2B5EF41ccd2108D6d09B0e26a5EE9855' as const,
  usdc:    '0x980c6AaC383bA7b2BAD37B702295120b2146B1eA' as const,
  dai:     '0xD171012b19c02B1dEC40f98C1d4B09Cc4e78dB32' as const,
  swap:    '0x6094e1d7155A2cc9c26c74b35a9a06AcCE7d3963' as const,
  staking: '0x8978415Cd4Fa9668Dd4B8747c2De041841d4f87E' as const,
  lending: '0x0F5F9878f96808f208F86A176030178426930bDB' as const,
} as const

export type TokenSymbol = 'RIT' | 'USDC' | 'DAI'

export const TOKENS: Record<TokenSymbol, { address: `0x${string}`; decimals: number; symbol: TokenSymbol }> = {
  RIT:  { address: ADDRESSES.rit,  decimals: 18, symbol: 'RIT'  },
  USDC: { address: ADDRESSES.usdc, decimals: 6,  symbol: 'USDC' },
  DAI:  { address: ADDRESSES.dai,  decimals: 18, symbol: 'DAI'  },
}

export const TOKEN_BY_ADDRESS: Record<string, TokenSymbol> = {
  [ADDRESSES.rit.toLowerCase()]:  'RIT',
  [ADDRESSES.usdc.toLowerCase()]: 'USDC',
  [ADDRESSES.dai.toLowerCase()]:  'DAI',
}

export const STAKE_DURATIONS: { hours: number; label: string }[] = [
  { hours: 12,  label: '12 h'  },
  { hours: 24,  label: '24 h'  },
  { hours: 48,  label: '48 h'  },
  { hours: 72,  label: '72 h'  },
  { hours: 168, label: '1 week' },
]
