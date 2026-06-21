import { Link } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { Logo } from '../components/Logo'
import { ADDRESSES } from '../constants/contracts'
import { swapAbi, lendingAbi } from '../constants/abis'
import { fmt } from '../utils'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="text-2xl font-bold text-white font-mono">{value}</p>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function FeatureCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string
  icon: string
  title: string
  desc: string
}) {
  return (
    <Link
      to={to}
      className="card p-7 flex flex-col gap-3 hover:border-rite-orange/40 hover:bg-rite-card/80 transition-all group"
    >
      <div className="text-3xl">{icon}</div>
      <h3 className="text-lg font-semibold text-white group-hover:text-rite-orange transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
      <span className="text-rite-orange text-sm font-medium mt-auto pt-2 flex items-center gap-1">
        Open {title} <span className="group-hover:translate-x-1 transition-transform inline-block">&#8594;</span>
      </span>
    </Link>
  )
}

export function Landing() {
  const { data: reserves } = useReadContract({
    address: ADDRESSES.swap,
    abi:     swapAbi,
    functionName: 'reserves',
  })

  const { data: usdcPool } = useReadContract({
    address: ADDRESSES.lending,
    abi:     lendingAbi,
    functionName: 'poolBalance',
    args:    [ADDRESSES.usdc],
  })

  const { data: daiPool } = useReadContract({
    address: ADDRESSES.lending,
    abi:     lendingAbi,
    functionName: 'poolBalance',
    args:    [ADDRESSES.dai],
  })

  const ritReserve  = reserves ? fmt(reserves[0], 18, 0) : '--'
  const usdcReserve = reserves ? fmt(reserves[1], 6,  0) : '--'
  const lendUsdc    = usdcPool  ? fmt(usdcPool,   6,  0) : '--'
  const lendDai     = daiPool   ? fmt(daiPool,    18, 0) : '--'

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-20">
        <Logo size={80} showText={false} className="mb-8" />
        <h1 className="text-6xl font-bold tracking-tight mb-4">
          <span className="text-rite-orange">RITE</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-md leading-relaxed">
          Swap tokens, lock in staking rewards, and borrow against your position. All on Ritual Chain.
        </p>
        <div className="flex gap-3 mt-8">
          <Link to="/swap" className="btn-primary px-7 py-3 text-base">
            Start Swapping
          </Link>
          <Link to="/stake" className="btn-outline px-7 py-3 text-base">
            Earn Rewards
          </Link>
        </div>
      </div>

      {/* Live stats */}
      <div className="mb-16">
        <p className="text-xs text-gray-600 uppercase tracking-widest text-center mb-5">
          Live Pool Stats
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="RIT in Swap"    value={ritReserve}  />
          <StatCard label="USDC in Swap"   value={usdcReserve} />
          <StatCard label="USDC Lendable"  value={lendUsdc}    />
          <StatCard label="DAI Lendable"   value={lendDai}     />
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FeatureCard
          to="/swap"
          icon="&#8646;"
          title="Swap"
          desc="Trade RIT, USDC, and DAI at a fixed 1:10 rate with 0.3% fees. No price impact, no oracle risk."
        />
        <FeatureCard
          to="/stake"
          icon="&#9650;"
          title="Stake"
          desc="Lock USDC, DAI, or RIT for 12 hours to one week. RIT staking earns outsized USDC rewards."
        />
        <FeatureCard
          to="/lend"
          icon="&#8659;"
          title="Lend"
          desc="Borrow USDC or DAI against the protocol at a flat 5% rate. Your staking yield covers the interest."
        />
      </div>

      <p className="text-center text-xs text-gray-700 mt-16">
        Deployed on Ritual Testnet &bull; Chain ID 1979 &bull; Not financial advice
      </p>
    </div>
  )
}
