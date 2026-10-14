import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/** Face knobs and other editor handles must not become boxes in the downloaded file. */
export function meshIsHelper(userData?: { fpvHandle?: unknown; helper?: unknown }): boolean {
  return Boolean(userData?.fpvHandle || userData?.helper)
}

/** Copy visible solids into world space so a rotated, non-uniformly scaled wall does not shear into a slab. */
function bakeSelectable(scene: THREE.Scene): THREE.Group {
  const root = new THREE.Group()
  root.name = 'Planeasier'
  scene.updateMatrixWorld(true)
  scene.traverse(node => {
    if (!node.userData?.isSelectableObject) return
    node.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || meshIsHelper(mesh.userData)) return
      if (!mesh.geometry?.getAttribute('position')) return
      const geom = mesh.geometry.clone()
      geom.applyMatrix4(mesh.matrixWorld)
      const baked = new THREE.Mesh(geom, mesh.material)
      baked.name = mesh.name || String(node.userData.objectId || 'object')
      root.add(baked)
    })
  })
  return root
}

function saveBlob(data: ArrayBuffer | object, extension: string, mime: string) {
  const blob = data instanceof ArrayBuffer
    ? new Blob([data], { type: mime })
    : new Blob([JSON.stringify(data)], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `planeasier-${new Date().toISOString().slice(0, 10)}.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}

/** Download the placed objects as glTF json or a binary GLB. Grid, handles and the person stay out. */
export function downloadSceneGltf(binary = false): boolean {
  const scene = (window as unknown as { __planeasierScene?: THREE.Scene }).__planeasierScene
  if (!scene) return false
  const root = bakeSelectable(scene)
  if (root.children.length === 0) return false
  const exporter = new GLTFExporter()
  exporter.parse(
    root,
    (gltf) => {
      if (binary) saveBlob(gltf as ArrayBuffer, 'glb', 'model/gltf-binary')
      else saveBlob(gltf as object, 'gltf', 'model/gltf+json')
    },
    (error) => {
      console.error(error)
    },
    { binary }
  )
  return true
}
