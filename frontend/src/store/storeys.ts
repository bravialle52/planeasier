import type { PlacedObject } from './editorStore'
import { FLOOR_HEIGHT, hangsInAir, isOpeningType, isWallType, wallAxes, wallEndpoints } from './wallMath'

/** Room slabs are this thick; walls stand on top of them. */
export const SLAB_THICKNESS = 0.1

/** A floor slab whose top is higher than this starts a new storey (the room's own floor is a thin slab). */
const LEVEL_MIN = 0.5
/** Slabs whose tops differ by less than this belong to the same storey level. */
const LEVEL_TOL = 0.3

/** Distance within which walls and slabs stick to each other while being dragged. */
export const MAGNET_DIST = 0.35
/** An object hovering this close above a surface drops onto it. */
const REST_MAGNET = 0.15

const slabTop = (o: PlacedObject) => o.position[1] + o.scale[1] / 2

/**
 * Storey levels derived from the building itself: ground (0) plus the top of every raised floor slab.
 * Closing a room with a slab and lifting it to any height defines where the next storey starts.
 */
export function storeyLevels(objects: PlacedObject[]): number[] {
  const tops = objects
    .filter(o => o.type === 'floor')
    .map(slabTop)
    .filter(t => t > LEVEL_MIN)
    .sort((a, b) => a - b)
  const levels = [0]
  for (const t of tops) {
    if (t - levels[levels.length - 1] > LEVEL_TOL) levels.push(t)
  }
  return levels
}

/** Height of the floor of a storey (1-based). Storeys above the last slab are FLOOR_HEIGHT apart. */
export function storeyBase(levels: number[], storey: number): number {
  const index = Math.max(1, storey) - 1
  if (index < levels.length) return levels[index]
  return levels[levels.length - 1] + (index - levels.length + 1) * FLOOR_HEIGHT
}

export function storeyAtHeight(levels: number[], y: number): number {
  let storey = 1
  levels.forEach((level, i) => { if (y >= level - 0.1) storey = i + 1 })
  const last = levels[levels.length - 1]
  const extra = Math.floor((y - last + 0.1) / FLOOR_HEIGHT)
  return storey + Math.max(0, extra)
}

/** Which storey an object belongs to: walls by their own record, slabs by their top, the rest by their bottom. */
export function storeyOf(obj: PlacedObject, levels: number[]): number {
  if (isWallType(obj.type)) return obj.floor || 1
  const ref = obj.type === 'floor' ? slabTop(obj) : obj.position[1] - obj.scale[1] / 2
  return storeyAtHeight(levels, ref)
}

export function storeyCount(objects: PlacedObject[]): number {
  const levels = storeyLevels(objects)
  return Math.max(levels.length, ...objects.map(o => storeyOf(o, levels)))
}

/** Top of the slab a wall actually stands on: the storey base, or the room floor sitting on that base. */
export function wallSupportY(objects: PlacedObject[], wall: PlacedObject): number {
  const base = storeyBase(storeyLevels(objects), wall.floor || 1)
  let support = base
  for (const o of objects) {
    if (o.type !== 'floor') continue
    if (!insideFootprint(o, wall.position[0], wall.position[2], 0.08)) continue
    const top = slabTop(o)
    if (top >= base - 0.05 && top <= base + 0.35) support = Math.max(support, top)
  }
  return support
}

/**
 * Keep a wall from sinking through the slab under it. A wall the user has raised stays up,
 * and a raised ceiling still lifts a wall whose bottom is now below the new slab.
 */
export function reseatWalls(objects: PlacedObject[]): PlacedObject[] {
  const shifts = new Map<string, number>()
  const seated = objects.map(o => {
    if (!isWallType(o.type)) return o
    const support = wallSupportY(objects, o)
    const bottom = o.position[1] - o.scale[1] / 2
    if (bottom >= support - 0.001) return o
    const y = support + o.scale[1] / 2
    const dy = y - o.position[1]
    if (Math.abs(dy) < 0.0001) return o
    shifts.set(o.id, dy)
    return { ...o, position: [o.position[0], y, o.position[2]] as [number, number, number] }
  })
  if (shifts.size === 0) return objects
  return seated.map(o => {
    const dy = o.wallId ? shifts.get(o.wallId) : undefined
    return dy === undefined ? o : { ...o, position: [o.position[0], o.position[1] + dy, o.position[2]] as [number, number, number] }
  })
}

/** Point-in-rectangle test for a (possibly yaw-rotated) box footprint. */
function insideFootprint(o: PlacedObject, x: number, z: number, margin = 0) {
  const yaw = o.rotation[1]
  const dx = x - o.position[0]
  const dz = z - o.position[2]
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
  const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw)
  return Math.abs(lx) <= o.scale[0] / 2 + margin && Math.abs(lz) <= o.scale[2] / 2 + margin
}

