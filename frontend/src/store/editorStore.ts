import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import * as THREE from 'three'
import {
  isOpeningType,
  isWallType,
  nearestWall,
  snapOpeningToWall,
  wallAxes,
  wallEndpoints,
} from './wallMath'
import { reseatWalls, restingY, restsOnSurfaces, SLAB_THICKNESS, storeyAtHeight, storeyBase, storeyLevels, wallSupportY, wallsOuterBox } from './storeys'

export type ObjectType =
  // Construction
  | 'wall'
  | 'room'
  | 'partition'
  | 'floor'
  | 'roof'
  | 'door'
  | 'double_door'
  | 'arch'
  | 'window'
  | 'panoramic_window'
  | 'opening'
  | 'stairs_straight'
  | 'stairs_l'
  | 'stairs_spiral'
  // Living room
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'tv_unit'
  | 'bookshelf'
  | 'carpet'
  // Bedroom
  | 'bed_double'
  | 'bed_single'
  | 'wardrobe'
  | 'nightstand'
  // Kitchen & Dining
  | 'dining_table'
  | 'chair'
  | 'kitchen_counter'
  | 'fridge'
  // Bathroom
  | 'bathtub'
  | 'sink'
  | 'toilet'
  // Warehouse & Office
  | 'rack'
  | 'desk'
  | 'office_chair'
  // Decor & Lighting
  | 'ceiling_lamp'
  | 'chandelier'
  | 'sconce'
  | 'floor_lamp'
  | 'curtain'
  | 'cornice'
  | 'plant'
  // Primitives / Custom
  | 'block'
  | 'cylinder'
  | 'sphere'
  | 'custom'

export interface PlacedObject {
  id: string
  type: ObjectType
  name?: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
  materialType?: 'paint' | 'wood' | 'fabric' | 'metal' | 'glass' | 'tile'
  isHole: boolean
  groupId: string | null
  wallId?: string | null
  floor: number // 1, 2, 3...
  modelUrl?: string
}

export interface ToastItem {
  id: string
  title: string
  message?: string
  type: 'success' | 'error' | 'info'
}

export interface LayerState {
  walls: boolean
  furniture: boolean
  openings: boolean
  floors: boolean
}

/** Default snap step; the grid cell always equals the current snap step. */
export const SNAP_STEP = 0.5
export const SNAP_STEPS = [0.1, 0.25, 0.5, 1, 2]

export const snapToGrid = (val: number, step = useEditorStore.getState().snapStep): number => {
  return Math.round(val / step) * step
}

/** Wall thickness that fills whole grid cells for the current snap step. */
export function wallThicknessFor(step: number): number {
  if (step <= 0.1) return 0.2
  if (step <= 0.25) return 0.25
  return 0.5
}

/**
 * Snap a box so its footprint corners land on grid lines, not merely its centre.
 * Size must be a multiple of `step` for both edges to land; the near corner always does.
 */
export function snapFootprint(
  x: number,
  z: number,
  yaw: number,
  sizeX: number,
  sizeZ: number,
  step: number
): [number, number] {
  const turns = yaw / (Math.PI / 2)
  const nearest = Math.round(turns)
  if (Math.abs(turns - nearest) > 0.02) {
    return [snapToGrid(x, step), snapToGrid(z, step)]
  }
  const swap = Math.abs(nearest) % 2 === 1
  const hx = (swap ? sizeZ : sizeX) / 2
  const hz = (swap ? sizeX : sizeZ) / 2
  const minX = snapToGrid(x - hx, step)
  const minZ = snapToGrid(z - hz, step)
  return [minX + hx, minZ + hz]
}

const HISTORY_LIMIT = 100

/** Lowest allowed centre height: the bottom of any object rests on the ground, never below it. */
export const getMinY = (_type: ObjectType, scaleY: number): number => scaleY / 2

