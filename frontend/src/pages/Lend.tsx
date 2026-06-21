import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { ADDRESSES, TOKENS, TOKEN_BY_ADDRESS, type TokenSymbol } from '../constants/contracts'
import { erc20Abi, lendingAbi } from '../constants/abis'
import { fmt, parse, fmtDate } from '../utils'

const STABLES: TokenSymbol[] = ['USDC', 'DAI']

interface LoanRow {
  id:         bigint
  borrower:   `0x${string}`
  token:      `0x${string}`
  principal:  bigint
  interest:   bigint
  totalDue:   bigint
  borrowedAt: bigint
  repaid:     boolean
}

function LoanCard({
  loan,
  usdcAllowance,
  daiAllowance,
  onApprove,
  onRepay,
  busy,
}: {
  loan: LoanRow
  usdcAllowance: bigint | undefined
  daiAllowance:  bigint | undefined
  onApprove: (loan: LoanRow) => void
  onRepay:   (loan: LoanRow) => void
  busy: boolean
}) {
  const tokenSym  = TOKEN_BY_ADDRESS[loan.token.toLowerCase()] ?? '???'
  const tokenInfo = TOKENS[tokenSym as TokenSymbol]
  const dec       = tokenInfo?.decimals ?? 6

  const allowance = tokenSym === 'USDC' ? usdcAllowance : daiAllowance
  const needsApproval = !loan.repaid && allowance !== undefined && allowance < loan.totalDue

  return (
    <div className={`card p-5 ${loan.repaid ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{fmt(loan.principal, dec)} {tokenSym}</span>
            <span
              className={`tag text-xs ${
                loan.repaid
                  ? 'bg-rite-muted text-gray-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {loan.repaid ? 'Repaid' : 'Active'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Interest: <span className="text-white">{fmt(loan.interest, dec)} {tokenSym}</span>
          </p>
          <p className="text-xs text-gray-500">
            Total due:{' '}
            <span className="font-mono text-white">
              {fmt(loan.totalDue, dec)} {tokenSym}
            </span>
          </p>
          <p className="text-xs text-gray-600">Borrowed {fmtDate(loan.borrowedAt)}</p>
        </div>
        {!loan.repaid && (
          <div className="flex flex-col gap-2">
            {needsApproval && (
              <button
                className="btn-outline text-sm"
                disabled={busy}
                onClick={() => onApprove(loan)}
              >
                Approve
              </button>
            )}
            <button
              className="btn-primary text-sm"
              disabled={busy || needsApproval}
              onClick={() => onRepay(loan)}
            >
              Repay
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Lend() {
  const { address, isConnected } = useAccount()

  const [token,  setToken]  = useState<TokenSymbol>('USDC')
  const [amount, setAmount] = useState('')

  const tInfo  = TOKENS[token]
  const amtRaw = parse(amount, tInfo.decimals)

  // Preview loan
  const { data: preview } = useReadContract({
    address:      ADDRESSES.lending,
    abi:          lendingAbi,
    functionName: 'previewLoan',
    args:         [tInfo.address, amtRaw],
    query:        { enabled: amtRaw > 0n },
  })
  const [previewInterest, previewTotal] = preview ?? [undefined, undefined]

  // Pool balances
  const { data: usdcPool, refetch: refetchUsdcPool } = useReadContract({
    address:      ADDRESSES.lending,
    abi:          lendingAbi,
    functionName: 'poolBalance',
    args:         [ADDRESSES.usdc],
  })
  const { data: daiPool, refetch: refetchDaiPool } = useReadContract({
    address:      ADDRESSES.lending,
    abi:          lendingAbi,
    functionName: 'poolBalance',
    args:         [ADDRESSES.dai],
  })
  const activePool = token === 'USDC' ? usdcPool : daiPool

  // Wallet balance
  const { data: balance, refetch: refetchBal } = useReadContract({
    address:      tInfo.address,
    abi:          erc20Abi,
    functionName: 'balanceOf',
    args:         [address!],
    query:        { enabled: !!address },
  })

  // Allowances for repayment (pre-fetched for both tokens)
  const { data: usdcAllowance, refetch: refetchUsdcAllow } = useReadContract({
    address:      ADDRESSES.usdc,
    abi:          erc20Abi,
    functionName: 'allowance',
    args:         [address!, ADDRESSES.lending],
    query:        { enabled: !!address },
  })
  const { data: daiAllowance, refetch: refetchDaiAllow } = useReadContract({
    address:      ADDRESSES.dai,
    abi:          erc20Abi,
    functionName: 'allowance',
    args:         [address!, ADDRESSES.lending],
    query:        { enabled: !!address },
  })

  // User loans
  const { data: loanIds, refetch: refetchIds } = useReadContract({
    address:      ADDRESSES.lending,
    abi:          lendingAbi,
    functionName: 'getUserLoans',
    args:         [address!],
    query:        { enabled: !!address },
  })

  const loanContracts = (loanIds ?? []).map(id => ({
    address:      ADDRESSES.lending,
    abi:          lendingAbi,
    functionName: 'loans' as const,
    args:         [id] as const,
  }))

  const { data: loanData, refetch: refetchLoans } = useReadContracts({
    contracts: loanContracts,
    query:     { enabled: (loanIds?.length ?? 0) > 0 },
  })

  const loans: LoanRow[] = (loanData ?? [])
    .map((r, i) => {
      if (r.status !== 'success' || !Array.isArray(r.result)) return null
      const [borrower, tok, principal, interest, totalDue, borrowedAt, repaid] =
        r.result as [`0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, boolean]
      return {
        id: loanIds![i],
        borrower,
        token: tok,
        principal,
        interest,
        totalDue,
        borrowedAt,
        repaid,
      }
    })
    .filter(Boolean) as LoanRow[]

  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const busy = isPending || confirming

  useEffect(() => {
    if (isSuccess) {
      refetchIds()
      refetchLoans()
      refetchBal()
      refetchUsdcPool()
      refetchDaiPool()
      refetchUsdcAllow()
      refetchDaiAllow()
      setAmount('')
      reset()
    }
  }, [isSuccess, refetchIds, refetchLoans, refetchBal, refetchUsdcPool, refetchDaiPool, refetchUsdcAllow, refetchDaiAllow, reset])

  function borrow() {
    writeContract({
      address:      ADDRESSES.lending,
      abi:          lendingAbi,
      functionName: 'borrow',
      args:         [tInfo.address, amtRaw],
    })
  }

  function approveRepay(loan: LoanRow) {
    writeContract({
      address:      loan.token,
      abi:          erc20Abi,
      functionName: 'approve',
      args:         [ADDRESSES.lending, loan.totalDue],
    })
  }

  function repay(loan: LoanRow) {
    writeContract({
      address:      ADDRESSES.lending,
      abi:          lendingAbi,
      functionName: 'repay',
      args:         [loan.id],
    })
  }

  const poolFull = activePool !== undefined && amtRaw > 0n && amtRaw > activePool

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">Lend</h1>
      <p className="text-gray-500 text-sm mb-8">
        Borrow USDC or DAI at a flat 5% rate. Your staking rewards can cover the cost.
      </p>

      {/* Pool availability */}
      <div className="flex gap-3 mb-6">
        {STABLES.map(sym => {
          const pool = sym === 'USDC' ? usdcPool : daiPool
          const info = TOKENS[sym]
          return (
            <div key={sym} className="flex-1 card p-3 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Available {sym}</p>
              <p className="text-sm font-mono font-semibold">
                {pool !== undefined ? fmt(pool, info.decimals, 0) : '--'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="card p-6 space-y-5">
        {/* Token selector */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Token to borrow</label>
          <div className="flex gap-2">
            {STABLES.map(sym => (
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
        </div>

        {/* Amount */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <label>Amount</label>
            {balance !== undefined && (
              <span>
                Wallet: {fmt(balance, tInfo.decimals)} {token}
              </span>
            )}
          </div>
          <input
            type="number"
            className="input-field"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          {poolFull && (
            <p className="text-xs text-red-400 mt-1.5">
              Amount exceeds available pool balance.
            </p>
          )}
        </div>

        {/* Preview */}
        {amtRaw > 0n && (
          <div className="bg-rite-bg rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Flat interest</span>
              <span className="text-white">5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Interest charge</span>
              <span className="text-red-400 font-mono">
                {previewInterest !== undefined
                  ? `${fmt(previewInterest, tInfo.decimals)} ${token}`
                  : '...'}
              </span>
            </div>
            <div className="flex justify-between border-t border-rite-border pt-2">
              <span className="text-gray-400">Total to repay</span>
              <span className="text-white font-semibold font-mono">
                {previewTotal !== undefined
                  ? `${fmt(previewTotal, tInfo.decimals)} ${token}`
                  : '...'}
              </span>
            </div>
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <p className="text-center text-sm text-gray-500">Connect your wallet to borrow.</p>
        ) : (
          <button
            className="btn-primary w-full"
            disabled={busy || amtRaw === 0n || poolFull}
            onClick={borrow}
          >
            {busy ? 'Confirming...' : `Borrow ${token}`}
          </button>
        )}

        {isSuccess && (
          <p className="text-center text-rite-green text-sm">Transaction confirmed!</p>
        )}
      </div>

      {/* Repayment note */}
      <div className="mt-5 card p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-300">Repaying a loan</p>
        <p>
          If you see an Approve button, tap it first to authorize the lending
          contract to pull the repayment amount. Then tap Repay to settle the loan.
        </p>
      </div>

      {/* My loans */}
      {isConnected && loans.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">My Loans</h2>
          <div className="space-y-3">
            {loans.map(loan => (
              <LoanCard
                key={loan.id.toString()}
                loan={loan}
                usdcAllowance={usdcAllowance}
                daiAllowance={daiAllowance}
                busy={busy}
                onApprove={approveRepay}
                onRepay={repay}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
