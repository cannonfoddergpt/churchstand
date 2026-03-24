import { create } from 'zustand'
import {
  Setlist,
  ConnectedUser,
  MusicianProfile,
  ViewMode,
  createEmptySetlist,
} from '../types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface SetlistStore {
  // ── Server state ────────────────────────────────────────────────────────────
  setlist: Setlist
  connectedUsers: ConnectedUser[]
  connectionStatus: ConnectionStatus

  // ── Local profile (persisted in localStorage) ───────────────────────────────
  myProfile: MusicianProfile | null
  viewMode: ViewMode

  // ── Actions ─────────────────────────────────────────────────────────────────
  setSetlist: (setlist: Setlist) => void
  setConnectedUsers: (users: ConnectedUser[]) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setMyProfile: (profile: MusicianProfile) => void
  setViewMode: (mode: ViewMode) => void
  clearProfile: () => void
}

const PROFILE_STORAGE_KEY = 'churchstand:profile'
const VIEW_MODE_STORAGE_KEY = 'churchstand:viewMode'

function loadProfile(): MusicianProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MusicianProfile) : null
  } catch {
    return null
  }
}

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (raw === 'free-scroll' || raw === 'page-turn' || raw === 'director-controlled') {
      return raw
    }
  } catch {
    // ignore
  }
  return 'director-controlled'
}

export const useSetlistStore = create<SetlistStore>((set) => ({
  setlist: createEmptySetlist(),
  connectedUsers: [],
  connectionStatus: 'connecting',
  myProfile: loadProfile(),
  viewMode: loadViewMode(),

  setSetlist: (setlist) => set({ setlist }),

  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setMyProfile: (profile) => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    set({ myProfile: profile })
  },

  setViewMode: (viewMode) => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
    set({ viewMode })
  },

  clearProfile: () => {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    set({ myProfile: null })
  },
}))
