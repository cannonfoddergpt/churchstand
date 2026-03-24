import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetlistStore } from '../../store/setlist'
import { useWebSocket } from '../../hooks/useWebSocket'
import { ConnectionBanner } from '../shared/ConnectionBanner'
import { NotationStaff } from '../shared/NotationStaff'
import { transposeChordsForDisplay } from '../../lib/transposition'
import { Song, SongSection, ViewMode, InstrumentType, DisplayFormat, MusicianProfile } from '../../types'

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  song,
  isActive,
  instrument,
  displayFormat,
}: {
  section: SongSection
  song: Song
  isActive: boolean
  instrument: InstrumentType
  displayFormat: DisplayFormat
}) {
  const transposedChords = transposeChordsForDisplay(
    section.chordsInConcert,
    instrument,
  )
  const showChords = instrument !== 'vocals-lyrics'
  const isBass = instrument === 'bass-clef'
  const useNotation = displayFormat === 'notation' && showChords

  return (
    <div style={{ ...styles.sectionCard, ...(isActive ? styles.sectionCardActive : {}) }}>
      <div style={styles.sectionLabel}>
        {section.label}
        {isBass && <span style={styles.clefBadge}> Bass Clef</span>}
      </div>
      {showChords && transposedChords.length > 0 && (
        useNotation ? (
          <NotationStaff chords={transposedChords} instrument={instrument} />
        ) : (
          <div style={styles.chords}>
            {transposedChords.map((chord, i) => (
              <span key={i} style={styles.chord}>{chord}</span>
            ))}
          </div>
        )
      )}
      {section.lyrics && (
        <div style={styles.lyrics}>
          {section.lyrics.split('\n').map((line, i) => (
            <div key={i}>{line || <br />}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function MusicianView() {
  const navigate = useNavigate()
  const { send } = useWebSocket()
  const { setlist, myProfile, viewMode, setViewMode } = useSetlistStore()
  const [pageTurnIndex, setPageTurnIndex] = useState(0)

  // Redirect to join if no profile
  useEffect(() => {
    if (!myProfile) navigate('/join')
  }, [myProfile, navigate])

  // In director-controlled mode, reset page turn index when active section changes
  useEffect(() => {
    if (viewMode !== 'director-controlled' || !setlist.activeSongId) return
    const activeSong = setlist.songs.find((s) => s.id === setlist.activeSongId)
    if (!activeSong) return
    const idx = activeSong.sectionOrder.indexOf(setlist.activeSectionId ?? '')
    if (idx !== -1) {
      setPageTurnIndex(Math.floor(idx / 2) * 2)
    }
  }, [setlist.activeSongId, setlist.activeSectionId, viewMode])

  if (!myProfile) return null

  const instrument = myProfile.instrument
  const displayFormat = myProfile.displayFormat ?? 'chord-chart'

  // Flatten all sections across all songs in order for free-scroll / page-turn
  const allSections: Array<{ section: SongSection; song: Song }> = []
  for (const song of setlist.songs) {
    for (const sectionId of song.sectionOrder) {
      const section = song.sections.find((s) => s.id === sectionId)
      if (section) allSections.push({ section, song })
    }
  }

  const activeSong = setlist.songs.find((s) => s.id === setlist.activeSongId)
  const activeSectionId = setlist.activeSectionId

  // ── View mode: director-controlled ────────────────────────────────────────
  if (viewMode === 'director-controlled') {
    const activeSection = activeSong?.sections.find((s) => s.id === activeSectionId)

    return (
      <div style={styles.page}>
        <ConnectionBanner />
        <Header
          song={activeSong}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRejoin={() => navigate('/join')}
          myProfile={myProfile}
        />
        <div style={styles.content}>
          {activeSection && activeSong ? (
            <SectionCard
              section={activeSection}
              song={activeSong}
              isActive
              instrument={instrument}
              displayFormat={displayFormat}
            />
          ) : (
            <div style={styles.waiting}>
              Waiting for director to start…
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── View mode: page-turn ──────────────────────────────────────────────────
  if (viewMode === 'page-turn') {
    const page = allSections.slice(pageTurnIndex, pageTurnIndex + 2)
    const canGoBack = pageTurnIndex > 0
    const canGoForward = pageTurnIndex + 2 < allSections.length

    return (
      <div style={styles.page}>
        <ConnectionBanner />
        <Header
          song={activeSong}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRejoin={() => navigate('/join')}
          myProfile={myProfile}
        />
        <div style={styles.pageTurnGrid}>
          {page.map(({ section, song }) => (
            <SectionCard
              key={section.id}
              section={section}
              song={song}
              isActive={section.id === activeSectionId}
              instrument={instrument}
              displayFormat={displayFormat}
            />
          ))}
        </div>
        <div style={styles.pageTurnNav}>
          <button
            style={{ ...styles.navBtn, opacity: canGoBack ? 1 : 0.3 }}
            disabled={!canGoBack}
            onClick={() => setPageTurnIndex((i) => Math.max(0, i - 2))}
          >
            ◀ Prev page
          </button>
          <span style={styles.pageIndicator}>
            {Math.floor(pageTurnIndex / 2) + 1} / {Math.ceil(allSections.length / 2)}
          </span>
          <button
            style={{ ...styles.navBtn, opacity: canGoForward ? 1 : 0.3 }}
            disabled={!canGoForward}
            onClick={() => setPageTurnIndex((i) => Math.min(allSections.length - 1, i + 2))}
          >
            Next page ▶
          </button>
        </div>
      </div>
    )
  }

  // ── View mode: free-scroll ────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <ConnectionBanner />
      <Header
        song={activeSong}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRejoin={() => navigate('/join')}
        myProfile={myProfile}
      />
      <div style={styles.content}>
        {allSections.length === 0 ? (
          <div style={styles.waiting}>No songs in the setlist yet.</div>
        ) : (
          allSections.map(({ section, song }) => (
            <SectionCard
              key={section.id}
              section={section}
              song={song}
              isActive={section.id === activeSectionId}
              instrument={instrument}
              displayFormat={displayFormat}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  song,
  viewMode,
  onViewModeChange,
  onRejoin,
  myProfile,
}: {
  song: Song | undefined
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  onRejoin: () => void
  myProfile: MusicianProfile
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerTitle}>{song?.title ?? 'ChurchStand'}</span>
        {song && <span style={styles.keyBadge}>{song.concertKey}</span>}
      </div>
      <div style={styles.headerRight}>
        <button style={styles.menuBtn} onClick={() => setShowMenu(!showMenu)}>≡</button>
        {showMenu && (
          <div style={styles.menu}>
            <div style={styles.menuSection}>View mode</div>
            {(['director-controlled', 'free-scroll', 'page-turn'] as ViewMode[]).map((m) => (
              <button
                key={m}
                style={{
                  ...styles.menuItem,
                  ...(viewMode === m ? styles.menuItemActive : {}),
                }}
                onClick={() => { onViewModeChange(m); setShowMenu(false) }}
              >
                {m === 'director-controlled' ? '📡 Director-controlled'
                  : m === 'free-scroll' ? '📜 Free scroll'
                  : '📖 Page turn'}
              </button>
            ))}
            <div style={styles.menuDivider} />
            <button style={styles.menuItem} onClick={onRejoin}>
              🔄 Re-join ({myProfile.name})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8f8f8', display: 'flex', flexDirection: 'column' },
  header: {
    background: '#1a1a2e', color: '#fff', padding: '12px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  keyBadge: {
    background: '#fff2', padding: '2px 8px', borderRadius: 4,
    fontSize: 13, fontWeight: 600,
  },
  headerRight: { position: 'relative' },
  menuBtn: {
    background: 'none', border: 'none', color: '#fff',
    fontSize: 22, cursor: 'pointer', padding: '4px 8px',
  },
  menu: {
    position: 'absolute', right: 0, top: 36,
    background: '#fff', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    minWidth: 210, zIndex: 200, overflow: 'hidden',
  },
  menuSection: { padding: '10px 14px 4px', fontSize: 11, color: '#999', fontWeight: 700, textTransform: 'uppercase' },
  menuItem: {
    display: 'block', width: '100%', padding: '10px 14px',
    background: 'none', border: 'none', textAlign: 'left',
    fontSize: 14, cursor: 'pointer', color: '#222',
  },
  menuItemActive: { background: '#f0f0ff', fontWeight: 700 },
  menuDivider: { height: 1, background: '#eee', margin: '4px 0' },
  content: { flex: 1, padding: 16, maxWidth: 700, margin: '0 auto', width: '100%' },
  pageTurnGrid: {
    flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 12, padding: 12,
  },
  pageTurnNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee',
  },
  navBtn: {
    padding: '8px 16px', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  },
  pageIndicator: { fontSize: 13, color: '#666' },
  sectionCard: {
    background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12,
    border: '2px solid transparent', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  sectionCardActive: {
    borderColor: '#1a1a2e', boxShadow: '0 2px 12px rgba(26,26,46,0.2)',
  },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 },
  clefBadge: { fontSize: 10, background: '#e0e0ff', color: '#444', padding: '1px 5px', borderRadius: 3, marginLeft: 4 },
  chords: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chord: {
    fontSize: 22, fontWeight: 700, color: '#1a1a2e',
    background: '#f0f0ff', padding: '4px 10px', borderRadius: 6,
  },
  lyrics: { fontSize: 16, lineHeight: 1.6, color: '#333', whiteSpace: 'pre-wrap' },
  waiting: { textAlign: 'center', marginTop: 80, fontSize: 16, color: '#999' },
}
