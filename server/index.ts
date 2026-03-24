import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import { networkInterfaces } from 'os'
import qrcode from 'qrcode-terminal'
import Anthropic from '@anthropic-ai/sdk'
import { loadState, saveState } from './state'
import { canMutate, canManagePermissions, isLocalhost } from './permissions'
import {
  Setlist,
  ConnectedUser,
  ClientMessage,
  ServerMessage,
  MusicianProfile,
} from '../src/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production'
const PORT = parseInt(process.env.PORT ?? (IS_PROD ? '5000' : '3001'), 10)

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// ─── Anthropic client (lazy — only used when API key is set) ──────────────────

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// In production: serve the Vite build. In dev: Vite handles static files itself.
if (IS_PROD) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

// ─── Bridge suggestion endpoint ───────────────────────────────────────────────

app.post('/api/suggest-bridge', async (req, res) => {
  if (!anthropic) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not set on this server.' })
    return
  }

  const { fromKey, toKey, fromSongTitle, toSongTitle } = req.body as {
    fromKey: string
    toKey: string
    fromSongTitle: string
    toSongTitle: string
  }

  if (!fromKey || !toKey) {
    res.status(400).json({ error: 'fromKey and toKey are required' })
    return
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are a music theory assistant for a worship band director.
Your task: suggest a 4-bar chord progression (in concert pitch) that bridges
between two songs. Return ONLY a JSON array of chord names, no explanation.
Rules:
- Exactly 4 chords (one per bar)
- Use standard chord symbols: C, Dm, G7, Fmaj7, Am, Bb, etc.
- The progression must start near the key of the first song and resolve
  naturally into the key of the second song
- Keep it simple — this is for live worship musicians reading charts`,
      messages: [
        {
          role: 'user',
          content: `Song ending: "${fromSongTitle}" in ${fromKey}
Song starting: "${toSongTitle}" in ${toKey}
Return a 4-bar bridge progression as a JSON array, e.g. ["D","G","A","D"]`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Extract JSON array from the response (handle any surrounding text)
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      res.status(500).json({ error: 'Model returned unexpected format', raw: text })
      return
    }
    const chords: string[] = JSON.parse(match[0])
    res.json({ chords })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

// ─── Canonical state ──────────────────────────────────────────────────────────

let canonicalState: Setlist = loadState()

// Map: ws instance → connected user profile
const clients = new Map<WebSocket, ConnectedUser>()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConnectedUsers(): ConnectedUser[] {
  return Array.from(clients.values())
}

function broadcastAll(msg: ServerMessage): void {
  const payload = JSON.stringify(msg)
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
}

function broadcastState(): void {
  broadcastAll({
    type: 'full_state',
    setlist: canonicalState,
    connectedUsers: getConnectedUsers(),
  })
}

// ─── WebSocket handlers ───────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  const remoteAddress = req.socket.remoteAddress ?? ''

  ws.on('message', (data) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(data.toString()) as ClientMessage
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' } satisfies ServerMessage))
      return
    }

    const user = clients.get(ws)

    switch (msg.type) {
      case 'join': {
        const profile: MusicianProfile = msg.profile
        const connectedUser: ConnectedUser = {
          ...profile,
          connectedAt: new Date().toISOString(),
        }
        clients.set(ws, connectedUser)

        // If no director assigned yet and this is localhost, auto-assign director
        if (!canonicalState.directorId && isLocalhost(remoteAddress)) {
          canonicalState = { ...canonicalState, directorId: profile.id }
          saveState(canonicalState)
        }

        // Send full state to the joining client
        ws.send(
          JSON.stringify({
            type: 'full_state',
            setlist: canonicalState,
            connectedUsers: getConnectedUsers(),
          } satisfies ServerMessage),
        )

        // Notify everyone else about the updated user list
        broadcastAll({ type: 'users_updated', connectedUsers: getConnectedUsers() })
        break
      }

      case 'mutate': {
        if (!canMutate(remoteAddress, msg.userId, canonicalState)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Read-only client' } satisfies ServerMessage))
          return
        }
        canonicalState = { ...canonicalState, ...msg.payload }
        saveState(canonicalState)
        broadcastState()
        break
      }

      case 'set_active_section': {
        if (!canMutate(remoteAddress, msg.userId, canonicalState)) return
        canonicalState = {
          ...canonicalState,
          activeSongId: msg.songId,
          activeSectionId: msg.sectionId,
        }
        saveState(canonicalState)
        broadcastState()
        break
      }

      case 'grant_edit': {
        if (!canManagePermissions(remoteAddress, msg.userId, canonicalState)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Only the director can grant edit rights' } satisfies ServerMessage))
          return
        }
        if (!canonicalState.editorIds.includes(msg.targetUserId)) {
          canonicalState = {
            ...canonicalState,
            editorIds: [...canonicalState.editorIds, msg.targetUserId],
          }
          saveState(canonicalState)
          broadcastState()
        }
        break
      }

      case 'revoke_edit': {
        if (!canManagePermissions(remoteAddress, msg.userId, canonicalState)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Only the director can revoke edit rights' } satisfies ServerMessage))
          return
        }
        canonicalState = {
          ...canonicalState,
          editorIds: canonicalState.editorIds.filter((id) => id !== msg.targetUserId),
        }
        saveState(canonicalState)
        broadcastState()
        break
      }

      case 'set_director': {
        // Only current director on localhost can transfer the director role
        if (!isLocalhost(remoteAddress) || canonicalState.directorId !== msg.userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Only the director can transfer the role' } satisfies ServerMessage))
          return
        }
        canonicalState = { ...canonicalState, directorId: msg.targetUserId }
        saveState(canonicalState)
        broadcastState()
        break
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' } satisfies ServerMessage))
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    broadcastAll({ type: 'users_updated', connectedUsers: getConnectedUsers() })
  })

  ws.on('error', (err) => {
    console.error('[ChurchStand] WebSocket error:', err)
    clients.delete(ws)
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const localIp = getLocalIp()
  const musicianUrl = `http://${localIp}:${PORT}`
  const directorUrl = `http://127.0.0.1:${PORT}/director`
  const projectorUrl = `http://${localIp}:${PORT}/projector`

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║         ChurchStand is ready             ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║  Director:  ${directorUrl.padEnd(29)}║`)
  console.log(`║  Projector: ${projectorUrl.padEnd(29)}║`)
  console.log(`║  Musicians: ${musicianUrl.padEnd(29)}║`)
  console.log('╚══════════════════════════════════════════╝\n')

  if (IS_PROD) {
    console.log('Scan to join:')
    qrcode.generate(musicianUrl, { small: true })
  }
})

function getLocalIp(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}
