import { lazy, type ComponentType } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { FilmesPage } from './pages/FilmesPage.tsx'
import { SeriesPage } from './pages/SeriesPage.tsx'
import { ToastContainer } from './components/Toast.tsx'
import { UpdateNotification } from './components/UpdateNotification.tsx'

// Telas menos usadas (e as mais pesadas, como Estatísticas com recharts) são
// carregadas sob demanda: o app abre mais rápido com um pacote inicial menor.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then(m => ({ default: m[name] })))
const StatsPage        = page(() => import('./pages/StatsPage.tsx'),        'StatsPage')
const ListasPage       = page(() => import('./pages/ListasPage.tsx'),       'ListasPage')
const ProximosPage     = page(() => import('./pages/ProximosPage.tsx'),     'ProximosPage')
const ParaVocePage     = page(() => import('./pages/ParaVocePage.tsx'),     'ParaVocePage')
const ConfigPage       = page(() => import('./pages/ConfigPage.tsx'),       'ConfigPage')
const UIPlaygroundPage = page(() => import('./pages/UIPlaygroundPage.tsx'), 'UIPlaygroundPage')

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
          <Route path="para-voce" element={<ParaVocePage />} />
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