// Get default dimensions and elevation for each object type (Mockup Mode: all white by default)
export const getDefaultObjectConfig = (type: ObjectType): {
  scale: [number, number, number]
  yOffset: number
  color: string
  name: string
  isHole: boolean
  materialType: 'paint' | 'wood' | 'fabric' | 'metal' | 'glass' | 'tile'
} => {
  const white = '#ffffff'

  switch (type) {
    // Architecture
    case 'wall':
      return { scale: [4, 2.8, 0.25], yOffset: 1.4, color: white, name: 'Стена', isHole: false, materialType: 'paint' }
    case 'partition':
      return { scale: [2.5, 2.8, 0.25], yOffset: 1.4, color: white, name: 'Перегородка', isHole: false, materialType: 'paint' }
    case 'floor':
      return { scale: [5, SLAB_THICKNESS, 4], yOffset: SLAB_THICKNESS / 2, color: white, name: 'Пол', isHole: false, materialType: 'wood' }
    case 'roof':
      return { scale: [5.4, 1.4, 4.4], yOffset: 3.5, color: white, name: 'Крыша', isHole: false, materialType: 'paint' }
    case 'door':
      return { scale: [0.9, 2.1, 0.15], yOffset: 1.05, color: white, name: 'Дверь межкомнатная', isHole: true, materialType: 'wood' }
    case 'double_door':
      return { scale: [1.6, 2.1, 0.15], yOffset: 1.05, color: white, name: 'Дверь двустворчатая', isHole: true, materialType: 'wood' }
    case 'arch':
      return { scale: [1.0, 2.2, 0.2], yOffset: 1.1, color: white, name: 'Дверной проем (Арка)', isHole: true, materialType: 'paint' }
    case 'window':
      return { scale: [1.4, 1.4, 0.18], yOffset: 1.6, color: white, name: 'Окно стандартное', isHole: true, materialType: 'glass' }
    case 'panoramic_window':
      return { scale: [2.4, 2.2, 0.18], yOffset: 1.3, color: white, name: 'Окно панорамное', isHole: true, materialType: 'glass' }
    case 'opening':
      return { scale: [1, 1, 0.5], yOffset: 1.2, color: white, name: 'Проём', isHole: true, materialType: 'paint' }
    case 'stairs_straight':
      return { scale: [1, 2.8, 3], yOffset: 1.4, color: white, name: 'Прямая лестница', isHole: false, materialType: 'wood' }
    case 'stairs_l':
      return { scale: [2.5, 2.8, 2.5], yOffset: 1.4, color: white, name: 'Г-образная лестница', isHole: false, materialType: 'wood' }
    case 'stairs_spiral':
      return { scale: [2, 2.8, 2], yOffset: 1.4, color: white, name: 'Винтовая лестница', isHole: false, materialType: 'wood' }

    // Living room
    case 'sofa':
      return { scale: [2.2, 0.85, 0.95], yOffset: 0.425, color: white, name: 'Диван трехместный', isHole: false, materialType: 'fabric' }
    case 'armchair':
      return { scale: [0.9, 0.85, 0.85], yOffset: 0.425, color: white, name: 'Кресло мягкое', isHole: false, materialType: 'fabric' }
    case 'coffee_table':
      return { scale: [1.1, 0.45, 0.6], yOffset: 0.225, color: white, name: 'Журнальный столик', isHole: false, materialType: 'wood' }
    case 'tv_unit':
      return { scale: [1.8, 1.2, 0.4], yOffset: 0.6, color: white, name: 'ТВ-тумба с телевизором', isHole: false, materialType: 'wood' }
    case 'bookshelf':
      return { scale: [1.0, 2.0, 0.35], yOffset: 1.0, color: white, name: 'Стеллаж для книг', isHole: false, materialType: 'wood' }
    case 'carpet':
      return { scale: [2.4, 0.02, 1.8], yOffset: 0.01, color: white, name: 'Ковер напольный', isHole: false, materialType: 'fabric' }

    // Bedroom
    case 'bed_double':
      return { scale: [1.8, 0.9, 2.1], yOffset: 0.45, color: white, name: 'Двуспальная кровать', isHole: false, materialType: 'fabric' }
    case 'bed_single':
      return { scale: [1.0, 0.9, 2.0], yOffset: 0.45, color: white, name: 'Односпальная кровать', isHole: false, materialType: 'fabric' }
    case 'wardrobe':
      return { scale: [1.8, 2.2, 0.6], yOffset: 1.1, color: white, name: 'Шкаф-купе', isHole: false, materialType: 'wood' }
    case 'nightstand':
      return { scale: [0.5, 0.5, 0.4], yOffset: 0.25, color: white, name: 'Прикроватная тумба', isHole: false, materialType: 'wood' }

    // Kitchen & Dining
    case 'dining_table':
      return { scale: [1.6, 0.75, 0.9], yOffset: 0.375, color: white, name: 'Обеденный стол', isHole: false, materialType: 'wood' }
    case 'chair':
      return { scale: [0.48, 0.9, 0.5], yOffset: 0.45, color: white, name: 'Стул обеденный', isHole: false, materialType: 'wood' }
    case 'kitchen_counter':
      return { scale: [2.4, 0.9, 0.65], yOffset: 0.45, color: white, name: 'Кухонный гарнитур', isHole: false, materialType: 'paint' }
    case 'fridge':
      return { scale: [0.7, 1.9, 0.65], yOffset: 0.95, color: white, name: 'Холодильник', isHole: false, materialType: 'metal' }

    // Bathroom
    case 'bathtub':
      return { scale: [1.7, 0.6, 0.75], yOffset: 0.3, color: white, name: 'Ванна акриловая', isHole: false, materialType: 'paint' }
    case 'sink':
      return { scale: [0.8, 0.85, 0.5], yOffset: 0.425, color: white, name: 'Раковина с тумбой', isHole: false, materialType: 'paint' }
    case 'toilet':
      return { scale: [0.4, 0.75, 0.65], yOffset: 0.375, color: white, name: 'Унитаз', isHole: false, materialType: 'paint' }

    // Warehouse & Office
    case 'rack':
      return { scale: [2.0, 2.4, 0.8], yOffset: 1.2, color: white, name: 'Складской стеллаж', isHole: false, materialType: 'metal' }
    case 'desk':
      return { scale: [1.4, 0.75, 0.7], yOffset: 0.375, color: white, name: 'Рабочий стол', isHole: false, materialType: 'wood' }
    case 'office_chair':
      return { scale: [0.6, 0.95, 0.6], yOffset: 0.475, color: white, name: 'Офисное кресло', isHole: false, materialType: 'fabric' }

    // Decor & Light
    case 'ceiling_lamp':
      return { scale: [0.6, 0.5, 0.6], yOffset: 2.55, color: white, name: 'Подвес', isHole: false, materialType: 'metal' }
    case 'chandelier':
      return { scale: [0.9, 0.7, 0.9], yOffset: 2.35, color: white, name: 'Люстра потолочная', isHole: false, materialType: 'metal' }
    case 'sconce':
      return { scale: [0.35, 0.5, 0.4], yOffset: 1.6, color: white, name: 'Бра настенное', isHole: false, materialType: 'metal' }
    case 'curtain':
      return { scale: [1.6, 2.4, 0.15], yOffset: 1.2, color: white, name: 'Шторы', isHole: false, materialType: 'fabric' }
    case 'cornice':
      return { scale: [2, 0.08, 0.14], yOffset: 2.6, color: white, name: 'Карниз', isHole: false, materialType: 'metal' }
    case 'floor_lamp':
      return { scale: [0.45, 1.6, 0.45], yOffset: 0.8, color: white, name: 'Торшер напольный', isHole: false, materialType: 'metal' }
    case 'plant':
      return { scale: [0.5, 1.1, 0.5], yOffset: 0.55, color: white, name: 'Комнатное растение', isHole: false, materialType: 'paint' }

    // Primitives
    case 'block':
      return { scale: [1, 1, 1], yOffset: 0.5, color: white, name: 'Куб', isHole: false, materialType: 'paint' }
    case 'cylinder':
      return { scale: [1, 1, 1], yOffset: 0.5, color: white, name: 'Цилиндр', isHole: false, materialType: 'paint' }
    case 'sphere':
      return { scale: [1, 1, 1], yOffset: 0.5, color: white, name: 'Сфера', isHole: false, materialType: 'paint' }
    case 'custom':
    default:
      return { scale: [1, 1, 1], yOffset: 0.5, color: white, name: 'Пользовательский объект', isHole: false, materialType: 'paint' }
  }
}

