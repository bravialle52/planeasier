import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Shape } from './Objects/Shape'
import { CustomModel } from './Objects/CustomModel'
import { EditableObject } from './EditableObject'
import { storeyLevels, storeyOf } from '../../store/storeys'
import { isOpeningType, isWallType } from '../../store/wallMath'

export const ObjectPlacer: React.FC = () => {
  const objects = useEditorStore(state => state.objects)
  const currentFloor = useEditorStore(state => state.currentFloor)

  const layers = useEditorStore(state => state.layers)

  const visibleObjects = objects.filter(o => {
    const isWall = isWallType(o.type)
    const isOpening = isOpeningType(o.type)
    const isFurniture = !isWall && !isOpening && o.type !== 'floor'
    const isFloor = o.type === 'floor' || o.type === 'roof'

    if (isWall && !layers.walls) return false
    if (isOpening && !layers.openings) return false
    if (isFurniture && !layers.furniture) return false
    if (isFloor && !layers.floors) return false

    return true
  })

  const levels = storeyLevels(objects)

  return (
    <group>
      {visibleObjects.map(obj => {
        const isGhost = currentFloor > 0 && storeyOf(obj, levels) !== currentFloor

        if (obj.type === 'custom') {
          return (
            <EditableObject key={obj.id} obj={obj} isGhost={isGhost}>
              <React.Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#94a3b8" wireframe /></mesh>}>
                <CustomModel obj={obj} />
              </React.Suspense>
            </EditableObject>
          )
        }

        return (
          <EditableObject key={obj.id} obj={obj} isGhost={isGhost}>
            <Shape obj={obj} isGhost={isGhost} />
          </EditableObject>
        )
      })}
    </group>
  )
}
