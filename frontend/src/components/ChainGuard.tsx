import { useAccount, useSwitchChain } from 'wagmi'
import { ritualTestnet } from '../constants/chains'

interface Props {
  children: React.ReactNode
}

export function ChainGuard({ children }: Props) {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const onWrongChain = isConnected && chainId !== ritualTestnet.id

  return (
    <>
      {onWrongChain && (
        <div className="flex items-center justify-center gap-4 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-sm">
          <span className="text-red-400">
            Connect to Ritual Testnet (Chain ID 1979) to use Rite.
          </span>
          <button
            className="btn bg-red-500 text-white hover:bg-red-400 py-1.5 text-xs"
            disabled={isPending}
            onClick={() => switchChain({ chainId: ritualTestnet.id })}
          >
            {isPending ? 'Switching...' : 'Switch Network'}
          </button>
        </div>
      )}
      {children}
    </>
  )
}
