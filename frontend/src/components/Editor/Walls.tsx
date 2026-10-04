import React from 'react'
import { Edges } from '@react-three/drei'

export const Walls: React.FC = () => {
  const wallHeight = 3
  const roomSize = 10
  const thickness = 0.2

  return (
    <group>
      {/* Back Wall */}
      <mesh position={[0, wallHeight / 2, -roomSize / 2]}>
        <boxGeometry args={[roomSize, wallHeight, thickness]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Front Wall */}
      <mesh position={[0, wallHeight / 2, roomSize / 2]}>
        <boxGeometry args={[roomSize, wallHeight, thickness]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Left Wall */}
      <mesh position={[-roomSize / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[thickness, wallHeight, roomSize]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
      {/* Right Wall */}
      <mesh position={[roomSize / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[thickness, wallHeight, roomSize]} />
        <meshBasicMaterial color="white" />
        <Edges color="black" />
      </mesh>
    </group>
  )
}
