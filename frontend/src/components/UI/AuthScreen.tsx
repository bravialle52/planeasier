import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store/authStore'
import { LogoLockup } from './Logo'

export const AuthScreen: React.FC = () => {
  const setSession = useAuth(state => state.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname === '/register' ? 'register' : 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
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
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
          <LogoLockup />
          <div>
            <div className="text-lg text-slate-900">{mode === 'login' ? 'Вход' : 'Регистрация'}</div>
            <div className="text-sm text-slate-500 mt-1">
              {mode === 'login' ? 'Почта и пароль от аккаунта' : 'Имя, почта и пароль'}
            </div>
          </div>
          {mode === 'register' && (
            <input
              className="border border-[#538896]/30 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#538896]"
              placeholder="Имя"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
            />
          )}
          <input
            className="border border-[#538896]/30 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#538896]"
            placeholder="Почта"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
          <input
            className="border border-[#538896]/30 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#538896]"
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
          {error && <div className="text-sm text-[#966853]">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="bg-[#966853] hover:bg-[#7d5644] text-white rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <Link to={mode === 'login' ? '/register' : '/login'} className="text-sm text-[#538896] text-center">
            {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
          </Link>
      </form>
    </div>
  )
}