interface EditorState {
  objects: PlacedObject[]
  selectedObjectIds: string[]
  transformMode: 'translate' | 'rotate' | 'scale'
  snap: boolean
  viewMode: '3D' | '2D' | 'FPV'
  isTransforming: boolean
  gestureOpen: boolean
  
  // Floors and Layers
  currentFloor: number
  layers: LayerState
  isCatalogOpen: boolean

  // In-app Toasts
  toasts: ToastItem[]
  
  // History for Undo/Redo
  past: PlacedObject[][]
  future: PlacedObject[][]

  // Person Mode
  person: { active: boolean; isFPV: boolean; position: [number, number, number]; rotation: number }
  togglePerson: () => void
  toggleFPV: () => void
  updatePersonState: (updates: Partial<{ active: boolean; isFPV: boolean; position: [number, number, number]; rotation: number }>) => void

  // Actions
  addObject: (type: ObjectType, position?: [number, number, number], modelUrl?: string) => string
  addRoom: (width?: number, length?: number, wallHeight?: number) => void
  removeObjects: (ids: string[]) => void
  clearObjects: () => void
  selectObjects: (ids: string[], mode?: 'set' | 'toggle' | 'add') => void
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void
  setSnap: (snap: boolean) => void
  snapStep: number
  setSnapStep: (step: number) => void
  setViewMode: (mode: '3D' | '2D' | 'FPV') => void
  toggleViewMode: () => void
  setIsTransforming: (val: boolean) => void
  setCurrentFloor: (floor: number) => void
  toggleLayer: (layer: keyof LayerState) => void
  toggleCatalog: () => void
  showToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
  updateObjectTransform: (id: string, position: [number, number, number], rotation: [number, number, number], scale: [number, number, number]) => void
  updateObjectProperties: (id: string, updates: Partial<PlacedObject>) => void
  duplicateObject: (id: string) => void
  rotateObject90: (id: string) => void
  groupSelectedObjects: (ids: string[]) => void
  ungroupObjects: (groupIdOrIds?: string | string[]) => void
  detachFromGroup: (id: string) => void
  detachObjects: (ids: string[]) => void
  snapAndJoinWalls: (wallId: string) => void
  setWallLength: (wallId: string, newLength: number, anchor?: 'left' | 'right' | 'center') => void
  offsetWall: (wallId: string, distance: number) => void
  snapOpening: (id: string) => void
  selectGroup: (groupId: string) => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
}

const recordHistory = (state: EditorState): { past: PlacedObject[][], future: PlacedObject[][] } => {
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.objects],
    future: []
  }
}

/** After an edit, walls go back onto the floor of their storey (raising a slab lifts the storey above it). */
const withReseatedWalls = <S extends { objects: PlacedObject[] }>(fn: (state: S) => Partial<S> | S) =>
  (state: S): Partial<S> | S => {
    const result = fn(state)
    if (result === state || !result.objects) return result
    return { ...result, objects: reseatWalls(result.objects) }
  }

/** Two wall ends count as joined when they overlap within this distance (walls overlap by their thickness at corners). */
const WALL_JOIN_TOL = 0.3

/** Resize a wall by moving one of its ends (index 0 = +X end, 1 = -X end) by `delta`, keeping its yaw. */
const resizeWallEnd = (wall: PlacedObject, endIndex: 0 | 1, delta: THREE.Vector3): PlacedObject => {
  const { axisX } = wallAxes(wall.rotation[1])
  const along = delta.dot(axisX)
  const nextLength = Math.max(0.1, wall.scale[0] + (endIndex === 0 ? along : -along))
  const shift = axisX.clone().multiplyScalar(along / 2)
  return {
    ...wall,
    position: [wall.position[0] + shift.x, wall.position[1], wall.position[2] + shift.z],
    scale: [nextLength, wall.scale[1], wall.scale[2]],
  }
}

/**
 * Replace a wall with an edited copy (different length and/or position) while keeping every
 * joined wall attached: perpendicular neighbours are translated, parallel neighbours are
 * resized, recursively. Returns the new objects array (or the same one if nothing changed).
 */