/**
 * Centre height at which an object comes to rest: never below the ground or a slab under it,
 * and it drops onto that surface when hovering just above it. Slabs also rest on wall tops,
 * so a room can be closed from above.
 */
export function restingY(objects: PlacedObject[], obj: PlacedObject, pos: [number, number, number], height: number): number {
  const [x, y, z] = pos
  const half = height / 2
  const bottom = y - half
  const ignore = (o: PlacedObject) => o.id === obj.id
  const placed: PlacedObject = { ...obj, position: pos }
  let support = 0
  for (const o of objects) {
    if (ignore(o)) continue
    let top: number | null = null
    if (o.type === 'floor' && insideFootprint(o, x, z)) {
      top = slabTop(o)
    } else if ((obj.type === 'floor' || obj.type === 'roof') && isWallType(o.type)) {
      // Walls whose ends lie on the slab's edges carry it.
      if (wallEndpoints(o).some(p => insideFootprint(placed, p.x, p.z, 0.3))) top = o.position[1] + o.scale[1] / 2
    }
    if (top === null || top > bottom + 0.3) continue
    support = Math.max(support, top)
  }
  if (bottom < support || bottom - support < REST_MAGNET) return support + half
  return y
}

/**
 * Magnetic XZ correction while dragging: a wall's end sticks to another wall's end, a slab's edges
 * line up with another slab's edges. Returns the offset to apply (zero when nothing is close).
 * Because it is recomputed from the raw pointer position every move, pulling further breaks free.
 */
export function magnetOffset(objects: PlacedObject[], obj: PlacedObject, x: number, z: number, yaw: number): { dx: number; dz: number } {
  const ignore = (o: PlacedObject) => o.id === obj.id || (obj.groupId && o.groupId === obj.groupId)

  if (isWallType(obj.type)) {
    const moved = wallEndpoints({ ...obj, position: [x, obj.position[1], z], rotation: [0, yaw, 0] })
    let best = { dx: 0, dz: 0, dist: MAGNET_DIST }
    for (const other of objects) {
      if (!isWallType(other.type) || ignore(other) || (other.floor || 1) !== (obj.floor || 1)) continue
      for (const p of moved) {
        for (const q of wallEndpoints(other)) {
          const dist = Math.hypot(q.x - p.x, q.z - p.z)
          if (dist < best.dist) best = { dx: q.x - p.x, dz: q.z - p.z, dist }
        }
      }
    }
    return { dx: best.dx, dz: best.dz }
  }

  if (obj.type === 'floor' || obj.type === 'carpet') {
    const quarter = Math.round(yaw / (Math.PI / 2))
    if (Math.abs(yaw - quarter * Math.PI / 2) > 0.01) return { dx: 0, dz: 0 }
    const swap = Math.abs(quarter) % 2 === 1
    const hx = (swap ? obj.scale[2] : obj.scale[0]) / 2
    const hz = (swap ? obj.scale[0] : obj.scale[2]) / 2
    let bestX = { d: 0, dist: MAGNET_DIST }
    let bestZ = { d: 0, dist: MAGNET_DIST }
    for (const other of objects) {
      if (other.type !== obj.type || ignore(other)) continue
      const oq = Math.round(other.rotation[1] / (Math.PI / 2))
      const oswap = Math.abs(oq) % 2 === 1
      const ohx = (oswap ? other.scale[2] : other.scale[0]) / 2
      const ohz = (oswap ? other.scale[0] : other.scale[2]) / 2
      const edgesX = [other.position[0] - ohx, other.position[0] + ohx]
      const edgesZ = [other.position[2] - ohz, other.position[2] + ohz]
      for (const mine of [x - hx, x + hx]) {
        for (const theirs of edgesX) {
          const dist = Math.abs(theirs - mine)
          if (dist < bestX.dist) bestX = { d: theirs - mine, dist }
        }
      }
      for (const mine of [z - hz, z + hz]) {
        for (const theirs of edgesZ) {
          const dist = Math.abs(theirs - mine)
          if (dist < bestZ.dist) bestZ = { d: theirs - mine, dist }
        }
      }
    }
    return { dx: bestX.d, dz: bestZ.d }
  }

  return { dx: 0, dz: 0 }
}

export const restsOnSurfaces = (type: string) => !isWallType(type) && !isOpeningType(type) && !hangsInAir(type)

/** Outer footprint of yaw-rotated walls, so a room floor can cover them edge to edge. */
export function wallsOuterBox(walls: PlacedObject[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  walls.forEach(w => {
    const { axisX, axisZ } = wallAxes(w.rotation[1])
    const hl = w.scale[0] / 2
    const ht = w.scale[2] / 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = w.position[0] + axisX.x * sx * hl + axisZ.x * sz * ht
        const z = w.position[2] + axisX.z * sx * hl + axisZ.z * sz * ht
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minZ = Math.min(minZ, z)
        maxZ = Math.max(maxZ, z)
      }
    }
  })
  return { minX, maxX, minZ, maxZ }
}
