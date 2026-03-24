import fs from 'fs'
import path from 'path'
import { Setlist, createEmptySetlist } from '../src/types'

const STATE_FILE = path.join(process.cwd(), 'setlist.json')
const STATE_FILE_TMP = path.join(process.cwd(), 'setlist.json.tmp')

/** Load canonical setlist from disk. Returns an empty setlist if file is missing or corrupt. */
export function loadState(): Setlist {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(raw) as Setlist
  } catch {
    // File missing, empty, or corrupt — start fresh
    return createEmptySetlist()
  }
}

/**
 * Persist the setlist to disk using an atomic write (tmp → rename).
 * A crash during writeFileSync leaves the .tmp file but preserves the original.
 * A crash during rename at worst leaves both files intact — the original is safe.
 */
export function saveState(setlist: Setlist): void {
  try {
    fs.writeFileSync(STATE_FILE_TMP, JSON.stringify(setlist, null, 2), 'utf8')
    fs.renameSync(STATE_FILE_TMP, STATE_FILE)
  } catch (err) {
    console.error('[ChurchStand] Failed to save state:', err)
  }
}