const editWallKeepingJoints = (objects: PlacedObject[], wallId: string, nextWall: PlacedObject): PlacedObject[] => {
  const wall = objects.find(o => o.id === wallId)
  if (!wall || !isWallType(wall.type)) return objects

  const ends = wallEndpoints(wall)
  const nextEnds = wallEndpoints(nextWall)
  const endDeltas = [nextEnds[0].clone().sub(ends[0]), nextEnds[1].clone().sub(ends[1])]
  if (endDeltas.every(d => d.length() < 0.0001)) return objects

  const map = new Map(objects.map(o => [o.id, o]))
  // Wall ends already handled: "id:0" / "id:1". A translated wall has both ends marked,
  // a resized wall only the end that moved, so its other end can still follow a different corner.
  const visited = new Set<string>()
  const touched = new Set<string>()
  const translated = new Map<string, THREE.Vector3>()

  const movePoint = (point: THREE.Vector3, delta: THREE.Vector3) => {
    const deltaLen = delta.length()
    if (deltaLen < 0.0001) return
    for (const other of Array.from(map.values())) {
      if (!isWallType(other.type) || other.floor !== wall.floor) continue
      // Only walls glued into the same structure follow; detached walls stay where they are.
      if (!wall.groupId || other.groupId !== wall.groupId) continue
      const ends = wallEndpoints(other)
      for (let j = 0; j < 2; j++) {
        if (visited.has(`${other.id}:${j}`)) continue
        if (ends[j].distanceTo(point) > WALL_JOIN_TOL) continue
        touched.add(other.id)
        const otherAxis = wallAxes(other.rotation[1]).axisX
        const alongOther = Math.abs(delta.dot(otherAxis))
        if (alongOther < deltaLen * 0.5) {
          // Mostly perpendicular: carry the whole wall along, then push whatever hangs on its far end.
          visited.add(`${other.id}:0`)
          visited.add(`${other.id}:1`)
          map.set(other.id, {
            ...other,
            position: [other.position[0] + delta.x, other.position[1], other.position[2] + delta.z],
          })
          translated.set(other.id, (translated.get(other.id) || new THREE.Vector3()).add(delta))
          movePoint(ends[1 - j], delta)
        } else {
          visited.add(`${other.id}:${j}`)
          map.set(other.id, resizeWallEnd(other, j as 0 | 1, delta))
        }
        break
      }
    }
  }

  visited.add(`${wall.id}:0`)
  visited.add(`${wall.id}:1`)
  touched.add(wall.id)
  map.set(wall.id, nextWall)
  if (Math.abs(nextWall.scale[0] - wall.scale[0]) < 0.0001) {
    // Same length: the wall was pushed sideways, so its openings travel with it.
    translated.set(wall.id, new THREE.Vector3(
      nextWall.position[0] - wall.position[0], 0, nextWall.position[2] - wall.position[2]
    ))
  }
  movePoint(ends[0], endDeltas[0])
  movePoint(ends[1], endDeltas[1])

  // Openings ride along with translated walls and stay clamped on resized ones.
  for (const o of Array.from(map.values())) {
    if (!isOpeningType(o.type) || !o.wallId || !touched.has(o.wallId)) continue
    const host = map.get(o.wallId)
    if (!host) continue
    const shift = translated.get(o.wallId)
    const moved = shift
      ? { ...o, position: [o.position[0] + shift.x, o.position[1], o.position[2] + shift.z] as [number, number, number] }
      : o
    map.set(o.id, { ...moved, ...snapOpeningToWall(moved, host) })
  }

  // A room floor follows the footprint of its walls.
  if (wall.groupId) {
    const groupWalls = Array.from(map.values()).filter(o => o.groupId === wall.groupId && isWallType(o.type))
    const floors = Array.from(map.values()).filter(o => o.groupId === wall.groupId && o.type === 'floor')
    if (groupWalls.length >= 3 && floors.length === 1 && Math.abs(floors[0].rotation[1]) < 0.01) {
      // The floor covers the outer faces of the walls, so the walls stand on it instead of hanging past it.
      const outer = wallsOuterBox(groupWalls)
      const floorObj = floors[0]
      map.set(floorObj.id, {
        ...floorObj,
        position: [(outer.minX + outer.maxX) / 2, floorObj.position[1], (outer.minZ + outer.maxZ) / 2],
        scale: [Math.max(0.1, outer.maxX - outer.minX), floorObj.scale[1], Math.max(0.1, outer.maxZ - outer.minZ)],
      })
    }
  }

  return objects.map(o => map.get(o.id) || o)
}

/** Change a wall's length. 'left' anchors the -X end, 'right' anchors the +X end, 'center' grows both ways. */
const changeWallLength = (
  objects: PlacedObject[],
  wallId: string,
  newLength: number,
  anchor: 'left' | 'right' | 'center'
): PlacedObject[] => {
  const wall = objects.find(o => o.id === wallId)
  if (!wall || !isWallType(wall.type)) return objects
  const target = Math.max(0.1, newLength)
  const diff = target - wall.scale[0]
  if (Math.abs(diff) < 0.0001) return objects

  const { axisX } = wallAxes(wall.rotation[1])
  let nextWall: PlacedObject
  if (anchor === 'center') {
    nextWall = { ...wall, scale: [target, wall.scale[1], wall.scale[2]] }
  } else {
    const endIndex: 0 | 1 = anchor === 'left' ? 0 : 1
    nextWall = resizeWallEnd(wall, endIndex, axisX.clone().multiplyScalar(anchor === 'left' ? diff : -diff))
  }
  return editWallKeepingJoints(objects, wallId, nextWall)
}

