import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid,
} from 'recharts'
import { theme } from '../styles/theme.ts'
import type { AppStats } from '../types/index.ts'
import { useCountUp } from '../hooks/useCountUp.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { Skeleton } from '../components/ui/index.ts'

function AnimatedNum({ value, color }: { value: number; color: string }) {
  const animated = useCountUp(value, 1200)
  return (
    <span style={{
      fontSize: '48px',
      fontWeight: theme.fontWeights.black,
      fontFamily: theme.fonts.display,
      color,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {Math.round(animated)}
    </span>
  )
}

function AnimatedRating({ value }: { value: number }) {
  const animated = useCountUp(value, 1200)
  return (
    <span style={{
      fontSize: '48px',
      fontWeight: theme.fontWeights.black,
      fontFamily: theme.fonts.display,
      color: theme.colors.success,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {animated.toFixed(1)}
    </span>
  )
}

export function StatsPage() {
  const { items, fetchAll } = useMediaStore()
  const [stats, setStats]   = useState<AppStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
    window.electronAPI.invoke('stats:get').then(s => {
      setStats(s as AppStats)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ padding: `${theme.spacing.xl} ${theme.layout.pagePadding}`, background: theme.colors.bg, minHeight: '100vh' }}>
        <Skeleton width="240px" height="36px" />
        <div style={{ marginTop: theme.spacing.xl, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: theme.spacing.md }}>
          {[1,2,3,4].map(i => <Skeleton key={i} height="120px" radius={theme.radius.md} />)}
        </div>
        <div style={{ marginTop: theme.spacing.xl }}>
          <Skeleton height="320px" radius={theme.radius.md} />
        </div>
      </div>
    )
  }

  if (!stats) return null

  const cardStyle: React.CSSProperties = {
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: theme.spacing.xs,
    border: `1px solid ${theme.colors.surfaceElevated}`,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.small,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: theme.fontWeights.bold,
  }

  const chartCardStyle: React.CSSProperties = {
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.surfaceElevated}`,
  }

  const chartTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.h3,
    fontWeight: theme.fontWeights.bold,
    marginBottom: theme.spacing.md,
  }

  const chartTooltipStyle = {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.surfaceHover}`,
    borderRadius: theme.radius.sm,
    padding: '8px 12px',
    fontSize: theme.fontSizes.small,
  }

  // Distribuição de notas (0-10)
  const ratingBuckets = Array.from({ length: 11 }, (_, i) => ({
    nota: String(i),
    qtd: items.filter(m => m.rating != null && Math.round(m.rating) === i).length,
  }))

  // Top 8 gêneros
  const genreMap = new Map<string, number>()
  items.forEach(m => (m.genres ?? []).forEach(g => genreMap.set(g, (genreMap.get(g) ?? 0) + 1)))
  const topGenres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  // Pizza por tipo
  const tipoData = [
    { name: 'Filmes', value: stats.filmes, color: theme.colors.typeColors.filme },
    { name: 'Séries', value: stats.series, color: theme.colors.typeColors.serie },
  ].filter(d => d.value > 0)

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh', padding: `${theme.spacing.xl} ${theme.layout.pagePadding}` }}>
      <h1 style={{
        fontSize: theme.fontSizes.h1,
        fontWeight: theme.fontWeights.black,
        fontFamily: theme.fonts.display,
        marginBottom: theme.spacing.xl,
      }}>
        ESTATÍSTICAS
      </h1>

      {/* Cards numéricos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.xl,
      }}>
        <div style={cardStyle}>
          <AnimatedNum value={stats.total}  color={theme.colors.primary} />
          <span style={labelStyle}>Total</span>
        </div>
        <div style={cardStyle}>
          <AnimatedNum value={stats.filmes} color={theme.colors.typeColors.filme} />
          <span style={labelStyle}>Filmes</span>
        </div>
        <div style={cardStyle}>
          <AnimatedNum value={stats.series} color={theme.colors.typeColors.serie} />
          <span style={labelStyle}>Séries</span>
        </div>
        <div style={cardStyle}>
          <AnimatedRating value={stats.mediaRating} />
          <span style={labelStyle}>Nota Média</span>
        </div>
        {stats.proximos > 0 && (
          <div style={cardStyle}>
            <AnimatedNum value={stats.proximos} color={theme.colors.warning} />
            <span style={labelStyle}>Próximos</span>
          </div>
        )}
      </div>

      {/* Gráficos principais */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: theme.spacing.lg,
        marginBottom: theme.spacing.xl,
      }}>
        {tipoData.length > 0 && (
          <div style={chartCardStyle}>
            <h2 style={chartTitleStyle}>Distribuição por Tipo</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={tipoData}
                  dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={2}
                  stroke="none"
                  label={(e: { name: string; percent: number }) => `${e.name}: ${(e.percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: '12px', fontWeight: theme.fontWeights.bold }}
                >
                  {tipoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={chartCardStyle}>
          <h2 style={chartTitleStyle}>Distribuição de Notas</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ratingBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.surfaceElevated} />
              <XAxis dataKey="nota" stroke={theme.colors.textMuted} fontSize={11} />
              <YAxis stroke={theme.colors.textMuted} fontSize={11} allowDecimals={false} />
              <ReTooltip
                contentStyle={chartTooltipStyle}
                cursor={{ fill: 'rgba(128, 85, 208, 0.1)' }}
              />
              <Bar dataKey="qtd" fill={theme.colors.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top gêneros */}
      {topGenres.length > 0 && (
        <div style={{ ...chartCardStyle, marginBottom: theme.spacing.lg }}>
          <h2 style={chartTitleStyle}>Top Gêneros</h2>
          <ResponsiveContainer width="100%" height={Math.max(240, topGenres.length * 40)}>
            <BarChart data={topGenres} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.surfaceElevated} />
              <XAxis type="number" stroke={theme.colors.textMuted} fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke={theme.colors.textMuted} fontSize={11} width={120} />
              <ReTooltip
                contentStyle={chartTooltipStyle}
                cursor={{ fill: 'rgba(128, 85, 208, 0.1)' }}
              />
              <Bar dataKey="value" fill={theme.colors.primary} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Progresso */}
      <div style={chartCardStyle}>
        <h2 style={chartTitleStyle}>Progresso do Catálogo</h2>

        {[
          { label: 'Assistidos',     count: stats.assistidos,    color: theme.colors.success },
          { label: 'Não assistidos', count: stats.naoAssistidos, color: theme.colors.textMuted },
        ].map(({ label, count, color }) => {
          const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0
          return (
            <div key={label} style={{ marginBottom: theme.spacing.md }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>{label}</span>
                <span style={{ fontSize: theme.fontSizes.ui, color, fontWeight: theme.fontWeights.bold }}>
                  {count} ({pct}%)
                </span>
              </div>
              <div style={{ height: '10px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.full, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: theme.radius.full,
                  background: label === 'Assistidos'
                    ? `linear-gradient(90deg, ${theme.colors.success}, ${theme.colors.primary})`
                    : color,
                  width: `${pct}%`,
                  transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
