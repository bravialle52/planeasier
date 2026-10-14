import { describe, expect, it } from 'vitest'
import { freeLibraryIds } from '../catalog/shop'
import { alignEdges, magnetOffset, storeyLevels } from './storeys'
import { snapFootprint, useEditorStore } from './editorStore'
import type { PlacedObject } from './editorStore'

/** Minimal placed object for snapping tests. */
function piece(partial: Partial<PlacedObject> & Pick<PlacedObject, 'id' | 'type'>): PlacedObject {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#ffffff',
    isHole: false,
    groupId: null,
    floor: 1,
    ...partial
  }
}

describe('shop library', () => {
  it('gives every account the free loft packs and keeps paid beds locked', () => {
    const free = freeLibraryIds()
    expect(free).toContain('sofa_loft')
    expect(free).toContain('wood_light')
    expect(free).not.toContain('bed_loft')
  })
})

describe('snapFootprint', () => {
  it('lands a box corner on the grid', () => {
    const [x, z] = snapFootprint(1.12, 2.4, 0, 1, 1, 0.5)
    expect(x - 0.5).toBeCloseTo(0.5)
    expect(z - 0.5).toBeCloseTo(2)
  })
})

describe('alignEdges', () => {
  it('pulls a stair edge onto a nearby opening and lets go past the magnet', () => {
    const opening = piece({ id: 'hole', type: 'opening', position: [2, 1, 0], scale: [1, 1, 1] })
    const near = alignEdges(2.2, 0.1, 0, 1, 1, [opening])
    expect(Math.abs(near.dx) + Math.abs(near.dz)).toBeGreaterThan(0)
    const far = alignEdges(4, 4, 0, 1, 1, [opening])
    expect(far).toEqual({ dx: 0, dz: 0 })
  })
})

describe('magnetOffset', () => {
  it('sticks a stair to an opening edge', () => {
    const stair = piece({ id: 'stair', type: 'stairs_straight', position: [0, 0, 0], scale: [1, 2, 1] })
    const opening = piece({ id: 'hole', type: 'opening', position: [1.2, 1, 0], scale: [1, 1, 1] })
    const pull = magnetOffset([stair, opening], stair, 0.85, 0.05, 0)
    expect(Math.abs(pull.dx) + Math.abs(pull.dz)).toBeGreaterThan(0)
  })
})

describe('editor room', () => {
  it('builds a room whose floor covers the outer wall faces', () => {
    const store = useEditorStore.getState()
    store.clearObjects()
    store.setSnapStep(0.5)
    store.addRoom(5, 4, 2.8)
    const objects = useEditorStore.getState().objects
    const floor = objects.find(item => item.type === 'floor')
    const walls = objects.filter(item => item.type === 'wall')
    expect(floor).toBeTruthy()
    expect(walls).toHaveLength(4)
    expect(storeyLevels(objects)[0]).toBe(0)
    const floorTop = floor!.position[1] + floor!.scale[1] / 2
    walls.forEach(wall => {
      expect(wall.position[1] - wall.scale[1] / 2).toBeCloseTo(floorTop)
    })
  })
})
