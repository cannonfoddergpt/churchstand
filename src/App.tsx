import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { JoinFlow } from './components/JoinFlow'
import { MusicianView } from './components/MusicianView'
import { DirectorView } from './components/DirectorView'
import { ProjectorView } from './components/ProjectorView'
import { useSetlistStore } from './store/setlist'

function RootRedirect() {
  const myProfile = useSetlistStore((s) => s.myProfile)
  return <Navigate to={myProfile ? '/musician' : '/join'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/join" element={<JoinFlow />} />
        <Route path="/musician" element={<MusicianView />} />
        <Route path="/director" element={<DirectorView />} />
        <Route path="/projector" element={<ProjectorView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
