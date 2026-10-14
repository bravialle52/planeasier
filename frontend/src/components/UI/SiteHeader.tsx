import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/authStore'
import { LogoLockup } from './Logo'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-4 text-sm border-b-2 ${isActive ? 'border-[#2f6bff] text-[#1d4ed8]' : 'border-transparent text-slate-600 hover:text-slate-900'}`

/** Shared top bar for projects, the model gallery and the texture library. */
export const SiteHeader: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <LogoLockup to="/projects" />
        <nav className="flex items-center gap-2 h-16">
          <NavLink to="/projects" className={linkClass}>Мои проекты</NavLink>
          <NavLink to="/gallery" className={linkClass}>Галерея 3D моделей</NavLink>
          <NavLink to="/textures" className={linkClass}>Библиотека текстур</NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-700">{user?.displayName || user?.email}</span>
        <button
          type="button"
          onClick={() => { logout(); navigate('/login', { replace: true }) }}
          className="tile px-3 py-1.5 border border-slate-200 rounded-lg"
        >
          Выйти
        </button>
      </div>
    </header>
  )
}
