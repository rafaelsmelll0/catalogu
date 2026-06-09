import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { FilmesPage } from './pages/FilmesPage.tsx'
import { SeriesPage } from './pages/SeriesPage.tsx'
import { StatsPage } from './pages/StatsPage.tsx'
import { ListasPage } from './pages/ListasPage.tsx'
import { ToastContainer } from './components/Toast.tsx'
import { UpdateNotification } from './components/UpdateNotification.tsx'
import { UIPlaygroundPage } from './pages/UIPlaygroundPage.tsx'
import { ConfigPage } from './pages/ConfigPage.tsx'
import { ProximosPage } from './pages/ProximosPage.tsx'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index         element={<HomePage />} />
          <Route path="filmes" element={<FilmesPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="stats"  element={<StatsPage />} />
          <Route path="listas"    element={<ListasPage />} />
          <Route path="proximos"  element={<ProximosPage />} />
          <Route path="ui"     element={<UIPlaygroundPage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
      <ToastContainer />
      <UpdateNotification />
    </>
  )
}

export default App