/** Push a wall along its own normal (positive = local +Z); the walls joined to its ends stretch or shrink to follow. */
const offsetWallSideways = (objects: PlacedObject[], wallId: string, distance: number): PlacedObject[] => {
  const wall = objects.find(o => o.id === wallId)
  if (!wall || !isWallType(wall.type) || Math.abs(distance) < 0.0001) return objects
  const { axisZ } = wallAxes(wall.rotation[1])
  const nextWall: PlacedObject = {
    ...wall,
    position: [wall.position[0] + axisZ.x * distance, wall.position[1], wall.position[2] + axisZ.z * distance],
  }
  return editWallKeepingJoints(objects, wallId, nextWall)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  objects: [],
  selectedObjectIds: [],
  transformMode: 'translate',
  snap: true,
  viewMode: '3D',
  isTransforming: false,
  gestureOpen: false,
  // 0 = the whole building is workable; a storey number makes the other storeys translucent.
  currentFloor: 0,
  layers: {
    walls: true,
    furniture: true,
    openings: true,
    floors: true
  },
  isCatalogOpen: true,
  toasts: [],
  past: [],
  future: [],

  person: {
    active: false,
    isFPV: false,
    position: [0, 0.05, 0],
    rotation: 0
  },

  togglePerson: () => set(state => ({
    person: { ...state.person, active: !state.person.active, isFPV: false }
  })),

  toggleFPV: () => set(state => {
    const isFPV = !state.person.isFPV
    return {
      person: { ...state.person, active: true, isFPV },
      viewMode: isFPV ? 'FPV' : '3D'
    }
  }),

  updatePersonState: (updates) => set(state => ({
    person: { ...state.person, ...updates }
  })),

  addObject: (type, position, modelUrl) => {
    const config = getDefaultObjectConfig(type)
    const snap = get().snap
    const step = get().snapStep
    const scale: [number, number, number] = isWallType(type)
      ? [config.scale[0], config.scale[1], wallThicknessFor(step)]
      : config.scale

    let x = 0
    let z = 0
    let y = config.yOffset

    const currentFloor = Math.max(1, get().currentFloor)
    const levels = storeyLevels(get().objects)
    const baseElevation = storeyBase(levels, currentFloor)

    if (position) {
      if (snap) {
        ;[x, z] = snapFootprint(position[0], position[2], 0, scale[0], scale[2], step)
      } else {
        x = position[0]
        z = position[2]
      }
    }

    if (isWallType(type)) {
      y = baseElevation + scale[1] / 2
    } else if (position && position[1] !== undefined) {
      y = position[1]
    } else {
      y = baseElevation + config.yOffset
    }

    const newId = uuidv4()
    if (restsOnSurfaces(type)) {
      const probe = { id: newId, type, groupId: null, rotation: [0, 0, 0], scale, position: [x, y, z] } as PlacedObject
      y = restingY(get().objects, probe, [x, Math.max(getMinY(type, scale[1]), y), z], scale[1])
    }
    const detectedFloor = isWallType(type) ? currentFloor : storeyAtHeight(levels, y - scale[1] / 2)

    let newObj: PlacedObject = {
      id: newId,
      type,
      name: config.name,
      position: [x, y, z],
      rotation: [0, 0, 0],
      scale,
      color: config.color,
      materialType: config.materialType,
      isHole: config.isHole,
      groupId: null,
      wallId: null,
      floor: detectedFloor,
      modelUrl
    }

    if (isOpeningType(type) && type !== 'opening') {
      const wall = nearestWall(newObj.position, get().objects.filter(o => isWallType(o.type)), 4)
      if (wall) {
        newObj = { ...newObj, ...snapOpeningToWall(newObj, wall) }
      }
    }

    set((state) => ({
      ...recordHistory(state),
      objects: [...state.objects, newObj],
      selectedObjectIds: [newId]
    }))

    if (isWallType(type)) get().snapAndJoinWalls(newId)

    return newId
  },

  addRoom: (width = 5, length = 4, wallHeight = 2.8) => {
    const snap = get().snap
    const step = get().snapStep
    const w = snap ? snapToGrid(width) : width
    const l = snap ? snapToGrid(length) : length
    const h = wallHeight
    const wallThick = snap ? wallThicknessFor(step) : 0.25
    const slab = SLAB_THICKNESS
    const roomId = uuidv4()
    const white = '#ffffff'
    const curFloor = Math.max(1, get().currentFloor)
    const base = storeyBase(storeyLevels(get().objects), curFloor)
    // Walls stand on the slab; the slab is the full outer footprint, edges on the grid.
    const wallY = base + slab + h / 2

    const floorObj: PlacedObject = {
      id: uuidv4(),
      type: 'floor',
      name: `Пол комнаты (${w}x${l}м)`,
      position: [0, base + slab / 2, 0],
      rotation: [0, 0, 0],
      scale: [w, slab, l],
      color: white,
      materialType: 'wood',
      isHole: false,
      groupId: roomId,
      wallId: null,
      floor: curFloor
    }

    const makeWall = (
      name: string,
      position: [number, number, number],
      yaw: number,
      lengthM: number
    ): PlacedObject => ({
      id: uuidv4(),
      type: 'wall',
      name,
      position,
      rotation: [0, yaw, 0],
      scale: [lengthM, h, wallThick],
      color: white,
      materialType: 'paint',
      isHole: false,
      groupId: roomId,
      wallId: null,
      floor: curFloor
    })

    // Outer faces sit on the floor edge. North and south run the full width; east and west fit between them.
    const northWall = makeWall('Северная стена', [0, wallY, -l / 2 + wallThick / 2], 0, w)
    const southWall = makeWall('Южная стена', [0, wallY, l / 2 - wallThick / 2], 0, w)
    const sideLen = Math.max(step, l - wallThick * 2)
    const westWall = makeWall('Западная стена', [-w / 2 + wallThick / 2, wallY, 0], Math.PI / 2, sideLen)
    const eastWall = makeWall('Восточная стена', [w / 2 - wallThick / 2, wallY, 0], -Math.PI / 2, sideLen)

    set((state) => ({
      ...recordHistory(state),
      objects: [...state.objects, floorObj, northWall, southWall, westWall, eastWall],
      selectedObjectIds: [floorObj.id]
    }))
  },

  removeObjects: (ids) => set((state) => {
    const removed = new Set(ids)
    return {
      ...recordHistory(state),
      objects: state.objects.filter(obj => !removed.has(obj.id) && !(obj.wallId && removed.has(obj.wallId))),
      selectedObjectIds: []
    }
  }),

  clearObjects: () => set((state) => ({
    ...recordHistory(state),
    objects: [],
    selectedObjectIds: []
  })),

  selectObjects: (ids, mode = 'set') => set((state) => {
    const unique = (list: string[]) => {
      const seen = new Set<string>()
      const result: string[] = []
      list.forEach(id => {
        if (!seen.has(id) && state.objects.some(o => o.id === id)) {
          seen.add(id)
          result.push(id)
        }
      })
      return result
    }

    if (mode === 'set') return { selectedObjectIds: unique(ids) }
    if (mode === 'add') return { selectedObjectIds: unique([...state.selectedObjectIds, ...ids]) }
    if (mode === 'toggle') {
      const targetId = ids[0]
      if (!targetId) return state
      const next = state.selectedObjectIds.includes(targetId)
        ? state.selectedObjectIds.filter(id => id !== targetId)
        : unique([targetId, ...state.selectedObjectIds])
      return { selectedObjectIds: next }
    }
    return { selectedObjectIds: unique(ids) }
  }),

  selectGroup: (groupId) => set((state) => ({
    selectedObjectIds: state.objects.filter(o => o.groupId === groupId).map(o => o.id)
  })),

  beginGesture: () => set((state) => {
    if (state.gestureOpen) return state
    return { ...recordHistory(state), gestureOpen: true }
  }),

  endGesture: () => set({ gestureOpen: false }),

  setTransformMode: (mode) => set({ transformMode: mode }),
  
  setSnap: (snap) => set({ snap }),

  snapStep: SNAP_STEP,
  setSnapStep: (snapStep) => set({ snapStep, snap: true }),

  setViewMode: (viewMode) => set({ viewMode }),

  toggleViewMode: () => set((state) => ({ viewMode: state.viewMode === '3D' ? '2D' : '3D' })),

  setIsTransforming: (isTransforming) => set({ isTransforming }),

  setCurrentFloor: (currentFloor) => set({ currentFloor }),

  toggleLayer: (layer) => set((state) => ({
    layers: {
      ...state.layers,
      [layer]: !state.layers[layer]
    }
  })),

  toggleCatalog: () => set((state) => ({ isCatalogOpen: !state.isCatalogOpen })),

  showToast: (title, message, type = 'info') => {
    const id = uuidv4()
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id, title, message, type }]
    }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  updateObjectTransform: (id, position, rotation, scale) => set(withReseatedWalls((state) => {
    const obj = state.objects.find(o => o.id === id)
    if (!obj) return state

    // No negative scaling / mirroring. The floor is only 4 cm thick, so the lower bound must stay below that.
    const clampedScale: [number, number, number] = [
      Math.max(0.01, Math.abs(scale[0])),
      Math.max(0.01, Math.abs(scale[1])),
      Math.max(0.01, Math.abs(scale[2]))
    ]

    const wallLike = isWallType(obj.type)
    const levels = storeyLevels(state.objects)
    let clampedY = position[1]
    if (wallLike) {
      const support = wallSupportY(state.objects, { ...obj, position: [position[0], position[1], position[2]], scale: clampedScale })
      const bottom = position[1] - clampedScale[1] / 2
      clampedY = bottom < support ? support + clampedScale[1] / 2 : position[1]
    } else {
      const minY = getMinY(obj.type, clampedScale[1])
      clampedY = Math.max(minY, position[1])
      if (restsOnSurfaces(obj.type)) {
        // Furniture and slabs stand on the floor under them and never sink through it.
        clampedY = restingY(state.objects, obj, [position[0], clampedY, position[2]], clampedScale[1])
      }
    }

    const clampedPos: [number, number, number] = [position[0], clampedY, position[2]]
    const dx = clampedPos[0] - obj.position[0]
    const dy = clampedPos[1] - obj.position[1]
    const dz = clampedPos[2] - obj.position[2]
    const dRotY = rotation[1] - obj.rotation[1]
    const scaleChanged = clampedScale.some((value, index) => Math.abs(value - obj.scale[index]) > 0.0001)
    const moved = Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001 || Math.abs(dz) > 0.0001 || Math.abs(dRotY) > 0.0001
    const isMultiSelected = state.selectedObjectIds.includes(id) && state.selectedObjectIds.length > 1
    const grouped = Boolean(obj.groupId)

    const place = (item: PlacedObject, nextPos: [number, number, number], nextRot: [number, number, number], nextScale: [number, number, number]) => {
      const nextFloor = isWallType(item.type) || item.wallId || (item.type === 'floor' && item.groupId)
        ? item.floor
        : storeyAtHeight(levels, nextPos[1] - nextScale[1] / 2)
      return { ...item, position: nextPos, rotation: nextRot, scale: nextScale, floor: nextFloor }
    }

    // Pulling a wall up or down moves that wall and the openings in it, not the whole room.
    const verticalOnly = wallLike
      && !scaleChanged
      && Math.abs(dy) > 0.0001
      && Math.abs(dx) < 0.0001
      && Math.abs(dz) < 0.0001
      && Math.abs(dRotY) < 0.0001
    if (verticalOnly) {
      return {
        objects: state.objects.map(o => {
          if (o.id === id) return place(o, clampedPos, rotation, clampedScale)
          if (o.wallId === id) {
            return place(o, [o.position[0], o.position[1] + dy, o.position[2]], o.rotation, o.scale)
          }
          return o
        })
      }
    }

    // A wall's length change is propagated to the walls glued to it so the room stays closed.
    if (wallLike && Math.abs(clampedScale[0] - obj.scale[0]) > 0.0001) {
      const resized = changeWallLength(state.objects, id, clampedScale[0], 'center')
      return {
        objects: resized.map(o =>
          o.id === id
            ? place(o, [o.position[0], clampedY, o.position[2]], rotation, [o.scale[0], clampedScale[1], clampedScale[2]])
            : o
        )
      }
    }

    if (!scaleChanged && moved && (isMultiSelected || grouped || wallLike || !!obj.wallId)) {
      const cosA = Math.cos(dRotY)
      const sinA = Math.sin(dRotY)
      const pivotX = obj.position[0]
      const pivotZ = obj.position[2]
      const idsToMove = new Set(isMultiSelected ? state.selectedObjectIds : [id])
      idsToMove.add(id)
      if (obj.groupId) {
        state.objects.filter(item => item.groupId === obj.groupId).forEach(item => idsToMove.add(item.id))
      }
      const movedWallIds = new Set(
        state.objects.filter(o => idsToMove.has(o.id) && isWallType(o.type)).map(o => o.id)
      )
      // The wall being dragged may rise or drop. The rest of the room stays at its height.
      const structural = movedWallIds.size > 0
      const primaryY = clampedY
      const groupDy = structural ? 0 : dy
      const primaryPos: [number, number, number] = [clampedPos[0], primaryY, clampedPos[2]]

      const spin = (item: PlacedObject) => {
        const relX = item.position[0] - pivotX
        const relZ = item.position[2] - pivotZ
        const y = isWallType(item.type)
          ? item.position[1] + groupDy
          : Math.max(getMinY(item.type, item.scale[1]), item.position[1] + groupDy)
        const nextPos: [number, number, number] = [
          clampedPos[0] + relX * cosA - relZ * sinA,
          y,
          clampedPos[2] + relX * sinA + relZ * cosA
        ]
        const nextRot: [number, number, number] = [item.rotation[0], item.rotation[1] + dRotY, item.rotation[2]]
        return place(item, nextPos, nextRot, item.scale)
      }

      return {
        objects: state.objects.map(o => {
          if (o.id === id) return place(o, primaryPos, rotation, clampedScale)
          if (idsToMove.has(o.id)) return spin(o)
          if (o.wallId && movedWallIds.has(o.wallId)) return spin(o)
          return o
        })
      }
    }

    return {
      objects: state.objects.map(o =>
        o.id === id ? place(o, clampedPos, rotation, clampedScale) : o
      )
    }
  })),

  snapAndJoinWalls: (wallId) => set((state) => {
    const wall = state.objects.find(o => o.id === wallId)
    if (!wall || !isWallType(wall.type)) return state

    const SNAP_DIST = 0.45
    const pts1 = wallEndpoints(wall)
    let partner: PlacedObject | null = null
    let bestDx = 0
    let bestDz = 0
    let bestDist = SNAP_DIST

    for (const other of state.objects) {
      if (other.id === wallId || !isWallType(other.type)) continue
      // Walls of the same room are already glued together; look for a new neighbour instead.
      if (wall.groupId && other.groupId === wall.groupId) continue
      const pts2 = wallEndpoints(other)
      for (const p1 of pts1) {
        for (const p2 of pts2) {
          const dx = p2.x - p1.x
          const dz = p2.z - p1.z
          const dist = Math.hypot(dx, dz)
          if (dist < bestDist) {
            bestDist = dist
            bestDx = dist > 0.01 ? dx : 0
            bestDz = dist > 0.01 ? dz : 0
            partner = other
          }
        }
      }
    }

    if (!partner) return state

    const shared = wall.groupId || partner.groupId || uuidv4()
    const previous = new Set([wall.groupId, partner.groupId].filter(Boolean) as string[])

    // The dragged wall moves together with everything already glued to it (its whole room),
    // so a snap never tears a wall out of its group.
    const movingIds = new Set<string>([wall.id])
    if (wall.groupId) {
      state.objects.forEach(o => { if (o.groupId === wall.groupId) movingIds.add(o.id) })
    }
    state.objects.forEach(o => { if (o.wallId && movingIds.has(o.wallId)) movingIds.add(o.id) })

    return {
      objects: state.objects.map(o => {
        const inPair = o.id === wall.id || o.id === partner!.id
        const inOldGroup = Boolean(o.groupId && previous.has(o.groupId))
        const shift = movingIds.has(o.id)
        if (!inPair && !inOldGroup && !shift) return o
        return {
          ...o,
          groupId: o.type === 'floor' || isWallType(o.type) || inOldGroup ? shared : o.groupId,
          position: shift
            ? [o.position[0] + bestDx, o.position[1], o.position[2] + bestDz] as [number, number, number]
            : o.position
        }
      })
    }
  }),

  setWallLength: (wallId, newLength, anchor = 'center') => set((state) => {
    const next = changeWallLength(state.objects, wallId, newLength, anchor)
    if (next === state.objects) return state
    return {
      ...(state.gestureOpen ? {} : recordHistory(state)),
      objects: next
    }
  }),

  offsetWall: (wallId, distance) => set((state) => {
    const next = offsetWallSideways(state.objects, wallId, distance)
    if (next === state.objects) return state
    return {
      ...(state.gestureOpen ? {} : recordHistory(state)),
      objects: next
    }
  }),

  snapOpening: (id) => set((state) => {
    const opening = state.objects.find(o => o.id === id)
    if (!opening || !isOpeningType(opening.type)) return state
    const walls = state.objects.filter(o => isWallType(o.type))
    const reach = opening.type === 'opening' ? 0.35 : 1
    const current = opening.wallId ? walls.find(w => w.id === opening.wallId) : null
    const keepCurrent = current ? nearestWall(opening.position, [current], opening.type === 'opening' ? 0.55 : 0.75) : null
    const wall = keepCurrent || nearestWall(opening.position, walls, reach)
    if (!wall) {
      if (!opening.wallId) return state
      return {
        objects: state.objects.map(o => o.id === id ? { ...o, wallId: null } : o)
      }
    }
    const snapped = snapOpeningToWall(opening, wall)
    return {
      objects: state.objects.map(o => o.id === id ? { ...o, ...snapped } : o)
    }
  }),

  updateObjectProperties: (id, updates) => set((state) => ({
    ...(state.gestureOpen ? {} : recordHistory(state)),
    objects: state.objects.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    )
  })),

  duplicateObject: (id) => {
    const state = get()
    const target = state.objects.find(o => o.id === id)
    if (!target) return

    const offset = 0.5
    const newId = uuidv4()
    const newObj: PlacedObject = {
      ...target,
      id: newId,
      name: `${target.name || target.type} (копия)`,
      position: [
        target.position[0] + offset,
        target.position[1],
        target.position[2] + offset
      ],
      groupId: null,
      wallId: null
    }

    set({
      ...recordHistory(state),
      objects: [...state.objects, newObj],
      selectedObjectIds: [newId]
    })
  },

  rotateObject90: (id) => set((state) => {
    const target = state.objects.find(o => o.id === id)
    if (!target) return state

    const angle = Math.PI / 2
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const selectedGroupCount = target.groupId
      ? state.selectedObjectIds.filter(sid => state.objects.some(o => o.id === sid && o.groupId === target.groupId)).length
      : 0

    const spinAround = (obj: PlacedObject, cx: number, cz: number) => {
      const relX = obj.position[0] - cx
      const relZ = obj.position[2] - cz
      return {
        ...obj,
        position: [cx + relX * cosA - relZ * sinA, obj.position[1], cz + relX * sinA + relZ * cosA] as [number, number, number],
        rotation: [obj.rotation[0], obj.rotation[1] + angle, obj.rotation[2]] as [number, number, number]
      }
    }

    // Walls never leave their room: rotating one rotates the whole group.
    if (target.groupId && (selectedGroupCount > 1 || isWallType(target.type) || target.type === 'floor')) {
      const groupMembers = state.objects.filter(o => o.groupId === target.groupId)
      const cx = groupMembers.reduce((sum, m) => sum + m.position[0], 0) / groupMembers.length
      const cz = groupMembers.reduce((sum, m) => sum + m.position[2], 0) / groupMembers.length
      const wallIds = new Set(groupMembers.filter(o => isWallType(o.type)).map(o => o.id))
      return {
        ...recordHistory(state),
        objects: state.objects.map(obj => {
          if (obj.groupId === target.groupId) return spinAround(obj, cx, cz)
          if (obj.wallId && wallIds.has(obj.wallId)) return spinAround(obj, cx, cz)
          return obj
        })
      }
    }

    const cx = target.position[0]
    const cz = target.position[2]
    return {
      ...recordHistory(state),
      objects: state.objects.map(obj => {
        if (obj.id === id) return spinAround(obj, cx, cz)
        if (isWallType(target.type) && obj.wallId === id) return spinAround(obj, cx, cz)
        return obj
      })
    }
  }),

  groupSelectedObjects: (ids) => {
    const state = get()
    if (ids.length < 2) return
    const groupId = uuidv4()
    set({
      ...recordHistory(state),
      objects: state.objects.map(obj => 
        ids.includes(obj.id) ? { ...obj, groupId } : obj
      ),
      selectedObjectIds: ids
    })
    get().showToast('Сгруппировано', `Объединено ${ids.length} объектов в единый блок`, 'success')
  },

  ungroupObjects: (groupIdOrIds?: string | string[]) => {
    const state = get()
    const targetGroupIds = new Set<string>()
    if (typeof groupIdOrIds === 'string') {
      targetGroupIds.add(groupIdOrIds)
    } else if (Array.isArray(groupIdOrIds)) {
      (groupIdOrIds as string[]).forEach((id: string) => {
        const obj = state.objects.find(o => o.id === id)
        if (obj?.groupId) targetGroupIds.add(obj.groupId)
      })
    } else {
      state.selectedObjectIds.forEach(id => {
        const obj = state.objects.find(o => o.id === id)
        if (obj?.groupId) targetGroupIds.add(obj.groupId)
      })
    }

    if (targetGroupIds.size === 0) return

    // Taking a structure apart also frees the doors and windows sitting in its walls.
    const groupWallIds = new Set(
      state.objects.filter(o => o.groupId && targetGroupIds.has(o.groupId) && isWallType(o.type)).map(o => o.id)
    )
    set({
      ...recordHistory(state),
      objects: state.objects.map(obj => {
        if (obj.groupId && targetGroupIds.has(obj.groupId)) return { ...obj, groupId: null, wallId: null }
        if (obj.wallId && groupWallIds.has(obj.wallId)) return { ...obj, wallId: null }
        return obj
      }),
      selectedObjectIds: state.selectedObjectIds
    })
    get().showToast('Разделено', 'Составной блок разделен на отдельные объекты', 'info')
  },

  detachFromGroup: (id) => get().detachObjects([id]),

  detachObjects: (ids) => {
    const state = get()
    const detached = new Set(ids.filter(id => {
      const o = state.objects.find(item => item.id === id)
      return Boolean(o && (o.groupId || o.wallId))
    }))
    if (detached.size === 0) return
    const touchedGroups = new Set(
      state.objects.filter(o => detached.has(o.id) && o.groupId).map(o => o.groupId as string)
    )
    let updated = state.objects.map(o => detached.has(o.id) ? { ...o, groupId: null, wallId: null } : o)
    // A group left with a single member is no longer a group.
    touchedGroups.forEach(groupId => {
      const left = updated.filter(o => o.groupId === groupId)
      if (left.length === 1) updated = updated.map(o => o.groupId === groupId ? { ...o, groupId: null } : o)
    })
    set({
      ...recordHistory(state),
      objects: updated,
      selectedObjectIds: ids
    })
    get().showToast('Отделено', detached.size > 1 ? `Отделено объектов: ${detached.size}` : 'Объект больше ни с чем не связан', 'info')
  },

  undo: () => set((state) => {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    const newPast = state.past.slice(0, state.past.length - 1)
    return {
      past: newPast,
      future: [state.objects, ...state.future],
      objects: previous,
      selectedObjectIds: []
    }
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state
    const next = state.future[0]
    const newFuture = state.future.slice(1)
    return {
      past: [...state.past, state.objects].slice(-HISTORY_LIMIT),
      future: newFuture,
      objects: next,
      selectedObjectIds: []
    }
  })
}))
