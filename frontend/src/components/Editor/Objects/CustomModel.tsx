import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { PlacedObject } from '../../../store/editorStore'

interface CustomModelProps {
  obj: PlacedObject
}

const paintWhite = (root: THREE.Object3D, color: string) => {
  root.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2,
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
  return <primitive object={clonedScene} />
}

const ObjModel: React.FC<CustomModelProps> = ({ obj }) => {
  const loaded = useLoader(OBJLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = loaded.clone(true)
    paintWhite(scene, obj.color || '#ffffff')
    return scene
  }, [loaded, obj.color])
  return <primitive object={clonedScene} />
}

export const CustomModel: React.FC<CustomModelProps> = ({ obj }) => {
  if (!obj.modelUrl) return null
  const path = obj.modelUrl.split('?')[0].toLowerCase()
  if (path.endsWith('.obj')) return <ObjModel obj={obj} />
  return <GltfModel obj={obj} />
}
