import { describe, it, expect } from 'vitest'
import {
  transposeChord,
  transposeChordsForDisplay,
  parseChordRoot,
} from './transposition'
import { DISPLAY_OFFSET } from '../types'

// ─── Root parsing ─────────────────────────────────────────────────────────────

describe('parseChordRoot', () => {
  it('parses simple root', () => expect(parseChordRoot('D')).toEqual({ root: 'D', quality: '' }))
  it('parses sharp root', () => expect(parseChordRoot('F#')).toEqual({ root: 'F#', quality: '' }))
  it('parses flat root', () => expect(parseChordRoot('Bb')).toEqual({ root: 'Bb', quality: '' }))
  it('parses root + quality', () => expect(parseChordRoot('Gsus2')).toEqual({ root: 'G', quality: 'sus2' }))
  it('parses root + maj7', () => expect(parseChordRoot('Cmaj7')).toEqual({ root: 'C', quality: 'maj7' }))
  it('parses root + add9', () => expect(parseChordRoot('Aadd9')).toEqual({ root: 'A', quality: 'add9' }))
  it('parses root + m', () => expect(parseChordRoot('Am')).toEqual({ root: 'A', quality: 'm' }))
  it('parses sharp root + quality', () => expect(parseChordRoot('F#m')).toEqual({ root: 'F#', quality: 'm' }))
})

// ─── Basic transposition ──────────────────────────────────────────────────────

describe('transposeChord — semitones = 0 (no transposition)', () => {
  it('returns chord unchanged', () => expect(transposeChord('D', 0)).toBe('D'))
  it('returns complex chord unchanged', () => expect(transposeChord('Gsus2', 0)).toBe('Gsus2'))
  it('returns slash chord unchanged', () => expect(transposeChord('D/F#', 0)).toBe('D/F#'))
})

// ─── Eb instrument (+9) — ALTO / BARI SAX ────────────────────────────────────
// Rule: concert pitch chord root + 9 semitones = what the player reads
// Key check: concert D (2) + 9 = 11 = B  ← most common worship key

describe('transposeChord — Eb instrument (+9 semitones)', () => {
  it('concert C  → A  (C=0,  0+9=9=A)', ()   => expect(transposeChord('C', 9)).toBe('A'))
  it('concert D  → B  (D=2,  2+9=11=B)', ()  => expect(transposeChord('D', 9)).toBe('B'))
  it('concert Eb → C  (Eb=3, 3+9=0=C)', ()   => expect(transposeChord('Eb', 9)).toBe('C'))
  it('concert E  → C# (E=4,  4+9=1=C#)', ()  => expect(transposeChord('E', 9)).toBe('C#'))
  it('concert G  → E  (G=7,  7+9=4=E)', ()   => expect(transposeChord('G', 9)).toBe('E'))
  it('concert A  → F# (A=9,  9+9=6=F#)', ()  => expect(transposeChord('A', 9)).toBe('F#'))
  it('concert Bb → G  (Bb=10,10+9=7=G)', ()  => expect(transposeChord('Bb', 9)).toBe('G'))

  it('preserves quality — Am  → F#m',    () => expect(transposeChord('Am', 9)).toBe('F#m'))
  it('preserves quality — Gsus2 → Esus2',() => expect(transposeChord('Gsus2', 9)).toBe('Esus2'))
  it('preserves quality — Gmaj7 → Emaj7',() => expect(transposeChord('Gmaj7', 9)).toBe('Emaj7'))
  it('preserves quality — Aadd9 → F#add9',()=> expect(transposeChord('Aadd9', 9)).toBe('F#add9'))
  it('preserves quality — Cmaj7 → Amaj7',() => expect(transposeChord('Cmaj7', 9)).toBe('Amaj7'))
  it('preserves quality — Esus4 → C#sus4',()=> expect(transposeChord('Esus4', 9)).toBe('C#sus4'))
  it('preserves quality — Dm7   → Bm7',  () => expect(transposeChord('Dm7', 9)).toBe('Bm7'))

  // Slash chord: BOTH root and bass note are transposed independently
  it('slash chord D/F#  → B/Eb  (D→B, F#(6)+9=Eb(3))',
    () => expect(transposeChord('D/F#', 9)).toBe('B/Eb'))
  it('slash chord G/B   → E/Ab  (G→E, B(11)+9=Ab(8))',
    () => expect(transposeChord('G/B', 9)).toBe('E/Ab'))
  it('slash chord Am/C  → F#m/A (A→F#, C(0)+9=A(9))',
    () => expect(transposeChord('Am/C', 9)).toBe('F#m/A'))
})

// ─── Bb instrument (+2) — TRUMPET / TENOR SAX ────────────────────────────────
// Rule: concert pitch + 2 semitones = what the player reads
// Key check: concert D (2) + 2 = 4 = E

