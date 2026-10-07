import React from 'react'
import { Link } from 'react-router-dom'
import planeasierLogo from '../../assets/planeasier-svg.svg'

/** Logo mark used across the app. */
export const LogoMark: React.FC<{ className?: string; title?: string }> = ({ className = 'h-9', title }) => (
  <img 
    src={planeasierLogo} 
    alt="Planeasier"
    title={title}
    className={`inline-block select-none ${className}`}
  />
)

export const LogoLockup: React.FC<{ to?: string; onDark?: boolean }> = ({ to, onDark }) => {
  const body = (
    <span className="flex items-center">
      {/* For dark mode, we might need a CSS filter to invert colors or just use the same logo if it works */}
      <LogoMark className={`h-11 ${onDark ? 'brightness-0 invert' : ''}`} />
    </span>
  )
  if (!to) return body
  return (
    <Link to={to} className="hover:opacity-90">
      {body}
    </Link>
  )
}
