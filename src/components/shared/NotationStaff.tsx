/**
 * NotationStaff — renders chord symbols above a treble or bass clef staff
 * using VexFlow 5.
 *
 * Layout: one bar per section. Each chord in chordsInConcert gets one beat
 * position. Whole notes are used as invisible anchors for the ChordSymbol
 * modifiers (standard worship-chart style).
 *
 * Clef is determined by instrument:
 *   bass-clef → bass clef, middle line D3
 *   all others → treble clef, middle line B4
 */
import { useEffect, useRef } from 'react'
import { InstrumentType } from '../../types'

interface NotationStaffProps {
  /** Chord names already transposed for this instrument */
  chords: string[]
  instrument: InstrumentType
  /** Width in px; height is fixed at 120px */
  width?: number
}

// Anchor note for each clef — placed on the middle line so it's unobtrusive
const ANCHOR_KEY: Record<'treble' | 'bass', string> = {
  treble: 'b/4', // middle line of treble clef
  bass: 'd/3',   // middle line of bass clef
}

export function NotationStaff({ chords, instrument, width = 600 }: NotationStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || chords.length === 0) return

    // Dynamically import VexFlow to avoid SSR issues and keep the bundle lazy
    import('vexflow').then(({ Renderer, Stave, StaveNote, Voice, Formatter, ChordSymbol }) => {
      // Clear previous render
      container.innerHTML = ''

      const clef = instrument === 'bass-clef' ? 'bass' : 'treble'
      const anchorKey = ANCHOR_KEY[clef]

      const STAVE_X = 10
      const STAVE_Y = 30
      const STAVE_WIDTH = width - 20
      const HEIGHT = 130

      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(width, HEIGHT)
      const context = renderer.getContext()
      context.setFont('Arial', 12)

      const stave = new Stave(STAVE_X, STAVE_Y, STAVE_WIDTH)
      stave.addClef(clef)
      stave.addTimeSignature('4/4')
      stave.setContext(context).draw()

      // Build one note per chord, each a whole note (duration 'w')
      // Spread evenly: if > 4 chords, use half notes; > 8, quarter notes
      let duration = 'w'
      let numBeats = 4
      if (chords.length > 8) { duration = 'q'; numBeats = chords.length }
      else if (chords.length > 4) { duration = 'h'; numBeats = chords.length * 2 }

      const notes = chords.map((chordName) => {
        const note = new StaveNote({
          keys: [anchorKey],
          duration,
          clef,
        })

        // Hide the notehead — we only want the chord symbol above the staff
        note.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' })
        // Hide the stem
        note.setStemStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' })

        // Build the ChordSymbol
        const chordSymbol = buildChordSymbol(ChordSymbol, chordName)
        note.addModifier(chordSymbol, 0)

        return note
      })

      const voice = new Voice({ numBeats, beatValue: 4 })
        .setMode(Voice.Mode.SOFT)  // don't throw on beat count mismatch
      voice.addTickables(notes)

      new Formatter()
        .joinVoices([voice])
        .format([voice], STAVE_WIDTH - 60)

      voice.draw(context, stave)
    }).catch((err) => {
      console.error('[NotationStaff] VexFlow render error:', err)
      // Fallback: show plain chord names if VexFlow fails
      if (container) {
        container.innerHTML = `<div style="padding:8px;font-size:18px;font-weight:700;color:#1a1a2e">${chords.join('  ')}</div>`
      }
    })
  }, [chords, instrument, width])

  return (
    <div
      ref={containerRef}
      style={{ width, minHeight: 130, overflow: 'hidden' }}
      aria-label={`Staff notation: ${chords.join(' ')}`}
    />
  )
}

/**
 * Parse a chord name like "Dsus2", "F#m7", "Bbmaj7" into a VexFlow 5 ChordSymbol.
 * VexFlow 5 API: addText(), addGlyph('#'), addGlyph('b'), addTextSuperscript()
 */
function buildChordSymbol(
  ChordSymbol: typeof import('vexflow').ChordSymbol,
  chordName: string,
): InstanceType<typeof import('vexflow').ChordSymbol> {
  const cs = new ChordSymbol()
  cs.setFontSize(15)

  // Parse: root letter, optional accidental, quality
  const match = chordName.match(/^([A-G])([#b]?)(.*)$/)
  if (!match) {
    cs.addText(chordName)
    return cs
  }

  const [, letter, accidental, quality] = match

  cs.addText(letter)

  if (accidental === '#') {
    cs.addGlyph('#')
  } else if (accidental === 'b') {
    cs.addGlyph('b')
  }

  // Map common quality strings to readable superscript suffixes
  if (quality) {
    const qualityMap: Record<string, string> = {
      'm':     'm',
      'min':   'm',
      'maj7':  'maj7',
      'M7':    'maj7',
      'm7':    'm7',
      'min7':  'm7',
      '7':     '7',
      'sus2':  'sus2',
      'sus4':  'sus4',
      'add9':  'add9',
      'add2':  'add2',
      'dim':   '°',
      'dim7':  '°7',
      'm7b5':  'ø7',
      'aug':   '+',
      '5':     '5',
      '6':     '6',
      'm6':    'm6',
      'maj9':  'maj9',
      '9':     '9',
      'm9':    'm9',
    }
    const mapped = qualityMap[quality] ?? quality
    cs.addTextSuperscript(mapped)
  }

  return cs
}
