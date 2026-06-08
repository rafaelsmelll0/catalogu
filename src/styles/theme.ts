export const theme = {

  colors: {
    primary:         '#8055d0',
    primaryDark:     '#6840b0',
    primaryMuted:    '#9a75dc',
    primaryGlow:     'rgba(128, 85, 208, 0.25)',

    bg:              '#141414',
    surface:         '#1F1F1F',
    surfaceElevated: '#2D2D2D',
    surfaceHover:    '#383838',

    textPrimary:     '#FFFFFF',
    textSecondary:   '#BCBCBC',
    textMuted:       '#808080',

    success:         '#46D369',
    info:            '#54B9C5',
    warning:         '#F5A623',
    danger:          '#E5090E',

    overlay:         'rgba(0, 0, 0, 0.85)',
    overlayLight:    'rgba(0, 0, 0, 0.5)',

    typeColors: {
      filme: '#8055d0',
      serie: '#54B9C5',
    },

    statusColors: {
      assistido:     '#46D369',
      assistindo:    '#8055d0',
      nao_assistido: '#808080',
      nao_lembro:    '#F5A623',
    },
  },

  fonts: {
    sans:    "'Arial', 'Helvetica', sans-serif",
    display: "'Arial Black', 'Arial', sans-serif",
    mono:    "'Courier New', monospace",
  },

  fontSizes: {
    hero:  '52px',
    h1:    '36px',
    h2:    '24px',
    h3:    '18px',
    body:  '16px',
    ui:    '14px',
    small: '12px',
    tiny:  '11px',
  },

  fontWeights: {
    regular: 400,
    medium:  500,
    bold:    700,
    black:   900,
  },

  spacing: {
    xs:   '4px',
    sm:   '8px',
    md:   '16px',
    lg:   '24px',
    xl:   '32px',
    xxl:  '48px',
    xxxl: '64px',
  },

  radius: {
    sm:   '4px',
    md:   '6px',
    lg:   '12px',
    full: '9999px',
  },

  shadows: {
    card:  '0 6px 24px rgba(0,0,0,0.7)',
    modal: '0 12px 48px rgba(0,0,0,0.8)',
    glow:  '0 0 20px rgba(128, 85, 208, 0.4)',
  },

  transitions: {
    fast:   '0.15s ease',
    normal: '0.2s ease',
    slow:   '0.3s ease',
  },

  layout: {
    navHeight:   '68px',
    pagePadding: '48px',
    cardWidth:   '160px',
    cardHeight:  '240px',
    cardGap:     '8px',
    rowGap:      '40px',
  },

  gradients: {
    heroOverlay: 'linear-gradient(to right, rgba(20,20,20,0.95) 35%, rgba(20,20,20,0.3) 70%, transparent 100%)',
    heroBottom:  'linear-gradient(to top, #141414, transparent)',
    navFade:     'linear-gradient(to bottom, rgba(20,20,20,0.98), rgba(20,20,20,0))',
    cardOverlay: 'linear-gradient(to top, rgba(20,20,20,0.95) 0%, transparent 60%)',
    primary:     'linear-gradient(135deg, #8055d0, #6840b0)',
  },

} as const

export type Theme = typeof theme
