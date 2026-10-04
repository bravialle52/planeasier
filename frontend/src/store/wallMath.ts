import * as THREE from 'three'
import type { PlacedObject } from './editorStore'

export const FLOOR_HEIGHT = 2.8

export const isWallType = (type: string) => type === 'wall' || type === 'partition'

export const isOpeningType = (type: string) =>
  type === 'door' ||
  type === 'double_door' ||
  type === 'arch' ||
  type === 'window' ||
  type === 'panoramic_window' ||
  type === 'opening'

/** Lamps and the cornice keep the height they were given; they do not drop onto the floor. */
export const hangsInAir = (type: string) =>
  type === 'ceiling_lamp' || type === 'chandelier' || type === 'sconce' || type === 'cornice'

export const isDoorType = (type: string) =>
  type === 'door' || type === 'double_door' || type === 'arch'

export const floorBaseY = (floor: number) => (Math.max(1, floor) - 1) * FLOOR_HEIGHT

export const wallCenterY = (floor: number, height: number) => floorBaseY(floor) + height / 2

/** Local +X / +Z of a yaw-rotated wall, matching Three.js rotation around Y. */
export function wallAxes(yaw: number) {
  return {
    axisX: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
    axisZ: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
  }
}

export function wallEndpoints(wall: PlacedObject) {
  const { axisX } = wallAxes(wall.rotation[1])
  const half = wall.scale[0] / 2
  const center = new THREE.Vector3(wall.position[0], 0, wall.position[2])
  return [
    center.clone().addScaledVector(axisX, half),
    center.clone().addScaledVector(axisX, -half),
  ]
}

export function objectQuaternion(o: PlacedObject) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'))
}

/** World-axis box around an object's oriented volume. */
export function worldAabb(o: PlacedObject) {
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(),
    new THREE.Vector3(Math.abs(o.scale[0]), Math.abs(o.scale[1]), Math.abs(o.scale[2]))
  )
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(o.position[0], o.position[1], o.position[2]),
    objectQuaternion(o),
    new THREE.Vector3(1, 1, 1)
  )
  return box.applyMatrix4(matrix)
}

export function boxesOverlap(a: PlacedObject, b: PlacedObject, pad = 0.02) {
  const box = worldAabb(a)
  box.expandByScalar(pad)
  return box.intersectsBox(worldAabb(b))
}

/**
 * Opening box expressed in the host's local space (metres, host centre at the origin).
 * Scale is the opening's own length / height / width, so the cut matches the opening after any turn.
 */
export function cutterInHost(host: PlacedObject, opening: PlacedObject) {
  const hostMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(host.position[0], host.position[1], host.position[2]),
    objectQuaternion(host),
    new THREE.Vector3(1, 1, 1)
  )
  const openingMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(opening.position[0], opening.position[1], opening.position[2]),
    objectQuaternion(opening),
    new THREE.Vector3(Math.abs(opening.scale[0]), Math.abs(opening.scale[1]), Math.abs(opening.scale[2]))
  )
  const local = hostMatrix.invert().multiply(openingMatrix)
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  local.decompose(position, quaternion, scale)
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
  // A few centimetres of slack so the boolean goes cleanly through the surface.
  const margin = 0.04
  return {
    position: [position.x, position.y, position.z] as [number, number, number],
    rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    scale: [Math.abs(scale.x) + margin, Math.abs(scale.y) + margin, Math.abs(scale.z) + margin] as [number, number, number],
  }
}

export function worldToWallLocal(point: THREE.Vector3, wall: PlacedObject) {
  const { axisX, axisZ } = wallAxes(wall.rotation[1])
  const rel = point.clone().sub(new THREE.Vector3(wall.position[0], wall.position[1], wall.position[2]))
  return {
    along: rel.dot(axisX),
    up: rel.y,
    through: rel.dot(axisZ),
  }
}

export function wallLocalToWorld(along: number, through: number, wall: PlacedObject): [number, number, number] {
  const { axisX, axisZ } = wallAxes(wall.rotation[1])
  const position = new THREE.Vector3(wall.position[0], wall.position[1], wall.position[2])
  position.addScaledVector(axisX, along)
  position.addScaledVector(axisZ, through)
  return [position.x, position.y, position.z]
}

export function openingFitsWall(opening: PlacedObject, wall: PlacedObject, slack = 0.35) {
  const local = worldToWallLocal(new THREE.Vector3(...opening.position), wall)
  const maxThrough = (wall.scale[2] + opening.scale[2]) / 2 + slack
  if (Math.abs(local.through) > maxThrough) return false
  const halfOpening = opening.scale[0] / 2
  const halfWall = wall.scale[0] / 2
  if (local.along + halfOpening < -halfWall - 0.08 || local.along - halfOpening > halfWall + 0.08) return false
  const halfH = opening.scale[1] / 2
  const halfWallH = wall.scale[1] / 2
  if (local.up + halfH < -halfWallH - 0.08 || local.up - halfH > halfWallH + 0.08) return false
  return true
}

export function nearestWall(position: [number, number, number], walls: PlacedObject[], maxDist = 1) {
  const point = new THREE.Vector3(...position)
  let best: PlacedObject | null = null
  let bestScore = maxDist
  for (const wall of walls) {
    const local = worldToWallLocal(point, wall)
    const half = wall.scale[0] / 2
    const pastEnd = Math.max(0, Math.abs(local.along) - half)
    const score = Math.abs(local.through) + pastEnd
    if (score < bestScore) {
      bestScore = score
      best = wall
    }
  }
  return best
}

export function snapOpeningToWall(opening: PlacedObject, wall: PlacedObject) {
  const local = worldToWallLocal(new THREE.Vector3(...opening.position), wall)
  const limit = Math.max(0, wall.scale[0] / 2 - opening.scale[0] / 2)
  const along = THREE.MathUtils.clamp(local.along, -limit, limit)
  const wallBottom = wall.position[1] - wall.scale[1] / 2
  const wallTop = wall.position[1] + wall.scale[1] / 2
  let y: number
  if (isDoorType(opening.type)) {
    y = wallBottom + opening.scale[1] / 2
  } else {
    const minY = wallBottom + opening.scale[1] / 2
    const maxY = wallTop - opening.scale[1] / 2
    y = THREE.MathUtils.clamp(opening.position[1], Math.min(minY, maxY), Math.max(minY, maxY))
  }
  const [x, , z] = wallLocalToWorld(along, 0, wall)
  return {
    position: [x, y, z] as [number, number, number],
    rotation: [0, wall.rotation[1], 0] as [number, number, number],
    wallId: wall.id,
    floor: wall.floor,
  }
}
