import React from 'react'
import { LogoLockup } from './Logo'

export const LoadingPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <LogoLockup />
      <div className="text-sm text-[#538896]">{title}</div>
    </div>
  )
}
