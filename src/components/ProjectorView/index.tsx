import { useSetlistStore } from '../../store/setlist'
import { useWebSocket } from '../../hooks/useWebSocket'

export function ProjectorView() {
  // Keep the WebSocket alive so the projector view stays in sync.
  useWebSocket()

  const setlist = useSetlistStore((s) => s.setlist)
  const connectionStatus = useSetlistStore((s) => s.connectionStatus)

  const activeSong = setlist.songs.find((s) => s.id === setlist.activeSongId)
  const activeSection = activeSong?.sections.find(
    (s) => s.id === setlist.activeSectionId,
  )

  return (
    <div style={styles.page}>
      {connectionStatus === 'disconnected' && (
        <div style={styles.reconnecting}>⚠ Reconnecting…</div>
      )}

      {activeSection ? (
        <>
          <div style={styles.lyrics}>
            {activeSection.lyrics.split('\n').map((line, i) => (
              <div key={i}>{line || <>&nbsp;</>}</div>
            ))}
          </div>
          <div style={styles.footer}>
            <span style={styles.sectionLabel}>{activeSection.label}</span>
            {activeSong && (
              <span style={styles.songTitle}>{activeSong.title}</span>
            )}
          </div>
        </>
      ) : (
        <div style={styles.standby}>ChurchStand</div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#000', color: '#fff',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    padding: '5vw',
    position: 'relative',
  },
  reconnecting: {
    position: 'fixed', top: 0, left: 0, right: 0,
    background: '#f59e0b', color: '#000', textAlign: 'center',
    padding: '6px', fontSize: 14, fontWeight: 600,
  },
  lyrics: {
    fontSize: 'clamp(28px, 5vw, 64px)',
    lineHeight: 1.55,
    textAlign: 'center',
    maxWidth: '90vw',
    fontWeight: 400,
  },
  footer: {
    position: 'fixed', bottom: 24, right: 32,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
  },
  sectionLabel: { fontSize: 18, opacity: 0.5 },
  songTitle: { fontSize: 14, opacity: 0.35 },
  standby: {
    fontSize: 'clamp(24px, 4vw, 48px)', opacity: 0.15, letterSpacing: 4,
  },
}
