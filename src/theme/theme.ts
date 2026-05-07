import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f3eb5',
    },
    secondary: {
      main: '#7795de',
    },
  },
  typography: {
    fontFamily: 'Century Gothic, sans-serif',
    h4: { fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' },
    h6: { fontSize: 'clamp(1rem, 3.5vw, 1.15rem)' },
    body1: { fontSize: 'clamp(0.85rem, 2.5vw, 0.92rem)' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiDialog: {
      defaultProps: {
        disableRestoreFocus: true,
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
        focusRipple: false,
      },
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: 'none',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: 'cs-mollwish-2';
          src: url('/fonts/cs-mollwish-2.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Century Gothic';
          src: url('/fonts/centurygothic.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Century Gothic';
          src: url('/fonts/centurygothic_bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
        }
      `,
    },
  },
});

export default theme;
