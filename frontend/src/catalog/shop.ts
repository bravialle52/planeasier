import type { ObjectType } from '../store/editorStore'

/** A model pack listed in the gallery. `type` is the editor object it places. */
export interface ShopModel {
  id: string
  name: string
  type: ObjectType
  blurb: string
  free: boolean
}

/** Gallery shown on the projects page and in the model shop. Names match the account library. */
export const SHOP_MODELS: ShopModel[] = [
  { id: 'sofa_loft', name: 'Диван Loft', type: 'sofa_loft', blurb: 'Трёхместный диван с подушками и ножками', free: true },
  { id: 'armchair_loft', name: 'Диван, кресло', type: 'armchair_loft', blurb: 'Кресло той же серии', free: true },
  { id: 'shelf_wms', name: 'Стеллаж WMS', type: 'shelf_wms', blurb: 'Открытый стеллаж с полками', free: true },
  { id: 'bed_loft', name: 'Кровать Mira', type: 'bed_loft', blurb: 'Кровать с высоким изголовьем', free: false },
  { id: 'table_loft', name: 'Стол Loft', type: 'table_loft', blurb: 'Стол на металлической раме', free: false }
]

/** Ids that do not need a purchase. */
export function freeLibraryIds(): string[] {
  return [
    ...SHOP_MODELS.filter(item => item.free).map(item => item.id),
    'wood_light',
    'tile_blue',
    'concrete'
  ]
}
