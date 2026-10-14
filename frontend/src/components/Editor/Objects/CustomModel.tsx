import React, { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { PlacedObject } from '../../../store/editorStore'

interface CustomModelProps {
  obj: PlacedObject
}

/** Fit an imported mesh into the same width/height/depth box the gizmos already edit. */
function fitToScale(root: THREE.Object3D, scale: [number, number, number]) {
  root.scale.set(1, 1, 1)
  root.position.set(0, 0, 0)
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const sx = size.x > 1e-4 ? scale[0] / size.x : 1
  const sy = size.y > 1e-4 ? scale[1] / size.y : 1
  const sz = size.z > 1e-4 ? scale[2] / size.z : 1
  root.scale.set(sx, sy, sz)
  const center = box.getCenter(new THREE.Vector3())
  root.position.set(-center.x * sx, -box.min.y * sy - scale[1] / 2, -center.z * sz)
}

const paintWhite = (root: THREE.Object3D, color: string) => {
  root.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

const GltfModel: React.FC<CustomModelProps> = ({ obj }) => {
  const gltf = useLoader(GLTFLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = gltf.scene.clone(true)
    paintWhite(scene, obj.color || '#ffffff')
    return scene
  }, [gltf.scene, obj.color])
  useLayoutEffect(() => fitToScale(clonedScene, obj.scale), [clonedScene, obj.scale])
  return <primitive object={clonedScene} />
}

const ObjModel: React.FC<CustomModelProps> = ({ obj }) => {
  const loaded = useLoader(OBJLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = loaded.clone(true)
    paintWhite(scene, obj.color || '#ffffff')
    return scene
  }, [loaded, obj.color])
  useLayoutEffect(() => fitToScale(clonedScene, obj.scale), [clonedScene, obj.scale])
  return <primitive object={clonedScene} />
}

export const CustomModel: React.FC<CustomModelProps> = ({ obj }) => {
  if (!obj.modelUrl) return null
  const path = obj.modelUrl.split('?')[0].toLowerCase()
  if (path.endsWith('.obj')) return <ObjModel obj={obj} />
  return <GltfModel obj={obj} />
}
