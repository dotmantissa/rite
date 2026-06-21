interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function Logo({ size = 36, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="48" fill="#0a0a0a" />
        <g transform="translate(50,50)">
          <path
            d="M 0,0 C -4,-12 -2,-24 8,-30 C 18,-36 26,-28 24,-18 C 22,-10 14,-6 6,-3"
            stroke="#f97316"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M 0,0 C -4,-12 -2,-24 8,-30 C 18,-36 26,-28 24,-18 C 22,-10 14,-6 6,-3"
            stroke="#f97316"
            strokeWidth="5.5"
            strokeLinecap="round"
            transform="rotate(120)"
          />
          <path
            d="M 0,0 C -4,-12 -2,-24 8,-30 C 18,-36 26,-28 24,-18 C 22,-10 14,-6 6,-3"
            stroke="#f97316"
            strokeWidth="5.5"
            strokeLinecap="round"
            transform="rotate(240)"
          />
          <circle r="4.5" fill="#f97316" />
        </g>
      </svg>
      {showText && (
        <span
          className="font-bold tracking-widest text-white uppercase"
          style={{ fontSize: size * 0.55 }}
        >
          RITE
        </span>
      )}
    </div>
  )
}
