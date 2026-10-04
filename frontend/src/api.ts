import type { PlacedObject } from './store/editorStore'

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('planeasier_token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...options, headers })
}

export function withMetrics(objects: PlacedObject[]) {
  return objects.map(obj => ({
    ...obj,
    center: { x: obj.position[0], y: obj.position[1], z: obj.position[2] },
    size: { x: obj.scale[0], y: obj.scale[1], z: obj.scale[2] },
    rotationEuler: { x: obj.rotation[0], y: obj.rotation[1], z: obj.rotation[2] }
  }))
}

const ADJECTIVES = ['Тихий', 'Светлый', 'Северный', 'Тёплый', 'Ровный', 'Дальний', 'Белый']
const NOUNS = ['дом', 'чертеж', 'склад', 'кабинет', 'двор', 'этаж', 'сарай']

export function randomProjectName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adjective} ${noun}`
}
