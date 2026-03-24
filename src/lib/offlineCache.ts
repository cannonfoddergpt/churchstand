/**
 * offlineCache — persist the setlist in IndexedDB so musicians can still
 * read chord charts if the WiFi drops mid-service.
 *
 * DB: churchstand-cache / v1
 * Object store: setlist  (keyPath: 'id', constant key 'current')
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Setlist } from '../types'

interface CacheSchema extends DBSchema {
  setlist: {
    key: string
    value: { id: string; data: Setlist; savedAt: string }
  }
}

let dbPromise: Promise<IDBPDatabase<CacheSchema>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CacheSchema>('churchstand-cache', 1, {
      upgrade(db) {
        db.createObjectStore('setlist', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export async function saveSetlistOffline(setlist: Setlist): Promise<void> {
  try {
    const db = await getDB()
    await db.put('setlist', { id: 'current', data: setlist, savedAt: new Date().toISOString() })
  } catch (err) {
    console.warn('[offlineCache] save failed:', err)
  }
}

export async function loadSetlistOffline(): Promise<Setlist | null> {
  try {
    const db = await getDB()
    const entry = await db.get('setlist', 'current')
    return entry?.data ?? null
  } catch (err) {
    console.warn('[offlineCache] load failed:', err)
    return null
  }
}
