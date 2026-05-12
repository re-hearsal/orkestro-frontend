import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background:
          'radial-gradient(circle 500px at 0% 75%, rgba(15,62,181,0.86) 0%, transparent 100%),' +
          'radial-gradient(circle 500px at 100% 75%, rgba(15,62,181,0.86) 0%, transparent 100%)',
        backgroundColor: 'white',
      }}
    >
      <Button
        variant="outlined"
        onClick={handleLogout}
        sx={{ borderColor: '#0f3eb5', color: '#0f3eb5' }}
      >
        {t('dashboard.logout')}
      </Button>
    </Box>
  );
}
