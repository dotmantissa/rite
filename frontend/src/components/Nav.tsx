import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { ConnectButton } from './ConnectButton'

const links = [
  { to: '/swap',  label: 'Swap'  },
  { to: '/stake', label: 'Stake' },
  { to: '/lend',  label: 'Lend'  },
]

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-rite-border bg-rite-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NavLink to="/">
          <Logo size={32} />
        </NavLink>

        <div className="flex items-center gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-rite-orange bg-rite-orange/10'
                    : 'text-gray-400 hover:text-white hover:bg-rite-muted'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <ConnectButton />
      </div>
    </nav>
  )
}
