import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AuthBox from '../components/auth/AuthBox';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function AuthPage() {
  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle 500px at 0% 75%, rgba(15,62,181,0.86) 0%, transparent 100%),' +
          'radial-gradient(circle 500px at 100% 75%, rgba(15,62,181,0.86) 0%, transparent 100%)',
        backgroundColor: 'white',
        px: 2,
        py: 4,
      }}
    >
      {/* Logo */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        {/* <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: '#0f3eb5',
            mx: 'auto',
            mb: 1,
          }}
        /> */}
        <img src="/img/logo_blue.svg" alt="logo" style={{
          width: 128,
          height: 128,
          marginBlock: -20
        }} />

        <Typography
          sx={{
            fontFamily: 'cs-mollwish-2, sans-serif',
            fontSize: '2.5rem',
            color: '#0f3eb5',
            letterSpacing: 3,
          }}
        >
          ORKESTRO
        </Typography>
      </Box>

      <AuthBox />

      <Box sx={{ mt: 3 }}>
        <LanguageSwitcher />
      </Box>
    </Box>
  );
}
