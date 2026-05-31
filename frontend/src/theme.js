import { createTheme } from '@mui/material/styles';

export const C = {
  // Sidebar
  sidebar:       '#1B1F2E',
  sidebarHover:  '#252B40',
  sidebarActive: '#1B6EF3',
  sidebarText:   'rgba(255,255,255,0.65)',
  sidebarTextOn: '#FFFFFF',

  // Core
  black:     '#0A0A0A',
  white:     '#FFFFFF',
  bgPage:    '#F5F5F5',
  bgCard:    '#FFFFFF',
  bgMuted:   '#FAFAFA',

  // Blue — single accent color
  blue:      '#1B6EF3',
  blueDim:   '#EEF4FF',

  // Status — only 4, used sparingly
  green:     '#16A34A',
  greenDim:  '#F0FDF4',
  red:       '#DC2626',
  redDim:    '#FEF2F2',
  amber:     '#D97706',
  amberDim:  '#FFFBEB',
  purple:    '#7C3AED',
  purpleDim: '#F5F3FF',

  // Text
  t1:   '#0A0A0A',
  t2:   '#525252',
  t3:   '#A3A3A3',

  // Borders
  b1:   '#E5E5E5',
  b2:   '#D4D4D4',

  // ── Aliases for backward compat ──────────────────────────
  border:       '#E5E5E5',
  borderLight:  '#F0F0F0',
  textPrimary:  '#0A0A0A',
  textSecondary:'#525252',
  textMuted:    '#A3A3A3',
  orange:       '#D97706',
  orangeLight:  '#FFFBEB',
  orangeDim:    '#FFFBEB',
  purple:       '#7C3AED',
  purpleLight:  '#F5F3FF',
  purpleDim:    '#F5F3FF',
  teal:         '#0D9488',
  tealLight:    '#F0FDFA',
  blueLight:    '#EEF4FF',
  blueDim:      '#EEF4FF',
  greenLight:   '#F0FDF4',
  redLight:     '#FEF2F2',
  amberLight:   '#FFFBEB',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: C.blue,  contrastText: '#fff' },
    error:      { main: C.red },
    warning:    { main: C.amber },
    success:    { main: C.green },
    background: { default: C.bgPage, paper: C.bgCard },
    text:       { primary: C.t1, secondary: C.t2, disabled: C.t3 },
    divider:    C.b1,
  },

  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    allVariants: { letterSpacing: '-0.01em' },
  },

  // Zero border radius everywhere — sharp design
  shape: { borderRadius: 0 },

  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: `1px solid ${C.b1}`,
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, fontWeight: 600, fontSize: '0.72rem', height: 22 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: C.bgMuted,
            color: C.t3,
            fontWeight: 600,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${C.b2}`,
            padding: '10px 20px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${C.b1}`,
          padding: '14px 20px',
          fontSize: '0.875rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#FAFAFA' },
          '&.Mui-selected': { backgroundColor: `${C.blueDim} !important` },
        },
      },
    },
    MuiInputBase: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 0 },
        notchedOutline: { borderColor: C.b1 },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { borderRadius: 0, border: 'none' } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: C.b1 } },
    },
  },
});
