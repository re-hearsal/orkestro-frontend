import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useAppAlert } from '../../hooks/useAppAlert';

interface Props {
  onBack: () => void;
}

interface FieldErrors {
  username?: string;
  password?: string;
}

export default function LoginForm({ onBack }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { showAlert } = useAppAlert();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = t('auth.errors.usernameRequired');
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.username = t('auth.errors.usernameLatinOnly');
    if (!password) errors.password = t('auth.errors.passwordRequired');
    else if (password.length < 8) errors.password = t('auth.errors.passwordMinLength');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error: apiError } = await client.POST('/api/v1/auth/login', {
        body: { username, password },
      });
      if (apiError || !data?.token || !data?.username) {
        showAlert((apiError as { message?: string })?.message ?? t('auth.errors.loginFailed'), 'error');
        return;
      }
      login(data.token, data.username);
      navigate('/organizations');
    } catch {
      showAlert(t('auth.errors.loginError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2} component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f3eb5', textAlign: 'center' }}>
        {t('auth.login.title')}
      </Typography>

      <TextField
        label={t('auth.login.username')}
        value={username}
        onChange={(e) => { setUsername(e.target.value); setFieldErrors((p) => ({ ...p, username: undefined })); }}
        fullWidth
        required
        error={!!fieldErrors.username}
        helperText={fieldErrors.username}
      />
      <TextField
        label={t('auth.login.password')}
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
        fullWidth
        required
        error={!!fieldErrors.password}
        helperText={fieldErrors.password}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ bgcolor: '#0f3eb5', '&:hover': { bgcolor: '#0c32a0' }, fontWeight: 'bold' }}
      >
        {t('auth.login.submit')}
      </Button>

      <Link component="button" onClick={onBack} sx={{ textAlign: 'center', color: '#0f3eb5' }}>
        {t('auth.login.back')}
      </Link>
    </Stack>
  );
}
