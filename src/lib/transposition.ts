import { InstrumentType, DISPLAY_OFFSET } from '../types'

// ─── Note lookup tables ───────────────────────────────────────────────────────

// Preferred note names for each semitone (0–11).
// Uses sharps for C#, F#; flats for Eb, Ab, Bb — standard in worship music.
const NOTE_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
]

// Maps any common note spelling to its semitone value (0–11).
const NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
  'C': 0,  'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4,  'Fb': 4,
  'F': 5,  'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a chord name into its root note and quality string.
 *
 * Examples:
 *   'D'      → { root: 'D',  quality: '' }
 *   'Am'     → { root: 'A',  quality: 'm' }
 *   'Gsus2'  → { root: 'G',  quality: 'sus2' }
 *   'F#m7'   → { root: 'F#', quality: 'm7' }
 *   'Bbmaj7' → { root: 'Bb', quality: 'maj7' }
 */
export function parseChordRoot(chordName: string): { root: string; quality: string } {
  // Match: letter A-G, optionally followed by # or b, then the rest is quality.
  const match = chordName.match(/^([A-G][#b]?)(.*)$/)
  if (!match) return { root: chordName, quality: '' }
  return { root: match[1], quality: match[2] }
}

/**
 * Transpose a single root note by `semitones` steps.
 * Uses MIDI-style arithmetic (mod 12) and the preferred NOTE_NAMES spelling.
 */
function transposeRoot(root: string, semitones: number): string {
  const base = NOTE_TO_SEMITONE[root]
  if (base === undefined) return root // Unknown note — pass through unchanged
  const newSemitone = ((base + semitones) % 12 + 12) % 12
  return NOTE_NAMES[newSemitone]
}

/**
 * Transpose a chord name by `semitones`.
 *
 * - The root is transposed; the quality (maj7, sus2, m, add9, etc.) is preserved.
 * - Slash chords (e.g. D/F#): BOTH the root and the bass note are transposed
 *   independently. Quality of the main chord is preserved.
 * - semitones = 0 returns the chord unchanged.
 *
 * @example
 *   transposeChord('D', 9)    // → 'B'   (alto sax reading concert D)
 *   transposeChord('Am', 9)   // → 'F#m'
 *   transposeChord('D/F#', 9) // → 'B/Eb'
 *   transposeChord('D', 2)    // → 'E'   (trumpet reading concert D)
 */
export function transposeChord(chordName: string, semitones: number): string {
  if (semitones === 0) return chordName

  // Handle slash chords: transpose root chord and bass note separately.
  const slashIdx = chordName.indexOf('/')
  if (slashIdx !== -1) {
    const mainPart = chordName.slice(0, slashIdx)
    const bassPart = chordName.slice(slashIdx + 1)
    const { root: mainRoot, quality } = parseChordRoot(mainPart)
    const { root: bassRoot } = parseChordRoot(bassPart)
    return `${transposeRoot(mainRoot, semitones)}${quality}/${transposeRoot(bassRoot, semitones)}`
  }

  const { root, quality } = parseChordRoot(chordName)
  return `${transposeRoot(root, semitones)}${quality}`
}

/**
 * Transpose an array of concert-pitch chord names for a given instrument type.
 * Uses the DISPLAY_OFFSET for the instrument (0 for concert-pitch instruments).
 *
 * @example
 *   transposeChordsForDisplay(['D', 'G', 'A'], 'alto-sax')
 *   // → ['B', 'E', 'F#']
 */
export function transposeChordsForDisplay(
  chords: string[],
  instrument: InstrumentType,
): string[] {
  const offset = DISPLAY_OFFSET[instrument]
  if (offset === 0) return chords
  return chords.map(chord => transposeChord(chord, offset))
}
