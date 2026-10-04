import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RoomScene } from './components/Editor/RoomScene'
import { Sidebar } from './components/UI/Sidebar/Sidebar'
import { TopBar } from './components/UI/TopBar'
import { PropertiesPanel } from './components/UI/PropertiesPanel'
import { ToastContainer } from './components/UI/ToastContainer'
import { PersonControls } from './components/UI/PersonControls'
import { AuthScreen } from './components/UI/AuthScreen'
import { ProjectsPage } from './components/UI/ProjectsPage'
import { LoadingPage } from './components/UI/LoadingPage'
import { useAuth } from './store/authStore'
import { useEditorStore } from './store/editorStore'
import { api } from './api'

function Editor() {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 select-none">
      <TopBar />
      <div className="flex-1 relative overflow-hidden">
        <main className="relative w-full h-full overflow-hidden">
          <PersonControls />
          <RoomScene />
          <PropertiesPanel />
        </main>
        <Sidebar />
      </div>
      <ToastContainer />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth(state => state.token)
  const user = useAuth(state => state.user)
  const hydrate = useAuth(state => state.hydrate)
  const logout = useAuth(state => state.logout)
  const [ready, setReady] = useState(Boolean(user))

  useEffect(() => {
    if (!token) return
    if (user) {
      setReady(true)
      return
    }
    let cancelled = false
    api('/api/auth/me').then(async res => {
      if (cancelled) return
      if (!res.ok) {
        logout()
        return
      }
      const json = await res.json()
      hydrate(json.user)
      setReady(true)
    }).catch(() => {
      if (!cancelled) logout()
    })
    return () => {
      cancelled = true
    }
  }, [token, user, hydrate, logout])

  if (!token) return <Navigate to="/login" replace />
  if (!ready) return <LoadingPage title="Проверка входа" />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const token = useAuth(state => state.token)
  if (token) return <Navigate to="/projects" replace />
  return children
}

function EditorRoute() {
  const { projectId } = useParams()
  const rememberProject = useAuth(state => state.rememberProject)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setStatus('loading')
    api(`/api/projects/${projectId}`).then(async res => {
      if (cancelled) return
      if (!res.ok) {
        setStatus('missing')
        return
      }
      const json = await res.json()
      useEditorStore.setState({
        objects: json.data?.objects || [],
        selectedObjectIds: [],
        past: [],
        future: [],
        gestureOpen: false
      })
      rememberProject(json.id, json.name || 'Проект')
      setStatus('ready')
    }).catch(() => {
      if (!cancelled) setStatus('missing')
    })
    return () => {
      cancelled = true
    }
  }, [projectId, rememberProject])

  if (status === 'loading') return <LoadingPage title="Загрузка проекта" />
  if (status === 'missing') return <Navigate to="/projects" replace />
  return <Editor />
}

function HomeRedirect() {
  const token = useAuth(state => state.token)
  return <Navigate to={token ? '/projects' : '/login'} replace />
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<GuestOnly><AuthScreen /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><AuthScreen /></GuestOnly>} />
        <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
        <Route path="/editor/:projectId" element={<RequireAuth><EditorRoute /></RequireAuth>} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
