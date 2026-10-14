import React from 'react'
import { SiteHeader } from './SiteHeader'
import { SHOP_MODELS } from '../../catalog/shop'
import { useLibrary } from '../../catalog/libraryApi'

/** Model shop. Claimed packs show up in the editor catalog under the same names. */
export const GalleryPage: React.FC = () => {
  const library = useLibrary()
  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <SiteHeader />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl mb-1">Галерея 3D моделей</h1>
        <p className="text-sm text-slate-500 mb-6">Добавьте пакет на аккаунт — он появится в каталоге редактора с тем же названием.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SHOP_MODELS.map(item => {
            const owned = library.owns(item.id)
            return (
              <article key={item.id} className="tile bg-white border border-slate-200 rounded-2xl p-4">
                <div className="h-28 rounded-xl bg-gradient-to-br from-[#dbeafe] to-[#93c5fd] mb-3" />
                <div className="text-sm">{item.name}</div>
                <div className="text-xs text-slate-500 mt-1 mb-3">{item.blurb}</div>
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => library.claim(item.id)}
                  className="tile px-3 py-1.5 rounded-lg text-xs bg-[#2f6bff] text-white disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {owned ? 'На аккаунте' : item.free ? 'Добавить бесплатно' : 'Добавить пакет'}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
