import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InstrumentType, INSTRUMENT_LABELS, DisplayFormat, MusicianProfile } from '../../types'
import { useSetlistStore } from '../../store/setlist'

const INSTRUMENTS: InstrumentType[] = [
  'alto-sax', 'bari-sax', 'tenor-sax', 'soprano-sax',
  'trumpet', 'guitar-chords', 'bass-clef', 'vocals-lyrics',
]

export function JoinFlow() {
  const navigate = useNavigate()
  const { myProfile, setMyProfile } = useSetlistStore()

  const [name, setName] = useState(myProfile?.name ?? '')
  const [instrument, setInstrument] = useState<InstrumentType>(
    myProfile?.instrument ?? 'guitar-chords',
  )
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>(
    myProfile?.displayFormat ?? 'chord-chart',
  )
  const [error, setError] = useState('')

  const showNotationOption = instrument !== 'vocals-lyrics' && instrument !== 'guitar-chords'

  function handleJoin() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter your name.'); return }

    const profile: MusicianProfile = {
      id: myProfile?.id ?? crypto.randomUUID(),
      name: trimmed,
      instrument,
      viewMode: myProfile?.viewMode ?? 'director-controlled',
      displayFormat: showNotationOption ? displayFormat : 'chord-chart',
    }
    setMyProfile(profile)
    navigate('/musician')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>ChurchStand</h1>
        <p style={styles.subtitle}>Enter your details to join today's rehearsal.</p>

        <label style={styles.label}>Your name</label>
        <input
          style={styles.input}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="e.g. Sarah"
          autoFocus
        />

        <label style={styles.label}>Instrument</label>
        <select
          style={styles.select}
          value={instrument}
          onChange={(e) => setInstrument(e.target.value as InstrumentType)}
        >
          {INSTRUMENTS.map((inst) => (
            <option key={inst} value={inst}>{INSTRUMENT_LABELS[inst]}</option>
          ))}
        </select>

        {showNotationOption && (
          <>
            <label style={styles.label}>Chord display</label>
            <div style={styles.toggleRow}>
              {(['chord-chart', 'notation'] as DisplayFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  style={{
                    ...styles.toggleBtn,
                    ...(displayFormat === fmt ? styles.toggleBtnActive : {}),
                  }}
                  onClick={() => setDisplayFormat(fmt)}
                >
                  {fmt === 'chord-chart' ? 'Chord chart' : 'Staff notation'}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} onClick={handleJoin}>
          Join Rehearsal →
        </button>

        <p style={styles.hint}>
          Your name and instrument are remembered for next week.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#1a1a2e', padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '40px 36px',
    width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 28 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#444' },
  input: {
    display: 'block', width: '100%', padding: '10px 12px', fontSize: 16,
    border: '1.5px solid #ddd', borderRadius: 8, marginBottom: 20, outline: 'none',
  },
  select: {
    display: 'block', width: '100%', padding: '10px 12px', fontSize: 15,
    border: '1.5px solid #ddd', borderRadius: 8, marginBottom: 24,
    background: '#fff', appearance: 'none', cursor: 'pointer',
  },
  toggleRow: { display: 'flex', gap: 8, marginBottom: 24 },
  toggleBtn: {
    flex: 1, padding: '9px 12px', fontSize: 14, border: '1.5px solid #ddd',
    borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#444',
  },
  toggleBtnActive: {
    background: '#1a1a2e', color: '#fff', border: '1.5px solid #1a1a2e', fontWeight: 700,
  },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: {
    display: 'block', width: '100%', padding: '13px', fontSize: 16,
    fontWeight: 700, background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 },
}
