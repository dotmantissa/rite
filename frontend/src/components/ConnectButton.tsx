import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { ritualTestnet } from '../constants/chains'
import { shortAddr } from '../utils'

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending }  = useConnect()
  const { disconnect }                       = useDisconnect()
  const { switchChain }                      = useSwitchChain()

  const onWrongChain = isConnected && chainId !== ritualTestnet.id

  if (!isConnected) {
    return (
      <button
        className="btn-primary text-sm"
        disabled={isPending}
        onClick={() => connect({ connector: connectors[0] })}
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
    )
  }

  if (onWrongChain) {
    return (
      <button
        className="btn bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-sm"
        onClick={() => switchChain({ chainId: ritualTestnet.id })}
      >
        Switch to Ritual
      </button>
    )
  }

  return (
    <button
      className="btn-outline text-sm font-mono"
      onClick={() => disconnect()}
    >
      {shortAddr(address!)}
    </button>
  )
}
