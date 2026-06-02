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
  login?: string;
  password?: string;
}

const isEmail = (value: string) => value.includes('@');

export default function LoginForm({ onBack }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { showAlert } = useAppAlert();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!loginValue.trim()) {
      errors.login = t('auth.errors.loginRequired');
    } else if (isEmail(loginValue)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginValue)) {
        errors.login = t('auth.errors.emailInvalid');
      }
    } else {
      if (!/^[a-zA-Z0-9_]+$/.test(loginValue)) {
        errors.login = t('auth.errors.usernameLatinOnly');
      } else if (loginValue.length < 3) {
        errors.login = t('auth.errors.usernameMinLength');
      }
    }

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
        body: { login: loginValue, password },
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
        label={t('auth.login.login')}
        value={loginValue}
        onChange={(e) => { setLoginValue(e.target.value); setFieldErrors((p) => ({ ...p, login: undefined })); }}
        fullWidth
        required
        error={!!fieldErrors.login}
        helperText={fieldErrors.login}
        autoComplete="username"
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
        autoComplete="current-password"
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
