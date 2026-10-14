import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/** Download the placed objects currently on the canvas as a glTF file. Grid, lights and the person are left out. */
export function downloadSceneGltf(): boolean {
  const scene = (window as unknown as { __planeasierScene?: THREE.Scene }).__planeasierScene
  if (!scene) return false
  const root = new THREE.Group()
  root.name = 'Planeasier'
  scene.traverse(node => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    let parent: THREE.Object3D | null = mesh
    let selectable = false
    while (parent) {
      if (parent.userData?.isSelectableObject) {
        selectable = true
        break
      }
      parent = parent.parent
    }
    if (!selectable) return
    const clone = mesh.clone()
    clone.material = mesh.material
    mesh.updateWorldMatrix(true, false)
    clone.matrix.copy(mesh.matrixWorld)
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
    clone.matrixAutoUpdate = true
    root.add(clone)
  })
  const exporter = new GLTFExporter()
  exporter.parse(
    root,
    (gltf) => {
      const blob = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `planeasier-${new Date().toISOString().slice(0, 10)}.gltf`
      link.click()
      URL.revokeObjectURL(url)
    },
    (error) => {
      console.error(error)
    },
    { binary: false }
  )
  return true
}
