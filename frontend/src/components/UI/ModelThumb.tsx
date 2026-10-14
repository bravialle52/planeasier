import React, { useLayoutEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { ObjectType, PlacedObject } from '../../store/editorStore'
import { Shape } from '../Editor/Objects/Shape'
import { PREVIEW_FOV } from '../../catalog/frame'

const SCALES: Partial<Record<ObjectType, [number, number, number]>> = {
  sofa_loft: [2.2, 0.85, 0.95],
  armchair_loft: [0.9, 0.85, 0.9],
  shelf_wms: [1, 1.8, 0.35],
  bed_loft: [1.8, 1.05, 2.1],
  table_loft: [1.6, 0.75, 0.9]
}

/** Place the thumb camera far enough that the whole mesh is in frame. */
function FitCamera({ scale }: { scale: [number, number, number] }) {
  const { camera } = useThree()
  useLayoutEffect(() => {
    const span = Math.max(scale[0], scale[1], scale[2], 0.4)
    const half = (PREVIEW_FOV * Math.PI) / 360
    const dist = (span * 0.85) / Math.tan(half)
    camera.position.set(dist, dist * 0.55, dist)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, scale])
  return null
}

/** Small shaded preview of a shop model, using the same meshes as the editor. */
export const ModelThumb: React.FC<{ type: ObjectType; color?: string }> = ({ type, color = '#2f6fe0' }) => {
  const scale = SCALES[type] || [1, 1, 1]
  const obj: PlacedObject = {
    id: type,
    type,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale,
    color,
    isHole: false,
    groupId: null,
    floor: 1
  }
  return (
    <div className="h-32 rounded-xl bg-[#e8eef8] overflow-hidden">
      <Canvas camera={{ position: [3, 2, 3], fov: PREVIEW_FOV }} frameloop="demand" gl={{ antialias: true }}>
        <ambientLight intensity={1.35} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <FitCamera scale={scale} />
        <Shape obj={obj} />
      </Canvas>
    </div>
  )
}
