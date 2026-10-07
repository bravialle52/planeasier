import React, { useState } from 'react'
import { 
  Move, 
  RotateCw, 
  Magnet, 
  Copy, 
  Trash2, 
  Undo2, 
  Redo2, 
  Save, 
  FolderOpen, 
  Download, 
  Box, 
  LayoutGrid, 
  Eraser, 
  Maximize2,
  Layers,
  Building2
} from 'lucide-react'
import { useEditorStore, SNAP_STEPS } from '../../store/editorStore'
import { storeyCount } from '../../store/storeys'
import { useAuth } from '../../store/authStore'
import { Link, useNavigate } from 'react-router-dom'
import { LogoMark } from './Logo'
import { api, withMetrics } from '../../api'

export const TopBar: React.FC = () => {
  const navigate = useNavigate()
  const { 
    selectedObjectIds, 
    removeObjects, 
    objects,
    transformMode, 
    setTransformMode, 
    snap, 
    setSnap,
    snapStep,
    setSnapStep,
    viewMode,
    setViewMode,
    clearObjects,
    undo,
    redo,
    past,
    future,
    duplicateObject,
    currentFloor,
    setCurrentFloor,
    layers,
    toggleLayer,
    isCatalogOpen,
    toggleCatalog,
    showToast
  } = useEditorStore()

  const [saving, setSaving] = useState(false)
  const storeyTotal = storeyCount(objects)

  const hasSelection = selectedObjectIds.length > 0
  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const handleDelete = () => {
    if (hasSelection) removeObjects(selectedObjectIds)
  }

  const handleDuplicate = () => {
    if (hasSelection) duplicateObject(selectedObjectIds[0])
  }

  const handleSave = async () => {
    setSaving(true)
    const auth = useAuth.getState()
    const payload = JSON.stringify({
      name: auth.projectName || 'Проект',
      data: { objects: withMetrics(objects) }
    })
    try {
      localStorage.setItem('planeasier_project_backup', JSON.stringify(objects))
    } catch {
      /* local cache is optional */
    }

    try {
      const savedId = auth.projectId || localStorage.getItem('planeasier_project_id')
      let res = savedId ? await api(`/api/projects/${savedId}`, { method: 'PUT', body: payload }) : null
      if (!res || !res.ok) res = await api('/api/projects', { method: 'POST', body: payload })
      if (res && res.ok) {
        const json = await res.json().catch(() => null)
        if (json?.id) {
          localStorage.setItem('planeasier_project_id', json.id)
          useAuth.setState({ projectId: json.id, projectName: json.name || auth.projectName })
        }
        showToast('Сохранено', 'Проект записан в аккаунт', 'success')
      } else {
        showToast('Не сохранилось', 'Войдите в аккаунт и проверьте сервер', 'error')
      }
    } catch {
      showToast('Не сохранилось', 'Сервер недоступен', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `planeasier-project-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    showToast('Экспорт', 'Файл JSON сохранен на ваше устройство', 'success')
  }

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between px-4 z-20 shadow-xs select-none">
      {/* Brand & 2D/3D Mode Switcher */}
      <div className="flex items-center gap-4">
        {/* Brand without 3d editor badge */}
        <Link to="/projects" title="К проектам" className="hover:opacity-90 flex items-center">
          <LogoMark className="h-8" />
        </Link>

        {/* 2D / 3D Switcher */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 px-3 h-8 rounded-md text-xs font-bold transition-all ${
              viewMode === '2D' 
                ? 'bg-white text-[#538896] shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setViewMode('2D')}
            title="Вид сверху. Средняя и правая кнопка двигают чертёж, левая выделяет рамкой"
          >
            <LayoutGrid size={15} />
            <span>2D План</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 px-3 h-8 rounded-md text-xs font-bold transition-all ${
              viewMode === '3D' 
                ? 'bg-white text-[#538896] shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setViewMode('3D')}
            title="Левая кнопка выбирает и двигает, средняя вращает камеру, правая сдвигает"
          >
            <Box size={15} />
            <span>3D Обзор</span>
          </button>
        </div>

        {/* Transform Tools */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
          <button 
            type="button"
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-all ${
              transformMode === 'translate' ? 'bg-white shadow-2xs text-[#538896]' : 'text-slate-500 hover:text-slate-800'
            }`} 
            title="Перемещение (W)"
            onClick={() => setTransformMode('translate')}
          >
            <Move size={16} />
          </button>
          <button 
            type="button"
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-all ${
              transformMode === 'rotate' ? 'bg-white shadow-2xs text-[#538896]' : 'text-slate-500 hover:text-slate-800'
            }`} 
            title="Вращение (E)"
            onClick={() => setTransformMode('rotate')}
          >
            <RotateCw size={16} />
          </button>
          <button 
            type="button"
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-all ${
              transformMode === 'scale' ? 'bg-white shadow-2xs text-[#538896]' : 'text-slate-500 hover:text-slate-800'
            }`} 
            title="Масштабирование (R)"
            onClick={() => setTransformMode('scale')}
          >
            <Maximize2 size={16} />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <button 
            type="button"
            className={`flex items-center justify-center gap-1 px-2 h-8 rounded-md text-xs font-medium transition-all ${
              snap ? 'bg-[#538896] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`} 
            title={snap ? 'Привязка к сетке включена (поворот по 45°) — нажмите, чтобы выключить' : 'Привязка выключена — нажмите, чтобы включить'}
            onClick={() => setSnap(!snap)}
          >
            <Magnet size={14} />
          </button>
          <select
            value={snapStep}
            onChange={(e) => setSnapStep(Number(e.target.value))}
            title="Шаг привязки = размер клетки сетки"
            className="ml-1 bg-white border border-slate-200 text-slate-700 text-xs rounded h-8 px-1 outline-none"
          >
            {SNAP_STEPS.map(step => (
              <option key={step} value={step}>{step} м</option>
            ))}
          </select>
        </div>

        {/* Dynamic Floor Switcher */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
          <Layers size={14} className="text-slate-500 mx-2" />
          <select 
            value={currentFloor}
            onChange={(e) => {
              if (e.target.value === 'add') {
                const nextFloor = storeyTotal + 1
                setCurrentFloor(nextFloor)
                showToast('Новый этаж', `Переключено на ${nextFloor}-й этаж. Закройте комнату полом сверху — его высота станет уровнем этажа.`, 'info')
              } else {
                setCurrentFloor(Number(e.target.value))
              }
            }}
            title="Выбранный этаж редактируется, остальные становятся прозрачными"
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block h-8 px-2 outline-none mr-1"
          >
            <option value={0}>Все этажи</option>
            {Array.from({ length: Math.max(storeyTotal, currentFloor) }, (_, i) => i + 1).map((f) => (
              <option key={f} value={f}>{f} этаж</option>
            ))}
            <option value="add">+ Добавить этаж</option>
          </select>
        </div>

        {/* Layer Visibility Toggles */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80 gap-0.5 text-xs">
          <button
            type="button"
            onClick={() => toggleLayer('walls')}
            className={`px-2 h-8 flex items-center justify-center rounded-md font-semibold transition-all ${
              layers.walls ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 line-through opacity-60'
            }`}
            title="Показать / Скрыть стены"
          >
            Стены
          </button>
          <button
            type="button"
            onClick={() => toggleLayer('furniture')}
            className={`px-2 h-8 flex items-center justify-center rounded-md font-semibold transition-all ${
              layers.furniture ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 line-through opacity-60'
            }`}
            title="Показать / Скрыть мебель"
          >
            Мебель
          </button>
          <button
            type="button"
            onClick={() => toggleLayer('openings')}
            className={`px-2 h-8 flex items-center justify-center rounded-md font-semibold transition-all ${
              layers.openings ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 line-through opacity-60'
            }`}
            title="Показать / Скрыть двери и окна"
          >
            Проемы
          </button>
          <button
            type="button"
            onClick={() => toggleLayer('floors')}
            className={`px-2 h-8 flex items-center justify-center rounded-md transition-all ${
              layers.floors ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 line-through opacity-60'
            }`}
            title="Показать или скрыть полы"
          >
            Полы
          </button>
        </div>
      </div>

      {/* Center / Action buttons */}
      <div className="flex items-center gap-1.5">
        <button 
          type="button"
          className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors" 
          title="Отменить действие (Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 size={16} />
        </button>
        <button 
          type="button"
          className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors" 
          title="Повторить действие (Ctrl+Y)"
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 size={16} />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1"></div>

        {/* Duplicate / Delete */}
        <button 
          type="button"
          className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors" 
          title="Дублировать выбранный объект"
          onClick={handleDuplicate}
          disabled={!hasSelection}
        >
          <Copy size={16} />
        </button>
        <button 
          type="button"
          className="h-8 w-8 flex items-center justify-center hover:bg-red-50 active:bg-red-100 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors" 
          title="Удалить выбранное (Delete)"
          onClick={handleDelete}
          disabled={!hasSelection}
        >
          <Trash2 size={16} className={hasSelection ? 'text-red-500' : ''} />
        </button>
        <button 
          type="button"
          className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-600 transition-colors" 
          title="Очистить сцену"
          onClick={() => {
            if (objects.length > 0 && confirm('Очистить всю планировку?')) {
              clearObjects()
            }
          }}
        >
          <Eraser size={16} />
        </button>
      </div>

      {/* Right / Storage Actions */}
      <div className="flex items-center gap-2">
        <button 
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 h-8 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs shadow-2xs transition-all disabled:opacity-50"
          title="Сохранить проект"
        >
          <Save size={14} />
          <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
        </button>

        <button 
          type="button"
          onClick={() => navigate('/projects')}
          className="px-3 h-8 bg-[#966853] hover:bg-[#7d5644] text-white rounded-lg flex items-center gap-1.5 text-xs transition-all disabled:opacity-50"
          title="К списку проектов"
        >
          <FolderOpen size={14} />
          <span>Проекты</span>
        </button>

        <button 
          type="button"
          onClick={handleExportJSON}
          className="px-2.5 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 text-xs transition-all"
          title="Экспорт проекта в файл JSON"
        >
          <Download size={14} />
          <span>Экспорт</span>
        </button>

        <div className="w-px h-5 bg-slate-200 mx-0.5"></div>

        <button 
          type="button"
          onClick={toggleCatalog}
          className={`px-3 h-8 font-bold rounded-lg flex items-center gap-1.5 text-xs transition-all border shadow-2xs ${
            isCatalogOpen 
              ? 'bg-blue-50 border-blue-200 text-blue-700' 
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title={isCatalogOpen ? 'Скрыть каталог объектов' : 'Открыть каталог объектов'}
        >
          <Building2 size={15} className="text-[#538896]" />
          <span>Каталог</span>
        </button>
      </div>
    </header>
  )
}
