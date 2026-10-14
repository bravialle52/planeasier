import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { api, randomProjectName } from '../../api'
import { useAuth } from '../../store/authStore'
import { useEditorStore } from '../../store/editorStore'
import type { PlacedObject } from '../../store/editorStore'
import { SiteHeader } from './SiteHeader'
import { Preview3D } from './Preview3D'

interface ProjectRow {
  id: string
  name: string
  updated_at?: string
  data?: { objects?: PlacedObject[] }
}

/** Format a project timestamp for the card footer. */
function when(value?: string) {
  if (!value) return 'Только что'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU')
}

/** Project list with an isometric preview and the material catalog from the mockup. */
export const ProjectsPage: React.FC = () => {
  const { rememberProject } = useAuth()
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

  useEffect(() => { load() }, [])

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
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <SiteHeader />
      <div className="max-w-6xl mx-auto p-6">
        <div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-2 mb-6">
            <input
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2f6bff]"
              value={draftName}
              onChange={event => setDraftName(event.target.value)}
            />
            <button type="button" onClick={createProject} className="tile px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-xl text-sm flex items-center justify-center gap-1">
              <Plus size={16} /> Новый проект
            </button>
            <button type="button" onClick={() => setDraftName(randomProjectName())} className="tile px-3 py-2 border border-[#93c5fd] text-[#1d4ed8] rounded-xl text-sm">
              Другое имя
            </button>
            <button type="button" className="tile px-3 py-2 border border-slate-200 rounded-xl" title="Фильтр" aria-label="Фильтр">
              <SlidersHorizontal size={16} />
            </button>
          </div>
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          <h2 className="text-lg mb-3">Мои проекты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(project => (
              <article key={project.id} className="tile bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button type="button" className="block w-full text-left" onClick={() => open(project)}>
                  <Preview3D objects={project.data?.objects || []} />
                  <div className="px-4 pt-3 text-sm">{project.name}</div>
                </button>
                <div className="px-4 pb-3 pt-1 flex gap-3 text-xs text-slate-500">
                  <span>Изменен {when(project.updated_at)}</span>
                  <button type="button" className="text-[#2f6bff]" onClick={() => rename(project)}>Переименовать</button>
                  <button type="button" className="text-red-500" onClick={() => remove(project)}>Удалить</button>
                </div>
              </article>
            ))}
            <button type="button" onClick={createProject} className="tile min-h-52 border border-dashed border-slate-300 rounded-2xl bg-white/70 text-slate-600">
              Создать проект
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
