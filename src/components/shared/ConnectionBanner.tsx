import { useSetlistStore } from '../../store/setlist'

export function ConnectionBanner() {
  const status = useSetlistStore((s) => s.connectionStatus)
  if (status === 'connected') return null

  const isConnecting = status === 'connecting'
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: isConnecting ? '#f59e0b' : '#ef4444',
      color: '#fff',
      padding: '8px 16px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 600,
    }}>
      {isConnecting
        ? '⟳ Connecting to ChurchStand…'
        : '⚠ Reconnecting… Your last received music is shown below.'}
    </div>
  )
}
