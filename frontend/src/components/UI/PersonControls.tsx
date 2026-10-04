import React from 'react'
import { User, Camera, Move, RotateCw, Maximize2 } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'

const FPV_TOOLS = [
  { mode: 'translate' as const, label: 'Перемещение', key: '1', icon: Move },
  { mode: 'rotate' as const, label: 'Поворот', key: '2', icon: RotateCw },
  { mode: 'scale' as const, label: 'Размер', key: '3', icon: Maximize2 },
]

export const PersonControls: React.FC = () => {
  const { person, togglePerson, toggleFPV, transformMode, setTransformMode } = useEditorStore()

  return (
    <>
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <button
        type="button"
        onClick={togglePerson}
        className={`flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-all border ${
          person.active && !person.isFPV
            ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/30' 
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
        title="Добавить/Убрать персонажа"
      >
        <User size={24} />
      </button>

      {person.active && (
        <button
          type="button"
          onClick={toggleFPV}
          className={`flex items-center justify-center w-12 h-12 rounded-xl shadow-lg transition-all border ${
            person.isFPV 
              ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/30' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
          title="Включить вид от первого лица (Камера)"
        >
        <Camera size={24} />
      </button>
      )}

    </div>
      {person.isFPV && (
        <>
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="relative w-5 h-5">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
              <span className="absolute top-1/2 left-0 -translate-y-1/2 h-px w-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-xl shadow-lg p-1">
            {FPV_TOOLS.map(tool => {
              const Icon = tool.icon
              const active = transformMode === tool.mode
              return (
                <button
                  key={tool.mode}
                  type="button"
                  onClick={() => setTransformMode(tool.mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
                    active ? 'bg-[#538896] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title={`${tool.label} (${tool.key})`}
                >
                  <Icon size={14} />
                  <span>{tool.label}</span>
                  <span className={active ? 'text-white/80' : 'text-slate-400'}>{tool.key}</span>
                </button>
              )
            })}
            <span className="px-2 text-[11px] text-slate-500">Смотри на стрелку или грань и тяни</span>
          </div>
        </>
      )}
    </>
  )
}
