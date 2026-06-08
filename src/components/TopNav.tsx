import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { theme } from '../styles/theme.ts'
import Logo from '../assets/catalogu-logo.svg?react'
import { useMediaStore } from '../store/mediaStore.ts'
import { AddMediaModal } from './AddMediaModal.tsx'
import { Button, Input, Tooltip } from './ui/index.ts'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts'

const NAV_LINKS = [
  { label: 'Início',       path: '/' },
  { label: 'Filmes',       path: '/filmes' },
  { label: 'Séries',       path: '/series' },
  { label: 'Listas',       path: '/listas' },
  { label: 'Estatísticas', path: '/stats' },
  { label: 'Configurações', path: '/config' },
]

export function TopNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { setFilters } = useMediaStore()
  const [showAdd, setShowAdd]       = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchVal, setSearchVal]   = useState('')

  function handleSearch(val: string) {
    setSearchVal(val)
    setFilters({ search: val })
    if (val && location.pathname === '/') navigate('/filmes')
  }

  function handleSearchClose() {
    setShowSearch(false)
    setSearchVal('')
    setFilters({ search: '' })
  }

  useKeyboardShortcuts({
    'ctrl+k': () => setShowSearch(true),
    'ctrl+n': () => setShowAdd(true),
    'escape': () => { if (showSearch) handleSearchClose() },
  })

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
          <Logo style={{ height: '36px', width: 'auto', display: 'block' }} />
        </div>

        {showSearch ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: theme.spacing.sm, margin: `0 ${theme.spacing.xl}` }}>
            <Input
              icon="⌕"
              placeholder="Buscar no catálogo..."
              value={searchVal}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && handleSearchClose()}
              autoFocus
              style={{ flex: 1 }}
            />
            <Button variant="ghost" onClick={handleSearchClose}>Fechar</Button>
          </div>
        ) : (
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
        )}

        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexShrink: 0 }}>
          <Tooltip content="Buscar (Ctrl+K)">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(true)}
              style={{ padding: '0', width: '34px', fontSize: '18px' }}
            >
              ⌕
            </Button>
          </Tooltip>

          <Tooltip content="Adicionar (Ctrl+N)">
            <Button size="sm" onClick={() => setShowAdd(true)}>
              + Adicionar
            </Button>
          </Tooltip>
        </div>
      </nav>

      {showAdd && <AddMediaModal onClose={() => setShowAdd(false)} />}
    </>
  )
}
