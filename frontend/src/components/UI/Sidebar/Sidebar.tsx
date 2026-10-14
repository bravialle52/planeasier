import React, { useState, useRef } from 'react'
import { ToolButton } from './ToolButton'
import { useEditorStore } from '../../../store/editorStore'
import { api } from '../../../api'
import type { ObjectType } from '../../../store/editorStore'
import { SHOP_MODELS, type ShopModel } from '../../../catalog/shop'
import { useLibrary } from '../../../catalog/libraryApi'
import { packUploads, MissingBufferError, UnreadableModelError } from '../../../importModel'
import { 
  Building2, 
  Sofa, 
  BedDouble, 
  Utensils, 
  Bath, 
  Package, 
  Lamp, 
  Upload, 
  Columns, 
  Square, 
  AppWindow, 
  DoorClosed, 
  DoorOpen, 
  Split, 
  Maximize, 
  Armchair, 
  Table, 
  Tv, 
  Library, 
  Layers, 
  Bed, 
  Archive, 
  Box, 
  ChefHat, 
  Refrigerator, 
  Droplets, 
  Monitor, 
  LampCeiling, 
  LampFloor, 
  Flower2, 
  Home,
  Triangle,
  Toilet,
  ChevronLeft,
  ChevronRight,
  SquareDashed,
  ArrowUpFromLine,
  UnfoldVertical,
  Blinds,
  Minus,
  LampWallUp
} from 'lucide-react'

type CategoryId = 'construction' | 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'decor' | 'upload'

interface CatalogCategory {
  id: CategoryId
  name: string
  icon: React.ReactNode
}

const CATEGORIES: CatalogCategory[] = [
  { id: 'construction', name: 'Конструктив', icon: <Building2 size={16} /> },
  { id: 'living', name: 'Гостиная', icon: <Sofa size={16} /> },
  { id: 'bedroom', name: 'Спальня', icon: <BedDouble size={16} /> },
  { id: 'kitchen', name: 'Кухня', icon: <Utensils size={16} /> },
  { id: 'bathroom', name: 'Ванная', icon: <Bath size={16} /> },
  { id: 'office', name: 'Офис и Склад', icon: <Package size={16} /> },
  { id: 'decor', name: 'Декор и Свет', icon: <Lamp size={16} /> },
  { id: 'upload', name: '3D Модели', icon: <Upload size={16} /> }
]

/** Which catalog tab a shop pack belongs to. Names stay the same as in the gallery. */
function shopTab(model: ShopModel): CategoryId {
  if (model.type === 'bed_loft') return 'bedroom'
  if (model.type === 'shelf_wms') return 'office'
  return 'living'
}

/** Types already drawn as fixed buttons, so a claimed pack is not listed twice. */
const BUILTIN_SHOP_TYPES = new Set<ObjectType>(['sofa_loft', 'armchair_loft', 'shelf_wms'])

/** Claimed gallery packs for one tab, using the shop title. */
const ClaimedPacks: React.FC<{ tab: CategoryId; owns: (id: string) => boolean; onAdd: (type: ObjectType) => void }> = ({ tab, owns, onAdd }) => {
  const packs = SHOP_MODELS.filter(model => owns(model.id) && shopTab(model) === tab && !BUILTIN_SHOP_TYPES.has(model.type))
  if (packs.length === 0) return null
  return (
    <div className="mt-4">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Из магазина</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {packs.map(model => (
          <ToolButton
            key={model.id}
            icon={<Package size={26} className="text-[#2f6fe0]" />}
            label={model.name}
            onClick={() => onAdd(model.type)}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('type', model.type)}
          />
        ))}
      </div>
    </div>
  )
}

