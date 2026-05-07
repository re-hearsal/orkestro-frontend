import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ruRU, enUS } from '@mui/x-date-pickers/locales';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useAppAlert } from '../../hooks/useAppAlert';

interface Props {
  onBack: () => void;
}

interface Step1Errors {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
}

interface Step2Errors {
  birthDate?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const dayjsLocale = i18n.language === "ru" ? "ru" : "en";
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showAlert } = useAppAlert();

  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});

  // Step 2
  const [birthDate, setBirthDate] = useState<Dayjs | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<'RU' | 'EN'>('RU');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});

  const validateStep1 = (): boolean => {
    const errors: Step1Errors = {};
    if (!username.trim()) errors.username = t('auth.errors.usernameRequired');
    else if (username.trim().length < 3) errors.username = t('auth.errors.usernameMinLength');
    else if (/\s/.test(username)) errors.username = t('auth.errors.usernameNoSpaces');
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.username = t('auth.errors.usernameLatinOnly');

    if (!name.trim()) errors.name = t('auth.errors.nameRequired');

    if (!email.trim()) errors.email = t('auth.errors.emailRequired');
    else if (!EMAIL_RE.test(email)) errors.email = t('auth.errors.emailInvalid');

    if (!password) errors.password = t('auth.errors.passwordRequired');
    else if (password.length < 8) errors.password = t('auth.errors.passwordMinLength');

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Step2Errors = {};
    if (!birthDate) errors.birthDate = t('auth.errors.birthDateRequired');
    else if (birthDate.isAfter(dayjs())) errors.birthDate = t('auth.errors.birthDateFuture');
    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep1()) return;
    setStep(1);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAvatar(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAvatarRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatar(null);
    setAvatarPreview(null);
    const input = document.getElementById('avatar-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('name', name);
      formData.append('email', email);
      formData.append('birthDate', birthDate!.format('YYYY-MM-DD'));
      formData.append('preferredLanguage', preferredLanguage);
      if (location.trim()) formData.append('location', location.trim());
      if (avatar) formData.append('avatar', avatar);


      const { data, error: apiErr } = await (client.POST as any)('/api/v1/auth/register', {
        body: formData,
        bodySerializer: (body: FormData) => body,
      });

      if (apiErr || !data?.token || !data?.username) {
        const details: string[] = apiErr?.details ?? [];
        showAlert(details.length > 0 ? details.join('\n') : (apiErr?.message ?? t('auth.errors.registerFailed')), 'error');
        return;
      }

      login(data.token, data.username);
      navigate('/organizations');
    } catch {
      showAlert(t('auth.errors.registerError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearStep1Error = (field: keyof Step1Errors) =>
    setStep1Errors((p) => ({ ...p, [field]: undefined }));

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={dayjsLocale}
      localeText={dayjsLocale === "ru" ? ruRU.components.MuiLocalizationProvider.defaultProps.localeText : enUS.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f3eb5', textAlign: 'center' }}>
          {t('auth.register.title')}
        </Typography>

        <Stepper activeStep={step} alternativeLabel>
          <Step><StepLabel>{t('auth.register.step1')}</StepLabel></Step>
          <Step><StepLabel>{t('auth.register.step2')}</StepLabel></Step>
        </Stepper>

        {step === 0 ? (
          <Stack spacing={2} component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <TextField
              label={t('auth.register.username')}
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearStep1Error('username'); }}
              fullWidth
              required
              error={!!step1Errors.username}
              helperText={step1Errors.username}
            />
            <TextField
              label={t('auth.register.name')}
              value={name}
              onChange={(e) => { setName(e.target.value); clearStep1Error('name'); }}
              fullWidth
              required
              error={!!step1Errors.name}
              helperText={step1Errors.name}
            />
            <TextField
              label={t('auth.register.email')}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearStep1Error('email'); }}
              fullWidth
              required
              error={!!step1Errors.email}
              helperText={step1Errors.email}
            />
            <TextField
              label={t('auth.register.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearStep1Error('password'); }}
              fullWidth
              required
              error={!!step1Errors.password}
              helperText={step1Errors.password}
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
            <Button type="submit" variant="contained" fullWidth size="large" sx={{ bgcolor: '#0f3eb5', '&:hover': { bgcolor: '#0c32a0' }, fontWeight: 'bold' }}>
              {t('auth.register.next')}
            </Button>
            <Link component="button" onClick={onBack} sx={{ textAlign: 'center', color: '#0f3eb5' }}>
              {t('auth.login.back')}
            </Link>
          </Stack>
        ) : (
          <Stack spacing={2} component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <DatePicker
              label={t('auth.register.birthDate')}
              value={birthDate}
              onChange={(val) => { setBirthDate(val); setStep2Errors((p) => ({ ...p, birthDate: undefined })); }}
              maxDate={dayjs()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!step2Errors.birthDate,
                  helperText: step2Errors.birthDate,
                },
              }}
            />
            <TextField
              select
              label={t('auth.register.preferredLanguage')}
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as 'RU' | 'EN')}
              fullWidth
            >
              <MenuItem value="RU">RU</MenuItem>
              <MenuItem value="EN">EN</MenuItem>
            </TextField>
            <TextField
              label={t('auth.register.location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
            />
            <Box>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="avatar-upload">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    border: '2px dashed',
                    borderColor: avatar ? '#0f3eb5' : 'grey.400',
                    borderRadius: 3,
                    cursor: 'pointer',
                    bgcolor: avatar ? 'rgba(15,62,181,0.05)' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#0f3eb5', bgcolor: 'rgba(15,62,181,0.05)' },
                  }}
                >
                  {avatarPreview ? (
                    <Box
                      component="img"
                      src={avatarPreview}
                      alt="preview"
                      sx={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <CloudUploadIcon sx={{ color: 'grey.500', fontSize: 32, flexShrink: 0 }} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: avatar ? '#0f3eb5' : 'text.secondary' }}>
                      {avatar ? avatar.name : t('auth.register.avatar')}
                    </Typography>
                    {!avatar && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        PNG, JPG, WEBP
                      </Typography>
                    )}
                  </Box>
                  {avatar && (
                    <IconButton
                      size="small"
                      onClick={handleAvatarRemove}
                      sx={{ color: 'grey.500', '&:hover': { color: 'error.main' } }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </label>
            </Box>
            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ bgcolor: '#0f3eb5', '&:hover': { bgcolor: '#0c32a0' }, fontWeight: 'bold' }}>
              {t('auth.register.submit')}
            </Button>
            <Link component="button" onClick={() => setStep(0)} sx={{ textAlign: 'center', color: '#0f3eb5' }}>
              {t('auth.register.back')}
            </Link>
          </Stack>
        )}
      </Stack>
    </LocalizationProvider>
  );
}
