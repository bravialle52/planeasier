import React, { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { PlacedObject } from '../../../store/editorStore'
import { useEditorStore } from '../../../store/editorStore'

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

const enableShadows = (root: THREE.Object3D) => {
  root.traverse(child => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

/** GLB or a self-contained glTF. External bins are packed into the GLB before upload. */
const GltfModel: React.FC<CustomModelProps> = ({ obj }) => {
  const gltf = useLoader(GLTFLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = gltf.scene.clone(true)
    enableShadows(scene)
    return scene
  }, [gltf.scene])
  useLayoutEffect(() => fitToScale(clonedScene, obj.scale), [clonedScene, obj.scale])
  return <primitive object={clonedScene} />
}

/** OBJ mesh. Materials stay as the file defined them. */
const ObjModel: React.FC<CustomModelProps> = ({ obj }) => {
  const loaded = useLoader(OBJLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = loaded.clone(true)
    enableShadows(scene)
    return scene
  }, [loaded])
  useLayoutEffect(() => fitToScale(clonedScene, obj.scale), [clonedScene, obj.scale])
  return <primitive object={clonedScene} />
}

/** FBX export from 3ds Max or Blender. */
const FbxModel: React.FC<CustomModelProps> = ({ obj }) => {
  const loaded = useLoader(FBXLoader, obj.modelUrl || '')
  const clonedScene = useMemo(() => {
    const scene = loaded.clone(true)
    enableShadows(scene)
    return scene
  }, [loaded])
  useLayoutEffect(() => fitToScale(clonedScene, obj.scale), [clonedScene, obj.scale])
  return <primitive object={clonedScene} />
}

/** Shown when the loader throws, so one bad file does not take down the editor. */
const LoadFailed: React.FC = () => {
  const showToast = useEditorStore(state => state.showToast)
  useEffect(() => {
    showToast('Модель не открылась', 'Проверьте, что вместе с glTF выбран .bin и картинки', 'error')
  }, [showToast])
  return null
}

class ModelBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <LoadFailed />
    return this.props.children
  }
}

/** Imported mesh. Picks a loader from the url and keeps the file's own materials. */
export const CustomModel: React.FC<CustomModelProps> = ({ obj }) => {
  if (!obj.modelUrl) return null
  const path = obj.modelUrl.split('?')[0].toLowerCase()
  const body = path.endsWith('.obj')
    ? <ObjModel obj={obj} />
    : path.endsWith('.fbx')
      ? <FbxModel obj={obj} />
      : <GltfModel obj={obj} />
  return <ModelBoundary>{body}</ModelBoundary>
}
