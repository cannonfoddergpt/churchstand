import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSetlistStore } from '../../store/setlist'
import { useWebSocket } from '../../hooks/useWebSocket'
import { ConnectionBanner } from '../shared/ConnectionBanner'
import { Song, SongSection, Setlist, MusicianProfile } from '../../types'

// ─── Responsive width hook ────────────────────────────────────────────────────

function useIsNarrow(breakpoint = 768) {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) },
    () => window.innerWidth < breakpoint,
    () => false,
  )
}

// ─── Sortable section row ─────────────────────────────────────────────────────

function SortableSectionRow({
  section,
  isActive,
  onActivate,
}: {
  section: SongSection
  isActive: boolean
  onActivate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        ...styles.sectionRow,
        ...(isActive ? styles.sectionRowActive : {}),
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <span style={styles.dragHandle} {...attributes} {...listeners}>⠿</span>
      <button style={styles.sectionRowLabel} onClick={onActivate}>
        <strong>{section.label}</strong>
        {section.chordsInConcert.length > 0 && (
          <span style={styles.chordPreview}> — {section.chordsInConcert.slice(0, 4).join(' ')}{section.chordsInConcert.length > 4 ? '…' : ''}</span>
        )}
      </button>
      {isActive && <span style={styles.activeBadge}>▶ ACTIVE</span>}
    </div>
  )
}

// ─── Song editor panel ────────────────────────────────────────────────────────

function SongEditor({
  song,
  setlist,
  onMutate,
  onActivateSection,
}: {
  song: Song
  setlist: Setlist
  onMutate: (patch: Partial<Setlist>) => void
  onActivateSection: (songId: string, sectionId: string | null) => void
}) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = song.sectionOrder.indexOf(active.id as string)
    const newIdx = song.sectionOrder.indexOf(over.id as string)
    const newOrder = arrayMove(song.sectionOrder, oldIdx, newIdx)
    const updatedSong: Song = { ...song, sectionOrder: newOrder }
    onMutate({
      songs: setlist.songs.map((s) => (s.id === song.id ? updatedSong : s)),
    })
  }

  function addSection() {
    const id = crypto.randomUUID()
    const newSection: SongSection = {
      id,
      label: `Section ${song.sections.length + 1}`,
      chordsInConcert: [],
      lyrics: '',
    }
    const updatedSong: Song = {
      ...song,
      sections: [...song.sections, newSection],
      sectionOrder: [...song.sectionOrder, id],
    }
    onMutate({ songs: setlist.songs.map((s) => (s.id === song.id ? updatedSong : s)) })
    setEditingSectionId(id)
  }

  function updateSong(patch: Partial<Song>) {
    const updatedSong: Song = { ...song, ...patch }
    onMutate({ songs: setlist.songs.map((s) => (s.id === song.id ? updatedSong : s)) })
  }

  function updateSection(sectionId: string, patch: Partial<SongSection>) {
    const updatedSong: Song = {
      ...song,
      sections: song.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }
    onMutate({ songs: setlist.songs.map((s) => (s.id === song.id ? updatedSong : s)) })
  }

  function deleteSection(sectionId: string) {
    const updatedSong: Song = {
      ...song,
      sections: song.sections.filter((s) => s.id !== sectionId),
      sectionOrder: song.sectionOrder.filter((id) => id !== sectionId),
    }
    onMutate({ songs: setlist.songs.map((s) => (s.id === song.id ? updatedSong : s)) })
    if (editingSectionId === sectionId) setEditingSectionId(null)
  }

  const editingSection = song.sections.find((s) => s.id === editingSectionId)

  return (
    <div style={styles.songEditor}>
      <div style={styles.songEditorHeader}>
        <input
          style={styles.songTitleInput}
          value={song.title}
          onChange={(e) => updateSong({ title: e.target.value })}
          placeholder="Song title"
        />
        <input
          style={styles.keyInput}
          value={song.concertKey}
          onChange={(e) => updateSong({ concertKey: e.target.value })}
          placeholder="Key"
          title="Concert key (e.g. D, Bb, F#)"
        />
      </div>

      {/* Section list — drag to reorder */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={song.sectionOrder} strategy={verticalListSortingStrategy}>
          {song.sectionOrder.map((sectionId) => {
            const section = song.sections.find((s) => s.id === sectionId)
            if (!section) return null
            return (
              <SortableSectionRow
                key={sectionId}
                section={section}
                isActive={setlist.activeSectionId === sectionId && setlist.activeSongId === song.id}
                onActivate={() => {
                  const isCurrentlyActive =
                    setlist.activeSectionId === sectionId && setlist.activeSongId === song.id
                  onActivateSection(song.id, isCurrentlyActive ? null : sectionId)
                  setEditingSectionId(sectionId)
                }}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      <button style={styles.addSectionBtn} onClick={addSection}>+ Add section</button>

      {/* Section editor */}
      {editingSection && (
        <div style={styles.sectionEditor}>
          <div style={styles.sectionEditorHeader}>
            <input
              style={styles.sectionLabelInput}
              value={editingSection.label}
              onChange={(e) => updateSection(editingSection.id, { label: e.target.value })}
              placeholder="Section label (e.g. Verse 1)"
            />
            <button style={styles.deleteSectionBtn} onClick={() => deleteSection(editingSection.id)}>
              Delete section
            </button>
          </div>
          <label style={styles.fieldLabel}>Chords (concert pitch, space-separated)</label>
          <input
            style={styles.chordsInput}
            value={editingSection.chordsInConcert.join(' ')}
            onChange={(e) =>
              updateSection(editingSection.id, {
                chordsInConcert: e.target.value.split(/\s+/).filter(Boolean),
              })
            }
            placeholder="e.g. D G D A7"
          />
          <label style={styles.fieldLabel}>Lyrics</label>
          <textarea
            style={styles.lyricsInput}
            value={editingSection.lyrics}
            onChange={(e) => updateSection(editingSection.id, { lyrics: e.target.value })}
            placeholder="Enter lyrics here…"
            rows={4}
          />
        </div>
      )}
    </div>
  )
}

// ─── Join QR code ─────────────────────────────────────────────────────────────

function JoinQRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    // Build the join URL using the current host (works on LAN)
    const url = `${window.location.protocol}//${window.location.host}/join`
    setJoinUrl(url)

    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 160,
          margin: 1,
          color: { dark: '#1a1a2e', light: '#ffffff' },
        })
      }
    })
  }, [])

  return (
    <div style={styles.qrBlock}>
      <div style={styles.qrLabel}>Scan to join</div>
      <canvas ref={canvasRef} style={{ borderRadius: 6 }} />
      <div style={styles.qrUrl}>{joinUrl}</div>
    </div>
  )
}

