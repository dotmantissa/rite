import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { ritualTestnet } from './constants/chains'

export const wagmiConfig = createConfig({
  chains: [ritualTestnet],
  connectors: [injected()],
  transports: {
    [ritualTestnet.id]: http('https://rpc.ritualfoundation.org'),
  },
})