describe('transposeChord — Bb instrument (+2 semitones)', () => {
  it('concert C  → D',  () => expect(transposeChord('C', 2)).toBe('D'))
  it('concert D  → E',  () => expect(transposeChord('D', 2)).toBe('E'))
  it('concert G  → A',  () => expect(transposeChord('G', 2)).toBe('A'))
  it('concert A  → B',  () => expect(transposeChord('A', 2)).toBe('B'))
  it('concert Bb → C',  () => expect(transposeChord('Bb', 2)).toBe('C'))
  it('concert Eb → F',  () => expect(transposeChord('Eb', 2)).toBe('F'))

  it('preserves quality — Am → Bm',    () => expect(transposeChord('Am', 2)).toBe('Bm'))
  it('preserves quality — Dsus2 → Esus2', () => expect(transposeChord('Dsus2', 2)).toBe('Esus2'))

  it('slash chord D/F# → E/Ab (D→E, F#(6)+2=Ab(8))',
    () => expect(transposeChord('D/F#', 2)).toBe('E/Ab'))
})

// ─── Concert instruments (+0) — GUITAR / BASS ────────────────────────────────

describe('transposeChord — concert pitch (+0)', () => {
  it('returns chord unchanged', () => expect(transposeChord('D', 0)).toBe('D'))
  it('returns slash chord unchanged', () => expect(transposeChord('D/F#', 0)).toBe('D/F#'))
  it('returns complex chord unchanged', () => expect(transposeChord('Aadd9', 0)).toBe('Aadd9'))
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('transposeChord — edge cases', () => {
  it('handles enharmonic wrap-around (B+2 = C#)', () => expect(transposeChord('B', 2)).toBe('C#'))
  it('handles wrap-around mod 12 (Bb+2 = C)', () => expect(transposeChord('Bb', 2)).toBe('C'))
  it('power chord — D5 → B5', () => expect(transposeChord('D5', 9)).toBe('B5'))
  it('diminished — Ddim → Bdim', () => expect(transposeChord('Ddim', 9)).toBe('Bdim'))
})

// ─── transposeChordsForDisplay ────────────────────────────────────────────────

describe('transposeChordsForDisplay', () => {
  it('returns empty array for empty input', () =>
    expect(transposeChordsForDisplay([], 'alto-sax')).toEqual([]))

  it('alto-sax: transposes all chords +9', () =>
    expect(transposeChordsForDisplay(['D', 'G', 'A'], 'alto-sax'))
      .toEqual(['B', 'E', 'F#']))

  it('trumpet: transposes all chords +2', () =>
    expect(transposeChordsForDisplay(['D', 'G', 'Am'], 'trumpet'))
      .toEqual(['E', 'A', 'Bm']))

  it('guitar: returns concert pitch unchanged', () =>
    expect(transposeChordsForDisplay(['D', 'G', 'A'], 'guitar-chords'))
      .toEqual(['D', 'G', 'A']))

  it('bass-clef: returns concert pitch unchanged', () =>
    expect(transposeChordsForDisplay(['D', 'G', 'A'], 'bass-clef'))
      .toEqual(['D', 'G', 'A']))

  it('vocals-lyrics: returns concert pitch unchanged (chords not shown anyway)', () =>
    expect(transposeChordsForDisplay(['D', 'G'], 'vocals-lyrics'))
      .toEqual(['D', 'G']))

  it('bari-sax uses same +9 offset as alto-sax', () =>
    expect(transposeChordsForDisplay(['D'], 'bari-sax'))
      .toEqual(transposeChordsForDisplay(['D'], 'alto-sax')))

  it('soprano-sax uses same +2 offset as trumpet', () =>
    expect(transposeChordsForDisplay(['D'], 'soprano-sax'))
      .toEqual(transposeChordsForDisplay(['D'], 'trumpet')))

  it('tenor-sax uses same +2 offset as trumpet', () =>
    expect(transposeChordsForDisplay(['D'], 'tenor-sax'))
      .toEqual(transposeChordsForDisplay(['D'], 'trumpet')))
})

// ─── DISPLAY_OFFSET sanity checks ─────────────────────────────────────────────

describe('DISPLAY_OFFSET constants', () => {
  it('Eb instruments are +9', () => {
    expect(DISPLAY_OFFSET['alto-sax']).toBe(9)
    expect(DISPLAY_OFFSET['bari-sax']).toBe(9)
  })
  it('Bb instruments are +2', () => {
    expect(DISPLAY_OFFSET['tenor-sax']).toBe(2)
    expect(DISPLAY_OFFSET['soprano-sax']).toBe(2)
    expect(DISPLAY_OFFSET['trumpet']).toBe(2)
  })
  it('concert instruments are +0', () => {
    expect(DISPLAY_OFFSET['guitar-chords']).toBe(0)
    expect(DISPLAY_OFFSET['bass-clef']).toBe(0)
    expect(DISPLAY_OFFSET['vocals-lyrics']).toBe(0)
  })
})
