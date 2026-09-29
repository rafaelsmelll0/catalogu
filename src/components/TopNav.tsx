import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { theme } from '../styles/theme.ts'
import { AnimatedLogo } from './AnimatedCat.tsx'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { AddMediaModal } from './AddMediaModal.tsx'
import { SearchPalette, type PaletteSelection } from './SearchPalette.tsx'
import { DetailsModal } from './DetailsModal.tsx'
import { WatchlistDetailsModal } from './WatchlistDetailsModal.tsx'
import { Button, Tooltip } from './ui/index.ts'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts'

const NAV_LINKS = [
  { label: 'Início',       path: '/' },
  { label: 'Filmes',       path: '/filmes' },
  { label: 'Séries',       path: '/series' },
  { label: 'Listas',       path: '/listas' },
  { label: 'Próximos',     path: '/proximos' },
  { label: 'Para Você',    path: '/para-voce' },
  { label: 'Estatísticas', path: '/stats' },
  { label: 'Configurações', path: '/config' },
]

export function TopNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [showAdd, setShowAdd]       = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [opened, setOpened]         = useState<PaletteSelection | null>(null)

  // Usa a versão atual do store (reflete edições feitas no próprio modal);
  // cai para o snapshot se o item sumir, para o modal não desmontar no meio de um fluxo.
  const mediaItems = useMediaStore(s => s.items)
  const watchItems = useWatchlistStore(s => s.items)
  const openedMedia = opened?.kind === 'media'
    ? mediaItems.find(m => m.id === opened.media.id) ?? opened.media
    : null
  const openedProximo = opened?.kind === 'proximo'
    ? watchItems.find(w => w.id === opened.item.id) ?? opened.item
    : null

  const shortcuts = useMemo(() => ({
    'ctrl+k': () => setShowSearch(true),
    'ctrl+n': () => setShowAdd(true),
    'ctrl+1': () => navigate('/'),
    'ctrl+2': () => navigate('/filmes'),
    'ctrl+3': () => navigate('/series'),
    'ctrl+4': () => navigate('/listas'),
    'ctrl+5': () => navigate('/proximos'),
    'ctrl+6': () => navigate('/para-voce'),
    'ctrl+7': () => navigate('/stats'),
    'ctrl+8': () => navigate('/config'),
  }), [navigate])
  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${theme.layout.pagePadding}`,
        height: theme.layout.navHeight,
        background: theme.colors.bg,
        borderBottom: `1px solid ${theme.colors.surface}`,
        flexShrink: 0,
      }}>
        <div
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            height: '36px',
          }}
        >
          <AnimatedLogo height={36} />
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          {NAV_LINKS.map(link => {
            const isActive = location.pathname === link.path
            return (
              <span
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  fontSize: theme.fontSizes.small,
                  fontWeight: isActive ? theme.fontWeights.bold : theme.fontWeights.regular,
                  color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                  cursor: 'pointer',
                  transition: `color ${theme.transitions.fast}`,
                  userSelect: 'none',
                  borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                  paddingBottom: '2px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) (e.target as HTMLElement).style.color = theme.colors.textPrimary }}
                onMouseLeave={e => { if (!isActive) (e.target as HTMLElement).style.color = theme.colors.textSecondary }}
              >
                {link.label}
              </span>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexShrink: 0 }}>
          <Tooltip content="Buscar (Ctrl+K)" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(true)}
              style={{ padding: '0', width: '34px', fontSize: '18px' }}
            >
              ⌕
            </Button>
          </Tooltip>

          <Tooltip content="Adicionar (Ctrl+N)" side="bottom">
            <Button size="sm" onClick={() => setShowAdd(true)}>
              + Adicionar
            </Button>
          </Tooltip>
        </div>
      </nav>

      {showAdd && <AddMediaModal onClose={() => setShowAdd(false)} />}

      <SearchPalette open={showSearch} onClose={() => setShowSearch(false)} onSelect={setOpened} />
      {openedMedia   && <DetailsModal media={openedMedia} onClose={() => setOpened(null)} />}
      {openedProximo && <WatchlistDetailsModal item={openedProximo} onClose={() => setOpened(null)} />}
    </>
  )
}
