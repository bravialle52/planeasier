import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, randomProjectName } from '../../api'
import { useAuth } from '../../store/authStore'
import { useEditorStore } from '../../store/editorStore'
import type { PlacedObject } from '../../store/editorStore'
import { LogoLockup } from './Logo'

interface ProjectRow {
  id: string
  name: string
  updated_at?: string
  data?: { objects?: PlacedObject[] }
}

const Preview: React.FC<{ objects: PlacedObject[] }> = ({ objects }) => {
  const walls = objects.filter(item => item.type === 'wall' || item.type === 'partition' || item.type === 'floor')
  return (
    <svg viewBox="-12 -12 24 24" className="w-full h-40 bg-slate-50">
      {walls.map(item => {
        const yaw = item.rotation?.[1] || 0
        const x = item.position?.[0] || 0
        const z = item.position?.[2] || 0
        const length = item.type === 'floor' ? item.scale[0] : item.scale[0]
        const thick = item.type === 'floor' ? item.scale[2] : Math.max(item.scale[2], 0.15)
        return (
          <rect
            key={item.id}
            x={-length / 2}
            y={-thick / 2}
            width={length}
            height={thick}
            transform={`translate(${x} ${z}) rotate(${(-yaw * 180) / Math.PI})`}
            fill={item.type === 'floor' ? '#ffffff' : '#f8fffe'}
            stroke="#538896"
            strokeWidth="0.08"
          />
        )
      })}
    </svg>
  )
}

export const ProjectsPage: React.FC = () => {
  const { user, logout, rememberProject } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [draftName, setDraftName] = useState(randomProjectName())

  const [error, setError] = useState('')

  const load = async () => {
    const res = await api('/api/projects')
    if (!res.ok) return
    const json = await res.json()
    setProjects(json.projects || [])
  }

  useEffect(() => {
    load()
  }, [])

  const createProject = async () => {
    const name = draftName.trim() || randomProjectName()
    setError('')
    const res = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, data: { objects: [] } })
    }).catch(() => null)
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => null) : null
      setError(body?.error || 'Не удалось создать проект')
      return
    }
    const json = await res.json()
    useEditorStore.setState({ objects: [], selectedObjectIds: [], past: [], future: [], gestureOpen: false })
    rememberProject(json.id, json.name || name)
    navigate(`/editor/${json.id}`)
  }

  const open = (project: ProjectRow) => {
    useEditorStore.setState({
      objects: project.data?.objects || [],
      selectedObjectIds: [],
      past: [],
      future: [],
      gestureOpen: false
    })
    rememberProject(project.id, project.name)
    navigate(`/editor/${project.id}`)
  }

  const rename = async (project: ProjectRow) => {
    const name = window.prompt('Название проекта', project.name)
    if (!name) return
    await api(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, data: project.data || { objects: [] } })
    })
    load()
  }

  const remove = async (project: ProjectRow) => {
    if (!window.confirm(`Удалить «${project.name}»?`)) return
    await api(`/api/projects/${project.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="h-16 bg-white border-b border-[#538896]/20 flex items-center justify-between px-6">
        <LogoLockup />
        <div className="flex items-center gap-3 text-sm text-[#538896]">
          <span>{user?.displayName || user?.email}</span>
          <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">Выйти</button>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-2 mb-6">
          <input
            className="flex-1 border border-[#538896]/25 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#538896]"
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
          />
          <button type="button" onClick={createProject} className="px-4 py-2 bg-[#966853] hover:bg-[#7d5644] text-white rounded-xl text-sm">
            Новый проект
          </button>
          <button type="button" onClick={() => setDraftName(randomProjectName())} className="px-3 py-2 border border-[#539678] text-[#539678] rounded-xl text-sm">
            Другое имя
          </button>
        </div>
        {error && <div className="mb-4 text-sm text-[#966853]">{error}</div>}
        {projects.length === 0 && (
          <div className="text-sm text-[#538896]">Пока нет проектов. Создайте первый — имя уже подставлено.</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <article key={project.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button type="button" className="block w-full text-left" onClick={() => open(project)}>
                <Preview objects={project.data?.objects || []} />
                <div className="px-4 pt-3 text-sm text-[#538896]">{project.name}</div>
              </button>
              <div className="px-4 pb-3 pt-1 flex gap-3 text-xs">
                <button type="button" className="text-[#538896]" onClick={() => rename(project)}>Переименовать</button>
                <button type="button" className="text-[#966853]" onClick={() => remove(project)}>Удалить</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
