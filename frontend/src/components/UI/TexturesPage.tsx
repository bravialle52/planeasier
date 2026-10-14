import React from 'react'
import { SiteHeader } from './SiteHeader'
import { SHOP_TEXTURES } from '../../catalog/textures'
import { useLibrary } from '../../catalog/libraryApi'

/** Texture shop. Owned finishes can be painted onto objects in the editor. */
export const TexturesPage: React.FC = () => {
  const library = useLibrary()
  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <SiteHeader />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl mb-1">Библиотека текстур</h1>
        <p className="text-sm text-slate-500 mb-6">Пакет на аккаунте открывает отделку в панели свойств объекта.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SHOP_TEXTURES.map(item => {
            const owned = library.owns(item.id)
            return (
              <article key={item.id} className="tile bg-white border border-slate-200 rounded-2xl p-3">
                <div className="h-20 rounded-lg bg-[#e8eef6] mb-2" />
                <div className="text-xs mb-2">{item.name}</div>
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => library.claim(item.id)}
                  className="tile w-full py-1.5 rounded-lg text-[11px] bg-[#2f6bff] text-white disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {owned ? 'На аккаунте' : 'Добавить'}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
