/**
 * Deterministic bridge chord suggester.
 *
 * Given two concert-pitch keys, returns a 4-bar transition progression
 * using standard tonal music theory — no AI or network required.
 *
 * General algorithm:
 *   Bar 1: I  of fromKey  (where we are)
 *   Bar 2: IV of toKey    (smooth approach — often a pivot chord)
 *   Bar 3: V7 of toKey    (dominant preparation)
 *   Bar 4: I  of toKey    (arrival)
 *
 * Same-key case (e.g. song ends and restarts in D):
 *   I – IV – V7 – I  (turnaround in that key)
 *
 * Whole-step-up modulation (e.g. D → E, G → A) — common worship key change:
 *   I(from) – bVII(to) – IV(to) – I(to)
 *   The bVII approach sounds more natural than the stock dominant for a
 *   sudden half-step lift.
 */

// Chromatic scale — must match NOTE_NAMES in transposition.ts
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

// Intervals from the root for a major scale
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

// Chord quality suffix per scale degree (I ii iii IV V vi vii°)
const DEGREE_QUALITY = ['', 'm', 'm', '', '', 'm', 'dim']

// Enharmonic aliases so callers can pass 'Db', 'Gb', etc.
const ENHARMONIC: Record<string, string> = {
  'Db': 'C#',
  'D#': 'Eb',
  'Gb': 'F#',
  'G#': 'Ab',
  'A#': 'Bb',
}

function noteIndex(note: string): number {
  const canonical = ENHARMONIC[note] ?? note
  return NOTES.indexOf(canonical)
}

/** Returns the 7 diatonic chord names for a major key, index 0 = I. */
function majorScaleChords(key: string): string[] {
  const root = noteIndex(key)
  if (root === -1) return []
  return MAJOR_INTERVALS.map((interval, i) => {
    const idx = (root + interval) % 12
    return NOTES[idx] + DEGREE_QUALITY[i]
  })
}

/**
 * Suggest a 4-bar bridge between two songs.
 *
 * @param fromKey  Concert key of the ending song (e.g. 'D')
 * @param toKey    Concert key of the starting song (e.g. 'G')
 * @returns        Array of 4 chord names in concert pitch
 */
export function suggestBridge(fromKey: string, toKey: string): string[] {
  const fromChords = majorScaleChords(fromKey)
  const toChords = majorScaleChords(toKey)

  // Unknown key — return empty
  if (!fromChords.length || !toChords.length) return []

  const fromIdx = noteIndex(fromKey)
  const toIdx = noteIndex(toKey)

  // Same key: simple I–IV–V7–I turnaround
  if (fromIdx === toIdx) {
    return [toChords[0], toChords[3], toChords[4] + '7', toChords[0]]
  }

  // Whole-step-up modulation (2 semitones): bVII approach sounds smoother
  const semitonesBetween = ((toIdx - fromIdx) + 12) % 12
  if (semitonesBetween === 2) {
    // bVII of toKey = note one whole step below toKey root
    const bVIIIdx = (toIdx - 2 + 12) % 12
    const bVII = NOTES[bVIIIdx] // major chord on bVII
    return [fromChords[0], bVII, toChords[3], toChords[0]]
  }

  // General case: I(from) → IV(to) → V7(to) → I(to)
  return [fromChords[0], toChords[3], toChords[4] + '7', toChords[0]]
}
