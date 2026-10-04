import React from 'react'
import * as THREE from 'three'
import { useEditorStore } from '../../store/editorStore'
import { isGizmoInteracting } from './EditableObject'

export const Floor: React.FC = () => {
  const { selectObjects } = useEditorStore()

  const handlePointerDown = (e: any) => {
    // If clicking or dragging a TransformControls gizmo, DO NOT clear selection!
    if (isGizmoInteracting()) {
      return
    }

    // Left click on empty ground clears selection; right click is reserved for selection & marquee
    if (e.button === 0) {
      e.stopPropagation()
      selectObjects([])
    }
  }

  return (
    <group>
      {/* Solid architectural light-gray ground platform (100x100m) - eliminates blue sky showing through grid */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        onPointerDown={handlePointerDown}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#e2e8f0" 
          roughness={0.9} 
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>

      {/* Clean border line around the 100x100m site */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(100, 100)]} />
        <lineBasicMaterial color="#64748b" />
      </lineSegments>
    </group>
  )
}
