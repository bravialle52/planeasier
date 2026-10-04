import React, { useState, useEffect } from 'react'
import { useEditorStore, getMinY } from '../../store/editorStore'
import { isWallType, wallCenterY } from '../../store/wallMath'
import { 
  Trash2, 
  Copy, 
  Ruler, 
  MoveVertical, 
  RotateCw, 
  Palette, 
  X, 
  SlidersHorizontal,
  SquareDashedBottom,
  Link,
  Unlink,
  Layers
} from 'lucide-react'

const COLOR_SWATCHES = [
  { label: 'Белый (макет)', color: '#ffffff' },
  { label: 'Светло-серый', color: '#e2e8f0' },
  { label: 'Серый', color: '#94a3b8' },
  { label: 'Графит', color: '#334155' },
  { label: 'Черный', color: '#0f172a' },
  { label: 'Дерево (светлое)', color: '#d97706' },
  { label: 'Орех', color: '#78350f' },
  { label: 'Синий сканди', color: '#3b82f6' },
  { label: 'Изумруд', color: '#16a34a' },
  { label: 'Бежевый', color: '#fde68a' }
]

const UngroupButtons: React.FC<{ onSelected: () => void; onWhole: () => void }> = ({ onSelected, onWhole }) => (
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={onSelected}
      title="Отделить только выделенные объекты от остальных"
      className="py-2 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1"
    >
      <Unlink size={13} />
      <span>Только выделенные</span>
    </button>
    <button
      type="button"
      onClick={onWhole}
      title="Разобрать всю конструкцию на отдельные объекты"
      className="py-2 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1"
    >
      <Unlink size={13} />
      <span>Всю структуру</span>
    </button>
  </div>
)

