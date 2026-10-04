import React from 'react'
import { Link } from 'react-router-dom'

/** Square mark used in the editor header: it only leads back to the project list. */
export const LogoMark: React.FC<{ className?: string; title?: string }> = ({ className = 'w-9 h-9 text-lg', title }) => (
  <span
    title={title}
    className={`inline-flex items-center justify-center rounded-lg bg-[#966853] text-white select-none ${className}`}
  >
    П
  </span>
)

export const LogoLockup: React.FC<{ to?: string; onDark?: boolean }> = ({ to, onDark }) => {
  const body = (
    <span className="flex items-center gap-3">
      <LogoMark className="w-11 h-11 text-xl" />
      <span>
        <span className={`block text-xl leading-none tracking-tight ${onDark ? 'text-white' : 'text-[#538896]'}`}>Planeasier</span>
        <span className={`block text-xs mt-1 ${onDark ? 'text-[#B4EFFF]' : 'text-[#539678]'}`}>Планировщик комнат</span>
      </span>
    </span>
  )
  if (!to) return body
  return (
    <Link to={to} className="hover:opacity-90">
      {body}
    </Link>
  )
}