// ─── Connected users sidebar ──────────────────────────────────────────────────

function UsersSidebar({
  setlist,
  onGrantEdit,
  onRevokeEdit,
}: {
  setlist: Setlist
  onGrantEdit: (targetUserId: string) => void
  onRevokeEdit: (targetUserId: string) => void
}) {
  const connectedUsers = useSetlistStore((s) => s.connectedUsers)
  const myProfile = useSetlistStore((s) => s.myProfile)

  return (
    <div style={styles.sidebar}>
      <h3 style={styles.sidebarTitle}>Connected ({connectedUsers.length})</h3>
      {connectedUsers.map((user) => {
        const isDirector = setlist.directorId === user.id
        const hasEditRights = setlist.editorIds.includes(user.id)
        const isMe = myProfile?.id === user.id

        return (
          <div key={user.id} style={styles.userRow}>
            <div>
              <span style={styles.dot}>●</span>
              <strong>{user.name}</strong>
              {isMe && <span style={styles.meBadge}> (you)</span>}
              {isDirector && <span style={styles.directorBadge}> 👑</span>}
              <div style={styles.userInstrument}>{user.instrument}</div>
            </div>
            {!isDirector && !isMe && (
              <button
                style={{
                  ...styles.editRightsBtn,
                  background: hasEditRights ? '#fee2e2' : '#f0fdf4',
                  color: hasEditRights ? '#b91c1c' : '#166534',
                }}
                onClick={() =>
                  hasEditRights ? onRevokeEdit(user.id) : onGrantEdit(user.id)
                }
              >
                {hasEditRights ? 'Revoke edit' : 'Allow edit'}
              </button>
            )}
          </div>
        )
      })}
      {connectedUsers.length === 0 && (
        <p style={styles.noUsers}>No one else connected yet.</p>
      )}
      <JoinQRCode />
    </div>
  )
}

// ─── Main director view ───────────────────────────────────────────────────────

