import * as THREE from 'three'

/** A shop texture the account can own and paint onto objects. */
export interface ShopTexture {
  id: string
  name: string
  kind: 'wood' | 'tile' | 'concrete' | 'carpet' | 'fabric'
  free: boolean
}

/** Built-in finishes. Free ones are on every account; the rest are claimed in the library. */
export const SHOP_TEXTURES: ShopTexture[] = [
  { id: 'wood_light', name: 'Светлое дерево', kind: 'wood', free: true },
  { id: 'tile_blue', name: 'Голубая плитка', kind: 'tile', free: true },
  { id: 'concrete', name: 'Серый бетон', kind: 'concrete', free: true },
  { id: 'carpet_blue', name: 'Ковролин', kind: 'carpet', free: false },
  { id: 'fabric_navy', name: 'Ткань нави', kind: 'fabric', free: false }
]

const cache = new Map<string, THREE.CanvasTexture>()

/** Draw one tile of a procedural finish. No external image files, so the prototype stays self-contained. */
function paint(kind: ShopTexture['kind'], ctx: CanvasRenderingContext2D) {
  const size = 256
  if (kind === 'wood') {
    ctx.fillStyle = '#d7b48a'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#b88858'
    for (let y = 8; y < size; y += 18) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(60, y - 4, 140, y + 6, size, y)
      ctx.stroke()
    }
  } else if (kind === 'tile') {
    ctx.fillStyle = '#7eb0d8'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#f4f8fc'
    ctx.lineWidth = 8
    for (let i = 0; i <= size; i += 64) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
  } else if (kind === 'concrete') {
    ctx.fillStyle = '#b7b7b4'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(80,80,80,${Math.random() * 0.25})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
    }
  } else if (kind === 'carpet') {
    ctx.fillStyle = '#3d6fbe'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#2f5ea8'
    for (let y = 0; y < size; y += 4) {
      for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < size; x += 4) ctx.fillRect(x, y, 2, 2)
    }
  } else {
    ctx.fillStyle = '#1e3a6e'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#2c5294'
    ctx.lineWidth = 2
    for (let i = -size; i < size * 2; i += 10) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + size, size)
      ctx.stroke()
    }
  }
}

/** PNG of a shop finish for the library cards. */
export function texturePreviewUrl(id: string): string | null {
  const texture = textureById(id)
  const image = texture?.image as HTMLCanvasElement | undefined
  if (!image || typeof image.toDataURL !== 'function') return null
  return image.toDataURL('image/png')
}

/** Repeatable GPU texture for a shop id. Cached so dragging an object does not rebuild the canvas. */
export function textureById(id?: string | null): THREE.CanvasTexture | null {
  if (!id) return null
  const spec = SHOP_TEXTURES.find(item => item.id === id)
  if (!spec) return null
  const cached = cache.get(id)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  paint(spec.kind, ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  cache.set(id, texture)
  return texture
}
