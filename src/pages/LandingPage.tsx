import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

const steps = ['step1', 'step2', 'step3'] as const;

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100%',
        background:
          'radial-gradient(circle 500px at 0% 75%, rgba(15,62,181,0.86) 0%, transparent 100%),' +
          'radial-gradient(circle 500px at 100% 75%, rgba(15,62,181,0.86) 0%, transparent 100%)',
        backgroundColor: 'white',
      }}
    >
      {/* Top bar */}
      <Box
        sx={{
          bgcolor: 'transparent',
          color: '#0f3eb5',
          px: { xs: 2, sm: 4 },
          py: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'cs-mollwish-2, sans-serif',
            fontSize: '2rem',
            color: '#0f3eb5',
            letterSpacing: 2,
          }}
        >
          ORKESTRO
        </Typography>
        <LanguageSwitcher />
      </Box>

      {/* Hero block */}
      <Box
        sx={{
          bgcolor: '#0f3eb5',
          color: 'white',
          px: { xs: 2, sm: 4, md: 8 },
          pt: 4,
          pb: 6,
          mx: { xs: 1, sm: 4, md: 12 },
          mt: 4,
          borderRadius: 4,
        }}
      >
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h4" sx={{ mb: -2, fontWeight: 'bold' }}>
            {t('landing.hero.title')}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'cs-mollwish-2, sans-serif',
              fontSize: { xs: '3rem', sm: '4.5rem', md: '6rem' },
              color: 'white',
              letterSpacing: { xs: 2, md: 4 },
              mb: 4,
            }}
          >
            ORKESTRO
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/auth')}
            sx={{
              bgcolor: 'white',
              color: '#0f3eb5',
              borderRadius: 8,
              px: { xs: 4, sm: 8 },
              py: 2,
              fontSize: { xs: '1.1rem', sm: '1.6rem' },
              fontWeight: 'bold',
              '&:hover': { bgcolor: '#e8eeff' },
            }}
          >
            {t('landing.hero.cta')}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mx: { xs: 2, sm: 6 }, my: 4, borderBottomWidth: 5, borderRadius: 2, borderColor: '#333333' }} />

      {/* Steps section */}
      <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, pb: 8, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 6, lineHeight: 1.0 }}>
          <span style={{ color: '#0f3eb5' }}>{t('landing.steps.heading1')}</span>
          <br />
          <span style={{ color: '#7795de' }}>{t('landing.steps.heading2')}</span>
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {steps.map((key) => (
            <Box
              key={key}
              sx={{
                bgcolor: 'white',
                borderRadius: 3,
                boxShadow: 3,
                p: 4,
                width: { xs: '100%', sm: 220 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: '#0f3eb5',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                }}
              >
                {t(`landing.steps.${key}.number`)}
              </Box>
              <Typography sx={{ textAlign: 'center' }}>
                {t(`landing.steps.${key}.text`)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
