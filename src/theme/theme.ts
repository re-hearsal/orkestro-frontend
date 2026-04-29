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
