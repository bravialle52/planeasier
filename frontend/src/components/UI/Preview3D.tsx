import React from 'react'
import { Canvas } from '@react-three/fiber'
import type { PlacedObject } from '../../store/editorStore'

/** Isometric card preview. A few boxes stand in for the saved plan so the card is not a flat top view. */
export const Preview3D: React.FC<{ objects: PlacedObject[] }> = ({ objects }) => {
  const shown = objects.slice(0, 48)
  const fallback: PlacedObject[] = shown.length > 0 ? shown : [
    { id: 'f', type: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [4, 0.1, 3], color: '#dbe7f5', isHole: false, groupId: null, floor: 1 },
    { id: 'w', type: 'wall', position: [0, 1.2, -1.5], rotation: [0, 0, 0], scale: [4, 2.2, 0.15], color: '#3d7eea', isHole: false, groupId: null, floor: 1 }
  ]
  return (
    <div className="h-40 bg-[#eef3fb]">
      <Canvas camera={{ position: [7, 5.5, 7], fov: 32 }} frameloop="demand" gl={{ antialias: true }}>
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
