import { useEffect, useRef, useCallback } from 'react'
import { ClientMessage, ServerMessage } from '../types'
import { useSetlistStore } from '../store/setlist'
import { saveSetlistOffline, loadSetlistOffline } from '../lib/offlineCache'

const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30_000

/**
 * Manages the WebSocket connection to the ChurchStand server.
 *
 * Connection lifecycle:
 *   connecting → connected (on open + join sent)
 *                         → full_state received → setlist updated
 *   connected  → disconnected (on close/error)
 *                         → reconnect with exponential backoff
 *
 * Returns a `send` function for the director to push mutations.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  const { myProfile, setSetlist, setConnectedUsers, setConnectionStatus } =
    useSetlistStore()

  const connect = useCallback(() => {
    if (unmountedRef.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws`

    setConnectionStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS
      setConnectionStatus('connected')

      // Announce ourselves to the server immediately on connect.
      if (myProfile) {
        ws.send(JSON.stringify({ type: 'join', profile: myProfile } satisfies ClientMessage))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        switch (msg.type) {
          case 'full_state':
            setSetlist(msg.setlist)
            setConnectedUsers(msg.connectedUsers)
            saveSetlistOffline(msg.setlist)
            break
          case 'users_updated':
            setConnectedUsers(msg.connectedUsers)
            break
          case 'error':
            console.warn('[ChurchStand] Server error:', msg.message)
            break
        }
      } catch (err) {
        console.error('[ChurchStand] Failed to parse server message', err)
      }
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setConnectionStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [myProfile, setSetlist, setConnectedUsers, setConnectionStatus])

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return
    const delay = reconnectDelayRef.current
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS)
    reconnectTimerRef.current = setTimeout(connect, delay)
  }, [connect])

  // Hydrate from IndexedDB while the WebSocket is establishing, so musicians
  // see last-known chords immediately rather than a blank screen.
  useEffect(() => {
    loadSetlistOffline().then((cached) => {
      if (cached) setSetlist(cached)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    } else {
      console.warn('[ChurchStand] WebSocket not open — message dropped:', msg.type)
    }
  }, [])

  return { send }
}