export function DirectorView() {
  const { send } = useWebSocket()
  const { setlist, myProfile, setMyProfile } = useSetlistStore()
  const isNarrow = useIsNarrow()
  const [selectedSongId, setSelectedSongId] = useState<string | null>(
    setlist.songs[0]?.id ?? null,
  )

  // Directors open /director directly, bypassing /join.
  // Auto-create a minimal profile so the WebSocket join message is sent
  // and mutations have a userId to attach to.
  useEffect(() => {
    if (!myProfile) {
      const profile: MusicianProfile = {
        id: crypto.randomUUID(),
        name: 'Director',
        instrument: 'vocals-lyrics',
        viewMode: 'director-controlled',
        displayFormat: 'chord-chart',
      }
      setMyProfile(profile)
    }
  }, [myProfile, setMyProfile])

  const userId = myProfile?.id ?? ''

  function sendMutate(patch: Partial<Setlist>) {
    send({ type: 'mutate', userId, payload: patch })
  }

  function sendActiveSection(songId: string, sectionId: string | null) {
    send({ type: 'set_active_section', userId, songId, sectionId })
  }

  function deleteSong(songId: string) {
    const remaining = setlist.songs.filter((s) => s.id !== songId)
    sendMutate({ songs: remaining })
    if (selectedSongId === songId) {
      setSelectedSongId(remaining[0]?.id ?? null)
    }
    if (setlist.activeSongId === songId) {
      send({ type: 'set_active_section', userId, songId, sectionId: null })
    }
  }

  function addSong() {
    const id = crypto.randomUUID()
    const newSong: Song = {
      id,
      title: 'New Song',
      concertKey: 'D',
      timeSignature: '4/4',
      bpm: null,
      sections: [],
      sectionOrder: [],
    }
    sendMutate({ songs: [...setlist.songs, newSong] })
    setSelectedSongId(id)
  }

  const selectedSong = setlist.songs.find((s) => s.id === selectedSongId)

  // Navigate through sections with keyboard
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!myProfile) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      advanceSection(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      advanceSection(-1)
    }
  }

  function advanceSection(delta: 1 | -1) {
    if (!myProfile) return
    const song = setlist.songs.find((s) => s.id === setlist.activeSongId)
    if (!song) {
      // No active song — activate first section of first song
      const first = setlist.songs[0]
      if (first) sendActiveSection(first.id, first.sectionOrder[0] ?? null)
      return
    }
    const currentIdx = song.sectionOrder.indexOf(setlist.activeSectionId ?? '')
    const nextIdx = currentIdx + delta
    if (nextIdx >= 0 && nextIdx < song.sectionOrder.length) {
      sendActiveSection(song.id, song.sectionOrder[nextIdx])
    }
  }

  return (
    <div style={{ ...styles.layout, gridTemplateColumns: isNarrow ? '1fr' : '220px 1fr 240px', gridTemplateRows: isNarrow ? 'auto 1fr auto' : '1fr' }} tabIndex={0} onKeyDown={handleKeyDown}>
      <ConnectionBanner />

      {/* Left: song list */}
      <div style={styles.songList}>
        <div style={styles.songListHeader}>
          <span style={styles.appName}>ChurchStand</span>
          <button style={styles.addSongBtn} onClick={addSong}>+ Song</button>
        </div>
        {setlist.songs.map((song) => (
          <div
            key={song.id}
            style={{
              ...styles.songListItem,
              ...(selectedSongId === song.id ? styles.songListItemActive : {}),
            }}
          >
            <button style={styles.songListItemBtn} onClick={() => setSelectedSongId(song.id)}>
              <span>{song.title}</span>
              <span style={styles.keyTag}>{song.concertKey}</span>
            </button>
            <button style={styles.deleteSongBtn} onClick={() => deleteSong(song.id)} title="Delete song">×</button>
          </div>
        ))}
        {setlist.songs.length === 0 && (
          <p style={styles.emptySongs}>No songs yet. Add one to get started.</p>
        )}

        {/* Nav controls */}
        <div style={styles.navControls}>
          <button style={styles.navBtn} onClick={() => advanceSection(-1)}>◀ Prev</button>
          <button style={styles.navBtn} onClick={() => advanceSection(1)}>Next ▶</button>
        </div>
      </div>

      {/* Center: section editor */}
      <div style={styles.editorPanel}>
        {selectedSong ? (
          <SongEditor
            song={selectedSong}
            setlist={setlist}
            onMutate={sendMutate}
            onActivateSection={sendActiveSection}
          />
        ) : (
          <div style={styles.emptyEditor}>Select a song to edit it.</div>
        )}
      </div>

      {/* Right: connected users */}
      <UsersSidebar
        setlist={setlist}
        onGrantEdit={(targetUserId) =>
          myProfile && send({ type: 'grant_edit', userId: myProfile.id, targetUserId })
        }
        onRevokeEdit={(targetUserId) =>
          myProfile && send({ type: 'revoke_edit', userId: myProfile.id, targetUserId })
        }
      />
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'grid', gridTemplateColumns: '220px 1fr 240px',
    height: '100vh', overflow: 'hidden', outline: 'none',
  },
  // Song list
  songList: {
    background: '#1a1a2e', color: '#fff', display: 'flex',
    flexDirection: 'column', overflow: 'hidden',
  },
  songListHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  appName: { fontSize: 14, fontWeight: 700, letterSpacing: 1 },
  addSongBtn: {
    background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  songListItem: {
    display: 'flex', alignItems: 'center',
    background: 'none', color: '#ccc', fontSize: 13,
  },
  songListItemBtn: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flex: 1, padding: '11px 12px', background: 'none', border: 'none', color: 'inherit',
    textAlign: 'left', cursor: 'pointer', fontSize: 13, minWidth: 0,
  },
  songListItemActive: { background: 'rgba(255,255,255,0.12)', color: '#fff' },
  deleteSongBtn: {
    background: 'none', border: 'none', color: '#666', cursor: 'pointer',
    fontSize: 18, padding: '0 10px', lineHeight: 1, flexShrink: 0,
  },
  keyTag: {
    fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '1px 6px',
    borderRadius: 3, fontWeight: 600, flexShrink: 0,
  },
  emptySongs: { padding: 16, fontSize: 12, color: '#666', textAlign: 'center' },
  navControls: {
    marginTop: 'auto', display: 'flex', gap: 8, padding: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  navBtn: {
    flex: 1, padding: '8px', background: 'rgba(255,255,255,0.1)', border: 'none',
    color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
  // Song editor
  editorPanel: { overflow: 'auto', background: '#f5f5f7' },
  emptyEditor: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#999', fontSize: 14,
  },
  songEditor: { padding: 20 },
  songEditorHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  songTitleInput: {
    fontSize: 20, fontWeight: 700, border: 'none', borderBottom: '2px solid #ddd',
    outline: 'none', background: 'transparent', flex: 1, minWidth: 0,
    padding: '2px 0',
  },
  keyInput: {
    fontSize: 13, fontWeight: 700, background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: 6, padding: '3px 10px',
    outline: 'none', width: 52, textAlign: 'center' as const,
  },
  sectionRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', borderRadius: 8, padding: '10px 12px',
    marginBottom: 6, border: '2px solid transparent',
    userSelect: 'none',
  },
  sectionRowActive: { borderColor: '#1a1a2e' },
  dragHandle: { fontSize: 18, color: '#bbb', flexShrink: 0, cursor: 'grab' },
  sectionRowLabel: {
    flex: 1, background: 'none', border: 'none', textAlign: 'left',
    cursor: 'pointer', fontSize: 14, padding: 0,
  },
  chordPreview: { color: '#888', fontWeight: 400 },
  activeBadge: {
    fontSize: 11, color: '#1a1a2e', fontWeight: 700,
    background: '#e0e0ff', padding: '2px 6px', borderRadius: 4,
  },
  addSectionBtn: {
    marginTop: 8, padding: '8px 14px', background: '#f0f0ff',
    border: '1.5px dashed #aaa', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, color: '#555', width: '100%',
  },
  sectionEditor: {
    marginTop: 16, background: '#fff', borderRadius: 10, padding: 16,
    border: '1px solid #e0e0e0',
  },
  sectionEditorHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionLabelInput: {
    fontSize: 15, fontWeight: 600, border: 'none', outline: 'none',
    borderBottom: '2px solid #ddd', paddingBottom: 4, width: 200,
  },
  deleteSectionBtn: {
    background: '#fee2e2', color: '#b91c1c', border: 'none',
    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#888',
    textTransform: 'uppercase', marginBottom: 4, marginTop: 12,
  },
  chordsInput: {
    display: 'block', width: '100%', padding: '8px 10px', fontSize: 14,
    border: '1.5px solid #ddd', borderRadius: 6, fontFamily: 'monospace',
  },
  lyricsInput: {
    display: 'block', width: '100%', padding: '8px 10px', fontSize: 14,
    border: '1.5px solid #ddd', borderRadius: 6, resize: 'vertical',
    fontFamily: 'inherit',
  },
  // Users sidebar
  sidebar: {
    background: '#fff', borderLeft: '1px solid #eee',
    overflow: 'auto', padding: 16,
    display: 'flex', flexDirection: 'column',
  },
  sidebarTitle: { fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 12, textTransform: 'uppercase' },
  userRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '8px 0', borderBottom: '1px solid #f0f0f0',
  },
  dot: { color: '#22c55e', marginRight: 6, fontSize: 10 },
  meBadge: { fontSize: 11, color: '#888' },
  directorBadge: { fontSize: 13 },
  userInstrument: { fontSize: 11, color: '#999', marginTop: 2, marginLeft: 16 },
  editRightsBtn: {
    fontSize: 11, padding: '3px 8px', border: 'none',
    borderRadius: 4, cursor: 'pointer', marginTop: 4, fontWeight: 600,
  },
  noUsers: { fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 20 },
  // QR code
  qrBlock: {
    marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid #eee',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  },
  qrLabel: { fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  qrUrl: { fontSize: 10, color: '#999', wordBreak: 'break-all', textAlign: 'center', maxWidth: 180 },
}
