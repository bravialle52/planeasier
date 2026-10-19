import React, { useLayoutEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { PlacedObject } from '../../store/editorStore'
import { framePreview, PREVIEW_FOV } from '../../catalog/frame'

/** Move the card camera out until every object of this project is visible. */
function Fit({ objects }: { objects: PlacedObject[] }) {
  const { camera, invalidate } = useThree()
  useLayoutEffect(() => {
    const shot = framePreview(objects)
    camera.position.set(...shot.position)
    camera.lookAt(...shot.target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, objects])
  return null
}

/** Isometric card preview. The camera frames the whole plan, not a close corner. */
export const Preview3D: React.FC<{ objects: PlacedObject[] }> = ({ objects }) => {
  const shown = objects.slice(0, 48)
  const fallback: PlacedObject[] = shown.length > 0 ? shown : [
    { id: 'f', type: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [4, 0.1, 3], color: '#dbe7f5', isHole: false, groupId: null, floor: 1 },
    { id: 'w', type: 'wall', position: [0, 1.2, -1.5], rotation: [0, 0, 0], scale: [4, 2.2, 0.15], color: '#3d7eea', isHole: false, groupId: null, floor: 1 }
  ]
  const shot = framePreview(fallback)
  return (
    <div className="h-40 bg-[#eef3fb]">
      <Canvas camera={{ position: shot.position, fov: PREVIEW_FOV }} frameloop="demand" gl={{ antialias: true }}>
        <Fit objects={fallback} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[4, 8, 3]} intensity={1.1} />
        {fallback.map(item => (
          <mesh key={item.id} position={item.position} rotation={item.rotation} scale={1}>
            <boxGeometry args={item.scale} />
            <meshStandardMaterial color={item.type === 'floor' || item.type === 'roof' ? '#d5e3f4' : '#3d7eea'} />
          </mesh>
        ))}
      </Canvas>
    </div>
  )
}
