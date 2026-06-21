import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import {
  ADDRESSES,
  TOKENS,
  TOKEN_BY_ADDRESS,
  STAKE_DURATIONS,
  type TokenSymbol,
} from '../constants/contracts'
import { erc20Abi, stakingAbi } from '../constants/abis'
import { fmt, parse, unlockLabel, fmtDate } from '../utils'

const RATE_LABELS: Record<number, string> = {
  12:  '5%',
  24:  '10%',
  48:  '15%',
  72:  '20%',
  168: '25%',
}

const RIT_RATE_LABELS: Record<number, string> = {
  12:  '50%',
  24:  '100%',
  48:  '150%',
  72:  '200%',
  168: '250%',
}

interface StakeRow {
  id:     bigint
  staker: `0x${string}`
  token:  `0x${string}`
  amount: bigint
  startTime: bigint
  endTime:   bigint
  reward:    bigint
  isRIT:     boolean
  withdrawn: boolean
}

function StakeCard({ stake, onUnstake, busy }: { stake: StakeRow; onUnstake: () => void; busy: boolean }) {
  const tokenSym   = TOKEN_BY_ADDRESS[stake.token.toLowerCase()] ?? '???'
  const tokenInfo  = TOKENS[tokenSym as TokenSymbol]
  const rewardSym  = stake.isRIT ? 'USDC' : tokenSym
  const rewardInfo = TOKENS[rewardSym as TokenSymbol]
  const ready      = Date.now() / 1000 >= Number(stake.endTime)

  return (
    <div className={`card p-5 ${stake.withdrawn ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{fmt(stake.amount, tokenInfo?.decimals ?? 18)} {tokenSym}</span>
            <span className={`tag text-xs ${ready && !stake.withdrawn ? 'bg-rite-green/10 text-rite-green' : 'bg-rite-muted text-gray-400'}`}>
              {stake.withdrawn ? 'Withdrawn' : ready ? 'Ready' : 'Locked'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Reward: <span className="text-white">{fmt(stake.reward, rewardInfo?.decimals ?? 6)} {rewardSym}</span>
          </p>
          <p className="text-xs text-gray-600">
            {stake.withdrawn ? `Ended ${fmtDate(stake.endTime)}` : unlockLabel(stake.endTime)}
          </p>
        </div>
        {!stake.withdrawn && (
          <button
            className={ready ? 'btn-primary text-sm' : 'btn-outline text-sm opacity-50 cursor-not-allowed'}
            disabled={!ready || busy}
            onClick={onUnstake}
          >
            Unstake
          </button>
        )}
      </div>
    </div>
  )
}

export function Stake() {
  const { address, isConnected } = useAccount()

  const [token,    setToken]    = useState<TokenSymbol>('RIT')
  const [amount,   setAmount]   = useState('')
  const [duration, setDuration] = useState(24)

  const tInfo    = TOKENS[token]
  const amtRaw   = parse(amount, tInfo.decimals)
  const isRIT    = token === 'RIT'
  const canQuery = amtRaw > 0n && !!address

  // Preview reward
  const { data: preview } = useReadContract({
    address:      ADDRESSES.staking,
    abi:          stakingAbi,
    functionName: 'previewReward',
    args:         [tInfo.address, amtRaw, BigInt(duration)],
    query:        { enabled: canQuery },
  })

  const rewardAmt = preview?.[0]
  const rewardTok = preview?.[1]
  const rewardSym = rewardTok ? (TOKEN_BY_ADDRESS[rewardTok.toLowerCase()] ?? '???') : (isRIT ? 'USDC' : token)
  const rewardInfo = TOKENS[rewardSym as TokenSymbol]

  // Balance
  const { data: balance } = useReadContract({
    address:      tInfo.address,
    abi:          erc20Abi,
    functionName: 'balanceOf',
    args:         [address!],
    query:        { enabled: !!address },
  })

  // Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address:      tInfo.address,
    abi:          erc20Abi,
    functionName: 'allowance',
    args:         [address!, ADDRESSES.staking],
    query:        { enabled: !!address },
  })

  // User stakes
  const { data: stakeIds, refetch: refetchIds } = useReadContract({
    address:      ADDRESSES.staking,
    abi:          stakingAbi,
    functionName: 'getUserStakes',
    args:         [address!],
    query:        { enabled: !!address },
  })

  const stakeContracts = (stakeIds ?? []).map(id => ({
    address:      ADDRESSES.staking,
    abi:          stakingAbi,
    functionName: 'stakes' as const,
    args:         [id] as const,
  }))

  const { data: stakeData, refetch: refetchStakes } = useReadContracts({
    contracts: stakeContracts,
    query: { enabled: (stakeIds?.length ?? 0) > 0 },
  })

  const stakes: StakeRow[] = (stakeData ?? [])
    .map((r, i) => {
      if (r.status !== 'success' || !Array.isArray(r.result)) return null
      const [staker, tok, amt, startTime, endTime, reward, isRIT, withdrawn] = r.result as [
        `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, boolean, boolean
      ]
      return { id: stakeIds![i], staker, token: tok, amount: amt, startTime, endTime, reward, isRIT, withdrawn }
    })
    .filter(Boolean) as StakeRow[]

  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance()
      refetchIds()
      refetchStakes()
      setAmount('')
      reset()
    }
  }, [isSuccess, refetchAllowance, refetchIds, refetchStakes, reset])

  const needsApproval = allowance !== undefined && amtRaw > 0n && allowance < amtRaw
  const busy = isPending || confirming

  function approve() {
    writeContract({
      address:      tInfo.address,
      abi:          erc20Abi,
      functionName: 'approve',
      args:         [ADDRESSES.staking, amtRaw * 2n],
    })
  }

  function doStake() {
    writeContract({
      address:      ADDRESSES.staking,
      abi:          stakingAbi,
      functionName: 'stake',
      args:         [tInfo.address, amtRaw, BigInt(duration)],
    })
  }

  function doUnstake(id: bigint) {
    writeContract({
      address:      ADDRESSES.staking,
      abi:          stakingAbi,
      functionName: 'unstake',
      args:         [id],
    })
  }

  const rateLabel = isRIT ? RIT_RATE_LABELS[duration] : RATE_LABELS[duration]

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">Stake</h1>
      <p className="text-gray-500 text-sm mb-8">
        Lock tokens for a fixed term and collect a guaranteed reward at maturity.
      </p>

      <div className="card p-6 space-y-5">
        {/* Token selector */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Token to stake</label>
          <div className="flex gap-2">
            {(['RIT', 'USDC', 'DAI'] as TokenSymbol[]).map(sym => (
              <button
                key={sym}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  token === sym
                    ? 'border-rite-orange text-rite-orange bg-rite-orange/10'
                    : 'border-rite-border text-gray-400 hover:border-rite-muted'
                }`}
                onClick={() => { setToken(sym); setAmount('') }}
              >
                {sym}
              </button>
            ))}
          </div>
          {isRIT && (
            <p className="text-xs text-rite-orange mt-2">
              RIT staking rewards are paid in USDC at {RIT_RATE_LABELS[duration]} APR.
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <label>Amount</label>
            {balance !== undefined && (
              <button
                className="hover:text-white transition-colors"
                onClick={() => setAmount(fmt(balance, tInfo.decimals, 6))}
              >
                Balance: {fmt(balance, tInfo.decimals)}
              </button>
            )}
          </div>
          <input
            type="number"
            className="input-field"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Lock duration</label>
          <div className="grid grid-cols-5 gap-1.5">
            {STAKE_DURATIONS.map(({ hours, label }) => (
              <button
                key={hours}
                className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                  duration === hours
                    ? 'border-rite-orange text-rite-orange bg-rite-orange/10'
                    : 'border-rite-border text-gray-400 hover:border-rite-muted'
                }`}
                onClick={() => setDuration(hours)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {amtRaw > 0n && (
          <div className="bg-rite-bg rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Rate</span>
              <span className="text-white">{rateLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">You earn</span>
              <span className="text-rite-green font-mono">
                {rewardAmt !== undefined
                  ? `${fmt(rewardAmt, rewardInfo?.decimals ?? 6)} ${rewardSym}`
                  : '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unlocks after</span>
              <span className="text-white">{duration} hours</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <p className="text-center text-sm text-gray-500">Connect your wallet to stake.</p>
        ) : needsApproval ? (
          <button className="btn-primary w-full" disabled={busy || amtRaw === 0n} onClick={approve}>
            {busy ? 'Confirming...' : `Approve ${token}`}
          </button>
        ) : (
          <button className="btn-primary w-full" disabled={busy || amtRaw === 0n} onClick={doStake}>
            {busy ? 'Confirming...' : `Stake ${token}`}
          </button>
        )}

        {isSuccess && <p className="text-center text-rite-green text-sm">Transaction confirmed!</p>}
      </div>

      {/* My stakes */}
      {isConnected && stakes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">My Stakes</h2>
          <div className="space-y-3">
            {stakes.map(s => (
              <StakeCard
                key={s.id.toString()}
                stake={s}
                busy={busy}
                onUnstake={() => doUnstake(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rate table */}
      <div className="mt-8 card p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Rate schedule</p>
        <div className="space-y-2 text-sm">
          {STAKE_DURATIONS.map(({ hours, label }) => (
            <div key={hours} className="flex justify-between text-gray-400">
              <span>{label}</span>
              <span className="font-mono">
                <span className="text-gray-300">{RATE_LABELS[hours]}</span>
                <span className="text-gray-600 mx-2">/</span>
                <span className="text-rite-orange">{RIT_RATE_LABELS[hours]} RIT</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">USDC/DAI rate shown first, RIT rate second.</p>
      </div>
    </div>
  )
}
