import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { ADDRESSES, TOKENS, type TokenSymbol } from '../constants/contracts'
import { erc20Abi, swapAbi } from '../constants/abis'
import { fmt, parse } from '../utils'

const ALL: TokenSymbol[] = ['RIT', 'USDC', 'DAI']
const SWAP_FEE = 30n // bps

function tokenOptions(exclude: TokenSymbol) {
  return ALL.filter(s => s !== exclude)
}

function applyFee(raw: bigint): bigint {
  return (raw * (10000n - SWAP_FEE)) / 10000n
}

export function Swap() {
  const { address, isConnected } = useAccount()

  const [tokenIn,  setTokenIn]  = useState<TokenSymbol>('RIT')
  const [tokenOut, setTokenOut] = useState<TokenSymbol>('USDC')
  const [amtIn,    setAmtIn]    = useState('')

  const inInfo  = TOKENS[tokenIn]
  const outInfo = TOKENS[tokenOut]

  const amtInRaw  = parse(amtIn, inInfo.decimals)
  const needsRead = amtInRaw > 0n && !!address

  // Preview
  const { data: rawOut } = useReadContract({
    address:      ADDRESSES.swap,
    abi:          swapAbi,
    functionName: 'getAmountOut',
    args:         [inInfo.address, outInfo.address, amtInRaw],
    query:        { enabled: needsRead },
  })
  const previewOut = rawOut !== undefined ? applyFee(rawOut) : undefined

  // Pool reserves
  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address:      ADDRESSES.swap,
    abi:          swapAbi,
    functionName: 'reserves',
  })

  // Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address:      inInfo.address,
    abi:          erc20Abi,
    functionName: 'allowance',
    args:         [address!, ADDRESSES.swap],
    query:        { enabled: !!address },
  })

  // Balances
  const { data: balIn, refetch: refetchBal } = useReadContract({
    address:      inInfo.address,
    abi:          erc20Abi,
    functionName: 'balanceOf',
    args:         [address!],
    query:        { enabled: !!address },
  })

  const needsApproval = allowance !== undefined && amtInRaw > 0n && allowance < amtInRaw

  // Write
  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance()
      refetchReserves()
      refetchBal()
      setAmtIn('')
      reset()
    }
  }, [isSuccess, refetchAllowance, refetchReserves, refetchBal, reset])

  function flip() {
    const newOut = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(newOut)
    setAmtIn('')
  }

  function approve() {
    writeContract({
      address:      inInfo.address,
      abi:          erc20Abi,
      functionName: 'approve',
      args:         [ADDRESSES.swap, amtInRaw * 2n],
    })
  }

  function doSwap() {
    if (!previewOut) return
    const minOut = (previewOut * 99n) / 100n
    writeContract({
      address:      ADDRESSES.swap,
      abi:          swapAbi,
      functionName: 'swap',
      args:         [inInfo.address, outInfo.address, amtInRaw, minOut],
    })
  }

  function faucet() {
    writeContract({
      address:      inInfo.address,
      abi:          erc20Abi,
      functionName: 'faucet',
      args:         [],
    })
  }

  const ritIdx  = 0
  const usdcIdx = 1
  const daiIdx  = 2
  const reserveMap: Record<string, bigint | undefined> = {
    [ADDRESSES.rit]:  reserves?.[ritIdx],
    [ADDRESSES.usdc]: reserves?.[usdcIdx],
    [ADDRESSES.dai]:  reserves?.[daiIdx],
  }

  const busy = isPending || confirming

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">Swap</h1>
      <p className="text-gray-500 text-sm mb-8">
        Fixed-rate exchange. 1 RIT = 10 USDC = 10 DAI. Fee: 0.3%.
      </p>

      {/* Pool reserves */}
      {reserves && (
        <div className="flex gap-3 mb-6">
          {ALL.map(sym => {
            const t   = TOKENS[sym]
            const bal = reserveMap[t.address]
            return (
              <div key={sym} className="flex-1 card p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">{sym} pool</p>
                <p className="text-sm font-mono font-semibold">
                  {bal !== undefined ? fmt(bal, t.decimals, 0) : '--'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div className="card p-6 space-y-3">
        {/* Token In */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>You pay</span>
            {balIn !== undefined && (
              <button
                className="hover:text-white transition-colors"
                onClick={() => setAmtIn(fmt(balIn, inInfo.decimals, 6))}
              >
                Balance: {fmt(balIn, inInfo.decimals)}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              className="input-field w-28 flex-shrink-0"
              value={tokenIn}
              onChange={e => {
                const sym = e.target.value as TokenSymbol
                setTokenIn(sym)
                if (sym === tokenOut) setTokenOut(tokenOptions(sym)[0])
                setAmtIn('')
              }}
            >
              {ALL.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              className="input-field flex-1"
              placeholder="0.00"
              value={amtIn}
              onChange={e => setAmtIn(e.target.value)}
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            className="w-9 h-9 rounded-xl border border-rite-border text-gray-400 hover:border-rite-orange hover:text-rite-orange transition-all text-lg flex items-center justify-center"
            onClick={flip}
          >
            &#8645;
          </button>
        </div>

        {/* Token Out */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>You receive</span>
            <span className="text-gray-600">After 0.3% fee</span>
          </div>
          <div className="flex gap-2">
            <select
              className="input-field w-28 flex-shrink-0"
              value={tokenOut}
              onChange={e => {
                const sym = e.target.value as TokenSymbol
                setTokenOut(sym)
                if (sym === tokenIn) setTokenIn(tokenOptions(sym)[0])
              }}
            >
              {ALL.filter(s => s !== tokenIn).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="input-field flex-1 text-rite-green font-mono">
              {previewOut !== undefined ? fmt(previewOut, outInfo.decimals) : '—'}
            </div>
          </div>
        </div>

        {/* CTA */}
        {!isConnected ? (
          <p className="text-center text-sm text-gray-500 pt-1">Connect your wallet to swap.</p>
        ) : needsApproval ? (
          <button className="btn-primary w-full mt-1" disabled={busy || amtInRaw === 0n} onClick={approve}>
            {busy ? 'Confirming...' : `Approve ${tokenIn}`}
          </button>
        ) : (
          <button
            className="btn-primary w-full mt-1"
            disabled={busy || amtInRaw === 0n || previewOut === undefined}
            onClick={doSwap}
          >
            {busy ? 'Confirming...' : 'Swap'}
          </button>
        )}

        {isSuccess && (
          <p className="text-center text-rite-green text-sm">Swap confirmed!</p>
        )}
      </div>

      {/* Faucet */}
      {isConnected && (
        <div className="mt-6 card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Need test tokens?</p>
            <p className="text-xs text-gray-500 mt-0.5">Get {tokenIn} from the faucet (1-day cooldown)</p>
          </div>
          <button
            className="btn-outline text-sm"
            disabled={busy}
            onClick={faucet}
          >
            Get {tokenIn}
          </button>
        </div>
      )}

      {/* Rate reference */}
      <div className="mt-6 text-xs text-gray-600 space-y-1">
        <p>Reference rates (before fee)</p>
        <p className="font-mono">1 RIT = 10 USDC = 10 DAI</p>
        <p className="font-mono">1 USDC = 1 DAI</p>
      </div>
    </div>
  )
}
