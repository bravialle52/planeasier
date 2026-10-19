/** Where a preview camera has to sit so the whole plan stays inside a 32° frame. */
export const PREVIEW_FOV = 32

export interface FramedShot {
  position: [number, number, number]
  target: [number, number, number]
}

interface Boxed {
  position: [number, number, number]
  scale: [number, number, number]
}

/** Pull the camera back until the widest side of the plan fits, with a margin. */
export function framePreview(objects: Boxed[]): FramedShot {
  if (objects.length === 0) {
    return { position: [8, 6, 8], target: [0, 0.5, 0] }
  }
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const item of objects) {
    minX = Math.min(minX, item.position[0] - item.scale[0] / 2)
    minY = Math.min(minY, item.position[1] - item.scale[1] / 2)
    minZ = Math.min(minZ, item.position[2] - item.scale[2] / 2)
    maxX = Math.max(maxX, item.position[0] + item.scale[0] / 2)
    maxY = Math.max(maxY, item.position[1] + item.scale[1] / 2)
    maxZ = Math.max(maxZ, item.position[2] + item.scale[2] / 2)
  }
  const target: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1)
  const half = (PREVIEW_FOV * Math.PI) / 360
  const dist = (span * 0.72) / Math.tan(half)
  return {
    position: [target[0] + dist, target[1] + dist * 0.62, target[2] + dist],
    target
  }
}