/** Right-hand catalog: rooms, furniture and imported meshes. */
export const Sidebar: React.FC = () => {
  const { addObject, addRoom, isCatalogOpen, toggleCatalog, showToast } = useEditorStore()
  const { owns } = useLibrary()
  const [activeTab, setActiveTab] = useState<CategoryId>('construction')
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Open the hidden file input used for glTF and OBJ import. */
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  /** Unpack an archive or a Max scene, then place every mesh with the same handles as built-in objects. */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const clear = () => {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    try {
      showToast('Читаю архив', files.map(file => file.name).join(', '), 'info')
      const packed = await packUploads(files)
      let placed = 0
      for (const [index, model] of packed.entries()) {
        if (model.size > 80 * 1024 * 1024) {
          showToast('Файл слишком большой', `${model.name} больше 80 МБ`, 'error')
          continue
        }
        const body = new FormData()
        body.append('file', model)
        const res = await api('/api/models', { method: 'POST', body }).catch(() => null)
        if (!res || !res.ok) {
          const payload = res ? await res.json().catch(() => null) : null
          showToast('Не удалось загрузить', payload?.error || model.name, 'error')
          continue
        }
        const json = await res.json()
        addObject('custom', [index * 2, 0.5, 0], json.url)
        placed += 1
      }
      if (placed > 0) showToast('Модель на сцене', placed > 1 ? `Добавлено ${placed}` : packed[0].name, 'success')
    } catch (error) {
      if (error instanceof MissingBufferError) {
        showToast('Не хватает файла', `В архиве нет ${error.fileName}`, 'error')
      } else if (error instanceof UnreadableModelError) {
        showToast('Не удалось прочитать', 'В архиве нет glTF, FBX, OBJ или сетки .max', 'error')
      } else {
        showToast('Не удалось прочитать', 'Архив повреждён или сцена .max без сетки', 'error')
      }
    }
    clear()
  }

  /** Drop a catalog type at the origin; the store seats it on the current floor. */
  const handleAdd = (type: ObjectType) => {
    addObject(type, [0, undefined as any, 0])
  }

  return (
    <>
      {/* Always visible Floating Toggle Button on the right edge */}
      <button
        type="button"
        onClick={toggleCatalog}
        style={{ right: isCatalogOpen ? 340 : 0 }}
        className={`absolute top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-300 shadow-xl rounded-l-xl text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all duration-300 flex items-center justify-center cursor-pointer ${
          isCatalogOpen ? 'p-2 -mr-px' : 'py-4 px-2 shadow-2xl flex-col gap-1.5'
        }`}
        title={isCatalogOpen ? 'Скрыть каталог объектов' : 'Показать каталог объектов'}
      >
        {isCatalogOpen ? <ChevronRight size={18} /> : <ChevronLeft size={20} className="text-blue-600" />}
        {!isCatalogOpen && (
          <span className="[writing-mode:vertical-lr] rotate-180 text-xs font-bold text-slate-700 uppercase tracking-widest py-1 select-none">
            Каталог
          </span>
        )}
      </button>

      <aside 
        className={`absolute top-0 right-0 h-full bg-white border-l border-slate-200 flex flex-col z-30 shadow-lg select-none overflow-hidden transition-transform duration-200 ease-out ${
          isCatalogOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        style={{ width: 340 }}
      >
        <div className="w-[340px] h-full flex flex-col overflow-hidden">
          {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between min-w-[320px]">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            Каталог объектов
          </h2>
          <p className="text-[11px] text-slate-600">Кликните или перетащите на сцену</p>
        </div>
      </div>

      {/* Categories Grid (4 columns × 2 rows) - All 8 categories clearly visible at once */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-100/80 border-b border-slate-200 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveTab(cat.id)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10.5px] transition-all ${
              activeTab === cat.id
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
            }`}
            title={cat.name}
          >
            <div className="mb-1">{cat.icon}</div>
            <span className="truncate w-full text-center leading-tight">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Catalog Items Grid */}
      <div className="p-4 flex-1 overflow-y-auto">
        {/* 1. КОНСТРУКТИВ */}
        {activeTab === 'construction' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Готовые помещения</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <ToolButton
                  icon={<Home size={26} className="text-blue-600" />}
                  label="Комната 5×4м"
                  onClick={() => addRoom(5, 4, 2.8)}
                />
                <ToolButton
                  icon={<Home size={26} className="text-indigo-600" />}
                  label="Комната 6×6м"
                  onClick={() => addRoom(6, 6, 2.8)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Стены и Покрытия</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <ToolButton
                  icon={<Columns size={26} className="text-slate-600" />}
                  label="Стена (4м)"
                  onClick={() => handleAdd('wall')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'wall')}
                />
                <ToolButton
                  icon={<Columns size={26} className="text-slate-500" />}
                  label="Перегородка (2.5м)"
                  onClick={() => handleAdd('partition')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'partition')}
                />
                <ToolButton
                  icon={<Square size={26} className="text-amber-700" />}
                  label="Пол (5×4м)"
                  onClick={() => handleAdd('floor')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'floor')}
                />
                <ToolButton
                  icon={<Triangle size={26} className="text-[#966853]" />}
                  label="Крыша"
                  onClick={() => handleAdd('roof')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'roof')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Окна и Проемы</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <ToolButton
                  icon={<AppWindow size={26} className="text-sky-500" />}
                  label="Окно (1.4×1.4)"
                  onClick={() => handleAdd('window')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'window')}
                />
                <ToolButton
                  icon={<Maximize size={26} className="text-sky-600" />}
                  label="Панорамное (2.4м)"
                  onClick={() => handleAdd('panoramic_window')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'panoramic_window')}
                />
                <ToolButton
                  icon={<DoorClosed size={26} className="text-amber-800" />}
                  label="Дверь (0.9м)"
                  onClick={() => handleAdd('door')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'door')}
                />
                <ToolButton
                  icon={<DoorOpen size={26} className="text-amber-900" />}
                  label="Двустворчатая"
                  onClick={() => handleAdd('double_door')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'double_door')}
                />
                <ToolButton
                  icon={<Split size={26} className="text-indigo-500" />}
                  label="Арка / Проем"
                  onClick={() => handleAdd('arch')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'arch')}
                />
                <ToolButton
                  icon={<SquareDashed size={26} className="text-[#538896]" />}
                  label="Свой проём"
                  onClick={() => handleAdd('opening')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'opening')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Лестницы</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <ToolButton
                  icon={<ArrowUpFromLine size={26} className="text-[#966853]" />}
                  label="Прямая"
                  onClick={() => handleAdd('stairs_straight')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'stairs_straight')}
                />
                <ToolButton
                  icon={<UnfoldVertical size={26} className="text-[#966853]" />}
                  label="Г-образная"
                  onClick={() => handleAdd('stairs_l')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'stairs_l')}
                />
                <ToolButton
                  icon={<UnfoldVertical size={26} className="text-[#539678]" />}
                  label="Винтовая"
                  onClick={() => handleAdd('stairs_spiral')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('type', 'stairs_spiral')}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. ГОСТИНАЯ */}
        {activeTab === 'living' && (
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Мягкая мебель и ТВ</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<Sofa size={26} className="text-[#2f6fe0]" />}
                label="Диван Loft"
                onClick={() => handleAdd('sofa_loft')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'sofa_loft')}
              />
              <ToolButton
                icon={<Armchair size={26} className="text-[#3d7eea]" />}
                label="Диван, кресло"
                onClick={() => handleAdd('armchair_loft')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'armchair_loft')}
              />
              <ToolButton
                icon={<Library size={26} className="text-[#8fb4e8]" />}
                label="Стеллаж WMS"
                onClick={() => handleAdd('shelf_wms')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'shelf_wms')}
              />
              <ToolButton
                icon={<Sofa size={26} className="text-indigo-600" />}
                label="Диван 3-местный"
                onClick={() => handleAdd('sofa')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'sofa')}
              />
              <ToolButton
                icon={<Armchair size={26} className="text-slate-700" />}
                label="Кресло мягкое"
                onClick={() => handleAdd('armchair')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'armchair')}
              />
              <ToolButton
                icon={<Table size={26} className="text-amber-700" />}
                label="Журнальный стол"
                onClick={() => handleAdd('coffee_table')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'coffee_table')}
              />
              <ToolButton
                icon={<Tv size={26} className="text-slate-800" />}
                label="ТВ-тумба с ТВ"
                onClick={() => handleAdd('tv_unit')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'tv_unit')}
              />
              <ToolButton
                icon={<Library size={26} className="text-amber-800" />}
                label="Книжный стеллаж"
                onClick={() => handleAdd('bookshelf')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'bookshelf')}
              />
              <ToolButton
                icon={<Layers size={26} className="text-violet-600" />}
                label="Ковер напольный"
                onClick={() => handleAdd('carpet')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'carpet')}
              />
            </div>
            <ClaimedPacks tab="living" owns={owns} onAdd={handleAdd} />
          </div>
        )}

        {/* 3. СПАЛЬНЯ */}
        {activeTab === 'bedroom' && (
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Кровати и Хранение</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<BedDouble size={26} className="text-blue-600" />}
                label="Кровать 2-сп."
                onClick={() => handleAdd('bed_double')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'bed_double')}
              />
              <ToolButton
                icon={<Bed size={26} className="text-blue-500" />}
                label="Кровать 1-сп."
                onClick={() => handleAdd('bed_single')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'bed_single')}
              />
              <ToolButton
                icon={<Archive size={26} className="text-amber-900" />}
                label="Шкаф-купе"
                onClick={() => handleAdd('wardrobe')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'wardrobe')}
              />
              <ToolButton
                icon={<Box size={26} className="text-amber-700" />}
                label="Тумбочка"
                onClick={() => handleAdd('nightstand')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'nightstand')}
              />
            </div>
            <ClaimedPacks tab="bedroom" owns={owns} onAdd={handleAdd} />
          </div>
        )}

        {/* 4. КУХНЯ */}
        {activeTab === 'kitchen' && (
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Кухня и Столовая</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<ChefHat size={26} className="text-slate-700" />}
                label="Гарнитур с мойкой"
                onClick={() => handleAdd('kitchen_counter')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'kitchen_counter')}
              />
              <ToolButton
                icon={<Refrigerator size={26} className="text-slate-600" />}
                label="Холодильник"
                onClick={() => handleAdd('fridge')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'fridge')}
              />
              <ToolButton
                icon={<Table size={26} className="text-amber-800" />}
                label="Обеденный стол"
                onClick={() => handleAdd('dining_table')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'dining_table')}
              />
              <ToolButton
                icon={<Armchair size={26} className="text-amber-600" />}
                label="Стул обеденный"
                onClick={() => handleAdd('chair')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'chair')}
              />
            </div>
          </div>
        )}

        {/* 5. ВАННАЯ */}
        {activeTab === 'bathroom' && (
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Сантехника</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<Bath size={26} className="text-cyan-600" />}
                label="Ванна акрил"
                onClick={() => handleAdd('bathtub')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'bathtub')}
              />
              <ToolButton
                icon={<Droplets size={26} />}
                label="Раковина с тумбой"
                onClick={() => handleAdd('sink')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'sink')}
              />
              <ToolButton
                icon={<Toilet size={26} />}
                label="Унитаз"
                onClick={() => handleAdd('toilet')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'toilet')}
              />
            </div>
          </div>
        )}

        {/* 6. ОФИС И СКЛАД */}
        {activeTab === 'office' && (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2.5">Офис и склад</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<Package size={26} className="text-blue-600" />}
                label="Стеллаж грузовой"
                onClick={() => handleAdd('rack')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'rack')}
              />
              <ToolButton
                icon={<Monitor size={26} className="text-slate-700" />}
                label="Рабочий стол"
                onClick={() => handleAdd('desk')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'desk')}
              />
              <ToolButton
                icon={<Armchair size={26} />}
                label="Офисное кресло"
                onClick={() => handleAdd('office_chair')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'office_chair')}
              />
            </div>
            <ClaimedPacks tab="office" owns={owns} onAdd={handleAdd} />
          </div>
        )}

        {/* 7. ДЕКОР И СВЕТ */}
        {activeTab === 'decor' && (
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Освещение и Зелень</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ToolButton
                icon={<LampCeiling size={26} className="text-amber-500" />}
                label="Люстра потолочная"
                onClick={() => handleAdd('chandelier')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'chandelier')}
              />
              <ToolButton
                icon={<LampWallUp size={26} className="text-[#966853]" />}
                label="Бра настенное"
                onClick={() => handleAdd('sconce')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'sconce')}
              />
              <ToolButton
                icon={<LampCeiling size={26} className="text-[#538896]" />}
                label="Подвес"
                onClick={() => handleAdd('ceiling_lamp')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'ceiling_lamp')}
              />
              <ToolButton
                icon={<Blinds size={26} className="text-[#539678]" />}
                label="Шторы"
                onClick={() => handleAdd('curtain')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'curtain')}
              />
              <ToolButton
                icon={<Minus size={26} className="text-[#538896]" />}
                label="Карниз"
                onClick={() => handleAdd('cornice')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'cornice')}
              />
              <ToolButton
                icon={<LampFloor size={26} className="text-amber-600" />}
                label="Торшер напольный"
                onClick={() => handleAdd('floor_lamp')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'floor_lamp')}
              />
              <ToolButton
                icon={<Flower2 size={26} className="text-emerald-600" />}
                label="Растение в кашпо"
                onClick={() => handleAdd('plant')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('type', 'plant')}
              />
            </div>
          </div>
        )}

        {/* 8. ЗАГРУЗКА 3D */}
        {activeTab === 'upload' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/70 text-xs text-slate-600">
              Можно загрузить <b>.rar</b>, <b>.zip</b>, <b>.max</b>, <b>.glb</b>, <b>.gltf</b>, <b>.fbx</b> или <b>.obj</b>. Архив распаковывается сам, сцена 3ds Max конвертируется в модель.
            </div>

            <button 
              type="button"
              onClick={handleUploadClick}
              className="w-full py-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50/40 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition-colors mb-3">
                <Upload size={24} />
              </div>
              <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600">Загрузить 3D файл</span>
              <span className="text-xs text-slate-400 mt-1 text-center px-4">ZIP, RAR, MAX, GLB, FBX, OBJ или glTF. Из архива берутся модели, .max конвертируется сам.</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".obj,.gltf,.glb,.fbx,.bin,.png,.jpg,.jpeg,.max,.zip,.rar"
              multiple
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>
      </div>
    </aside>
    </>
  )
}