export const PropertiesPanel: React.FC = () => {
  const { 
    selectedObjectIds, 
    objects, 
    updateObjectTransform,
    updateObjectProperties,
    removeObjects,
    duplicateObject,
    rotateObject90,
    selectObjects,
    groupSelectedObjects,
    ungroupObjects,
    detachObjects,
    selectGroup,
    beginGesture,
    endGesture,
    isCatalogOpen
  } = useEditorStore()

  // The catalog drawer (340px) slides over the scene on the right; keep the panel next to it, never under it.
  const panelStyle: React.CSSProperties = { right: isCatalogOpen ? 340 + 16 : 16 }
  
  const selectedObjectId = selectedObjectIds[0]
  const selectedObject = objects.find(o => o.id === selectedObjectId || o.groupId === selectedObjectId)

  const [scale, setScale] = useState<[number, number, number]>([1, 1, 1])
  const [elevation, setElevation] = useState<number>(0)
  const [rotations, setRotations] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    if (selectedObject) {
      setScale([...selectedObject.scale] as [number, number, number])
      const minY = getMinY(selectedObject.type, selectedObject.scale[1])
      const curElevation = Math.max(0, Math.round((selectedObject.position[1] - minY) * 100) / 100)
      setElevation(curElevation)

      const toDeg = (rad: number) => {
        const deg = Math.round((rad * 180) / Math.PI) % 360
        return deg < 0 ? deg + 360 : deg
      }

      setRotations({
        x: toDeg(selectedObject.rotation[0]),
        y: toDeg(selectedObject.rotation[1]),
        z: toDeg(selectedObject.rotation[2])
      })
    }
  }, [selectedObject])

  // Multi-selection panel view
  if (selectedObjectIds.length > 1) {
    const selectedObjectsList = objects.filter(o => selectedObjectIds.includes(o.id))
    const groupIds = new Set(selectedObjectsList.map(o => o.groupId).filter(Boolean))
    const isSingleUnifiedGroup = groupIds.size === 1 && selectedObjectsList.every(o => o.groupId === Array.from(groupIds)[0])
    const isRoomGroup = selectedObjectsList.some(o => isWallType(o.type) || o.type === 'floor')
    const hasLinked = selectedObjectsList.some(o => o.groupId || o.wallId)

    return (
      <div style={panelStyle} className="absolute top-4 w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 overflow-hidden z-20 flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 transition-[right]">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 tracking-tight leading-none">
                Группа объектов ({selectedObjectIds.length})
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Множественное выделение</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectObjects([])}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Снять выделение"
          >
            <X size={15} />
          </button>
        </div>

        {/* Group Actions */}
        <div className="p-3.5 space-y-3">
          {isSingleUnifiedGroup ? (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Link size={14} className="text-amber-600" />
                  Объединено в группу
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                  {selectedObjectIds.length} эл.
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight mb-3">
                {isRoomGroup
                  ? 'Стены и пол помещения — единая конструкция: двигаются и поворачиваются вместе.'
                  : 'Объекты связаны и перемещаются как единый цельный блок.'}
              </p>
              <UngroupButtons
                onSelected={() => detachObjects(selectedObjectIds)}
                onWhole={() => ungroupObjects(selectedObjectIds)}
              />
            </div>
          ) : hasLinked ? (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-amber-800 leading-tight">
                Часть выделенных объектов связана с другими.
              </p>
              <UngroupButtons
                onSelected={() => detachObjects(selectedObjectIds)}
                onWhole={() => ungroupObjects(selectedObjectIds)}
              />
              <button
                type="button"
                onClick={() => groupSelectedObjects(selectedObjectIds)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Link size={14} />
                <span>Сгруппировать выделенные</span>
              </button>
            </div>
          ) : (
            <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  Слияние объектов
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded font-medium">
                  {selectedObjectIds.length} выбрано
                </span>
              </div>
              <p className="text-[11px] text-indigo-800 leading-tight mb-3">
                Объедините выделенные объекты в один цельный объект, чтобы перемещать и поворачивать их синхронно.
              </p>
              <button
                type="button"
                onClick={() => groupSelectedObjects(selectedObjectIds)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5"
              >
                <Link size={15} />
                <span>Сгруппировать в один объект</span>
              </button>
            </div>
          )}

          {/* List of items */}
          <div className="border border-slate-100 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Состав выделения:
            </div>
            {selectedObjectsList.map(obj => (
              <div key={obj.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 text-slate-700">
                <span className="truncate">{obj.name || obj.type}</span>
                <span className="text-[10px] text-slate-400 font-mono ml-2">
                  {obj.scale[0]}×{obj.scale[2]}м
                </span>
              </div>
            ))}
          </div>

          {/* Quick Batch Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => rotateObject90(selectedObjectIds[0])}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
              title="Повернуть всю группу на 90 градусов"
            >
              <RotateCw size={14} />
              <span>Поворот 90°</span>
            </button>
            <button
              type="button"
              onClick={() => removeObjects(selectedObjectIds)}
              className="flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg text-xs font-medium text-red-600 transition-colors"
              title="Удалить все выделенные объекты (Delete)"
            >
              <Trash2 size={14} />
              <span>Удалить все</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedObject) return null

  const handleScaleChange = (axis: 0 | 1 | 2, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) return
    const clampedNum = Math.max(0.01, num)
    const newScale = [...scale] as [number, number, number]
    newScale[axis] = clampedNum
    setScale(newScale)
    const nextY = isWallType(selectedObject.type) && axis === 1
      ? wallCenterY(selectedObject.floor || 1, clampedNum)
      : selectedObject.position[1]
    updateObjectTransform(
      selectedObject.id,
      [selectedObject.position[0], nextY, selectedObject.position[2]],
      selectedObject.rotation,
      newScale
    )
  }

  // Elevation from floor: 0 means resting directly on the floor. Clamped so it cannot be < 0.
  const handleElevationChange = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    const clampedElevation = Math.max(0, num)
    setElevation(clampedElevation)
    const minY = getMinY(selectedObject.type, selectedObject.scale[1])
    const newY = minY + clampedElevation
    const newPos = [selectedObject.position[0], newY, selectedObject.position[2]] as [number, number, number]
    updateObjectTransform(selectedObject.id, newPos, selectedObject.rotation, selectedObject.scale)
  }

  const handleRotationChange = (axis: 'x' | 'y' | 'z', deg: number) => {
    setRotations(prev => ({ ...prev, [axis]: deg }))
    const rad = (deg * Math.PI) / 180
    const newRot: [number, number, number] = [
      axis === 'x' ? rad : selectedObject.rotation[0],
      axis === 'y' ? rad : selectedObject.rotation[1],
      axis === 'z' ? rad : selectedObject.rotation[2]
    ]
    updateObjectTransform(selectedObject.id, selectedObject.position, newRot, selectedObject.scale)
  }

  const handleColorSelect = (color: string) => {
    updateObjectProperties(selectedObject.id, { color })
  }

  // Calculate footprint area in m²
  const area = (selectedObject.scale[0] * selectedObject.scale[2]).toFixed(2)

  return (
    <div style={panelStyle} className="absolute top-4 w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 overflow-hidden z-20 flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 transition-[right]">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight leading-none">
              {selectedObject.name || selectedObject.type}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">ID: {selectedObject.id.slice(0, 8)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectObjects([])}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          title="Закрыть панель свойств"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
        {/* Group status badge */}
        {(selectedObject.groupId || selectedObject.wallId) && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2 text-xs text-slate-700">
            <span>{selectedObject.groupId ? 'Часть конструкции' : 'Встроено в стену'}</span>
            <div className="flex flex-wrap items-center gap-1">
              {selectedObject.groupId && (
              <button
                type="button"
                onClick={() => selectGroup(selectedObject.groupId!)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Выделить всё
              </button>
              )}
              <button
                type="button"
                onClick={() => detachObjects([selectedObject.id])}
                title="Отделить этот объект от всех остальных (стен, пола, дверей)"
                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Отделить
              </button>
              {selectedObject.groupId && (
              <button
                type="button"
                onClick={() => ungroupObjects(selectedObject.groupId!)}
                title="Разобрать всю конструкцию на отдельные объекты"
                className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Разгруппировать всё
              </button>
              )}
            </div>
          </div>
        )}

        {/* Area badge for rooms/floors */}
        {(selectedObject.type === 'floor' || selectedObject.type === 'room' || selectedObject.type === 'carpet') && (
          <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg flex items-center justify-between text-xs text-blue-800 font-medium">
            <span className="flex items-center gap-1.5">
              <SquareDashedBottom size={15} className="text-blue-600" />
              Площадь покрытия:
            </span>
            <span className="font-bold font-mono">{area} м²</span>
          </div>
        )}

        {/* Dimensions (Ширина, Высота, Длина) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-slate-700">
            <Ruler size={15} className="text-slate-500" />
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Габариты, метры
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['Длина', 'Высота', 'Ширина'] as const).map((label, axis) => (
              <div key={label}>
                <label className="text-[11px] text-slate-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-slate-400 focus:bg-white"
                  value={scale[axis]}
                  onFocus={() => beginGesture()}
                  onBlur={() => endGesture()}
                  onChange={(e) => handleScaleChange(axis as 0 | 1 | 2, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 text-slate-700">
            <div className="flex items-center gap-1.5">
              <MoveVertical size={15} className="text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Высота от пола</span>
            </div>
            <span className="text-[11px] text-slate-400">мин: 0.00м (на полу)</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              step="0.05"
              min="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              value={elevation}
              onChange={(e) => handleElevationChange(e.target.value)}
            />
            <span className="text-xs text-slate-400">м</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 text-slate-700">
            <div className="flex items-center gap-1.5">
              <RotateCw size={15} className="text-slate-500" />
              <span className="text-xs uppercase tracking-wide text-slate-500">Поворот</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1.5">
            <span>Ось Y</span>
            <span>{rotations.y}°</span>
          </div>

          <div className="flex items-center gap-1">
            {[0, 90, 180, 270].map((deg) => {
              const axis = 'y' as const
              return (
              <button
                key={deg}
                type="button"
                onClick={() => handleRotationChange(axis, deg)}
                className={`flex-1 py-1 text-[11px] rounded-md border transition-all ${
                  rotations[axis] === deg 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {deg}°
              </button>
            )})}
          </div>
        </div>

        {/* Material & Color Presets */}
        <div>
          <div className="flex items-center justify-between mb-2 text-slate-700">
            <div className="flex items-center gap-1.5">
              <Palette size={15} className="text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Цвет макета</span>
            </div>
            {/* Direct color picker */}
            <input 
              type="color" 
              value={selectedObject.color || '#ffffff'}
              onChange={(e) => handleColorSelect(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              title="Произвольный цвет"
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.color}
                type="button"
                onClick={() => handleColorSelect(swatch.color)}
                className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center ${
                  (selectedObject.color || '#ffffff').toLowerCase() === swatch.color.toLowerCase()
                    ? 'border-blue-600 scale-110 shadow-sm'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.color }}
                title={swatch.label}
              />
            ))}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex gap-2">
          <button 
            type="button"
            className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            onClick={() => rotateObject90(selectedObject.id)}
            title="Повернуть на 90 градусов вокруг оси Y"
          >
            <RotateCw size={15} />
            90°
          </button>
          <button 
            type="button"
            className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            onClick={() => duplicateObject(selectedObject.id)}
            title="Создать копию объекта"
          >
            <Copy size={15} />
            Копия
          </button>
          <button 
            type="button"
            className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
            onClick={() => {
              removeObjects([selectedObject.id])
              selectObjects([])
            }}
            title="Удалить объект"
          >
            <Trash2 size={15} />
            Удалить
          </button>
        </div>

      </div>
    </div>
  )
}
