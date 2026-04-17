import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';

interface Props {
  onSelect: (mode: 'register' | 'login') => void;
}

export default function ActionSelector({ onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={() => onSelect('register')}
        sx={{ bgcolor: '#0f3eb5', '&:hover': { bgcolor: '#0c32a0' }, fontWeight: 'bold' }}
      >
        {t('auth.select.register')}
      </Button>
      <Button
        variant="outlined"
        fullWidth
        size="large"
        onClick={() => onSelect('login')}
        sx={{ borderColor: '#0f3eb5', color: '#0f3eb5', fontWeight: 'bold' }}
      >
        {t('auth.select.login')}
      </Button>
    </Stack>
  );
}
