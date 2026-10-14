import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../store/authStore'
import { LogoLockup } from './Logo'

/** Sign-in and registration card. The blueprint backdrop matches the product mockup. */
export const AuthScreen: React.FC = () => {
  const setSession = useAuth(state => state.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname === '/register' ? 'register' : 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await api(path, {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName })
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => null) : null
      setError(body?.error || 'Не удалось войти')
      return
    }
    const json = await res.json()
    setSession(json.token, json.user)
    navigate('/projects', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#e7eef8] relative overflow-hidden flex items-center justify-center p-6">
      <svg className="absolute inset-0 w-full h-full text-[#9bb6d6]" viewBox="0 0 1200 800" fill="none" aria-hidden>
        <g stroke="currentColor" strokeWidth="1" opacity="0.55">
          <rect x="40" y="60" width="280" height="180" />
          <rect x="80" y="100" width="90" height="70" />
          <path d="M860 40 h260 v180 h-260 z M900 80 h80 v50 h-80 z M1020 80 h60 v90" />
          <path d="M70 520 h200 v160 h-200 z M70 580 h200 M140 520 v160" />
          <path d="M980 520 h160 v140 h-40 v-60 h-120 z" />
        </g>
      </svg>
      <form onSubmit={submit} className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-xl p-8 flex flex-col gap-4">
        <div className="flex justify-center"><LogoLockup /></div>
        <div className="text-center">
          <div className="text-2xl text-slate-900">{mode === 'login' ? 'Вход' : 'Регистрация'}</div>
          <div className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Почта и пароль от аккаунта' : 'Имя, почта и пароль'}
          </div>
        </div>
        {mode === 'register' && (
          <input
            className="border border-[#d5e2f5] bg-[#f4f8fd] rounded-xl px-3 py-3 text-sm outline-none focus:border-[#2f6bff]"
            placeholder="Имя"
            value={displayName}
            onChange={event => setDisplayName(event.target.value)}
          />
        )}
        <label className="flex items-center gap-2 border border-[#d5e2f5] bg-[#f4f8fd] rounded-xl px-3 py-3">
          <Mail size={16} className="text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Почта"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="flex items-center gap-2 border border-[#d5e2f5] bg-[#f4f8fd] rounded-xl px-3 py-3">
          <Lock size={16} className="text-slate-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Пароль"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
          <button type="button" onClick={() => setShowPassword(value => !value)} className="text-slate-400" aria-label="Показать пароль">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="tile bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-xl py-3 text-sm disabled:opacity-50"
        >
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
        <div className="text-sm text-slate-500 text-center">
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <Link to={mode === 'login' ? '/register' : '/login'} className="text-[#2f6bff]">
            {mode === 'login' ? 'Регистрация' : 'Войти'}
          </Link>
        </div>
      </form>
    </div>
  )
}
