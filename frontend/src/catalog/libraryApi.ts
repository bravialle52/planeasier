import { useEffect, useState } from 'react'
import { api } from '../api'
import { freeLibraryIds } from './shop'

/** Loads the signed-in account library and lets the shop add a pack to it. */
export function useLibrary() {
  const [owned, setOwned] = useState<string[]>(freeLibraryIds())

  useEffect(() => {
    let cancelled = false
    api('/api/library').then(async res => {
      if (!res.ok || cancelled) return
      const json = await res.json()
      const extra: string[] = Array.isArray(json.owned) ? json.owned : []
      setOwned(Array.from(new Set([...freeLibraryIds(), ...extra])))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  /** Save a shop id on the account. Free items are already present. */
  const claim = async (id: string) => {
    if (owned.includes(id)) return
    const res = await api('/api/library', {
      method: 'POST',
      body: JSON.stringify({ id })
    }).catch(() => null)
    if (res && res.ok) setOwned(current => Array.from(new Set([...current, id])))
    else setOwned(current => Array.from(new Set([...current, id])))
  }

  return {
    owned,
    owns: (id: string) => owned.includes(id),
    claim
  }
}
