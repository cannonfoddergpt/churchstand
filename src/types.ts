// ─── Instrument types ────────────────────────────────────────────────────────

export type InstrumentType =
  | 'alto-sax'      // Eb instrument: display chords +9 semitones from concert
  | 'bari-sax'      // Eb instrument: display chords +9 semitones from concert
  | 'tenor-sax'     // Bb instrument: display chords +2 semitones from concert
  | 'soprano-sax'   // Bb instrument: display chords +2 semitones from concert
  | 'trumpet'       // Bb instrument: display chords +2 semitones from concert
  | 'guitar-chords' // Concert pitch, chord names
  | 'bass-clef'     // Concert pitch, bass clef notation
  | 'vocals-lyrics' // Lyrics only, no chords

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  'alto-sax':      'Alto Saxophone (Eb)',
  'bari-sax':      'Baritone Saxophone (Eb)',
  'tenor-sax':     'Tenor Saxophone (Bb)',
  'soprano-sax':   'Soprano Saxophone (Bb)',
  'trumpet':       'Trumpet (Bb)',
  'guitar-chords': 'Guitar',
  'bass-clef':     'Double Bass',
  'vocals-lyrics': 'Vocals / Congregation',
}

// Semitones to ADD to concert pitch chords when rendering for this instrument.
// Eb instruments: player reads a major 6th (9 semitones) higher than concert.
// Bb instruments: player reads a major 2nd (2 semitones) higher than concert.
export const DISPLAY_OFFSET: Record<InstrumentType, number> = {
  'alto-sax':      9,
  'bari-sax':      9,
  'tenor-sax':     2,
  'soprano-sax':   2,
  'trumpet':       2,
  'guitar-chords': 0,
  'bass-clef':     0,
  'vocals-lyrics': 0,
}

// ─── View modes ──────────────────────────────────────────────────────────────

export type ViewMode =
  | 'director-controlled' // Tablet follows director's active section
  | 'free-scroll'         // Musician scrolls independently
  | 'page-turn'           // Two sections at a time, tap to advance

// ─── User / profile ──────────────────────────────────────────────────────────

export type DisplayFormat = 'chord-chart' | 'notation'

export interface MusicianProfile {
  id: string           // crypto.randomUUID(), persisted in localStorage
  name: string
  instrument: InstrumentType
  viewMode: ViewMode
  displayFormat: DisplayFormat
}

export interface ConnectedUser extends MusicianProfile {
  connectedAt: string  // ISO timestamp
}

// ─── Song / setlist data model ───────────────────────────────────────────────

export interface SongSection {
  id: string
  label: string           // 'Verse 1', 'Chorus', 'Bridge', etc.
  chordsInConcert: string[] // Chord names in concert pitch, e.g. ['D', 'G', 'D', 'A7']
  lyrics: string
}

export interface Song {
  id: string
  title: string
  concertKey: string    // e.g. 'D'
  timeSignature: string // e.g. '4/4'
  bpm: number | null
  sections: SongSection[]
  sectionOrder: string[] // Section IDs — reordering this array reorders the chart
}

export interface BridgeChords {
  id: string
  fromSongId: string
  toSongId: string
  chordsInConcert: string[] // 4-bar bridge sequence in concert pitch
  aiGenerated: boolean
  accepted: boolean         // Director must Accept before it's shown to musicians
}

export interface Setlist {
  date: string              // ISO date string
  songs: Song[]
  bridges: BridgeChords[]
  activeSongId: string | null
  activeSectionId: string | null
  directorId: string | null // userId of current director
  editorIds: string[]       // userIds with granted edit rights
}

// ─── WebSocket message protocol ──────────────────────────────────────────────

// Client → Server
export type ClientMessage =
  | { type: 'join'; profile: MusicianProfile }
  | { type: 'mutate'; userId: string; payload: Partial<Setlist> }
  | { type: 'set_active_section'; userId: string; songId: string | null; sectionId: string | null }
  | { type: 'grant_edit'; userId: string; targetUserId: string }
  | { type: 'revoke_edit'; userId: string; targetUserId: string }
  | { type: 'set_director'; userId: string; targetUserId: string }

// Server → Client
export type ServerMessage =
  | { type: 'full_state'; setlist: Setlist; connectedUsers: ConnectedUser[] }
  | { type: 'users_updated'; connectedUsers: ConnectedUser[] }
  | { type: 'error'; message: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createEmptySetlist(): Setlist {
  return {
    date: new Date().toISOString().split('T')[0],
    songs: [],
    bridges: [],
    activeSongId: null,
    activeSectionId: null,
    directorId: null,
    editorIds: [],
  }
}
