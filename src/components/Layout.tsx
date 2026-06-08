import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav.tsx'
import { TitleBar } from './TitleBar.tsx'

export function Layout() {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar />
      <TopNav />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div
          key={location.pathname}
          style={{ animation: 'pageIn 0.3s ease-out' }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
