import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ActionSelector from './ActionSelector';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

type Mode = 'select' | 'register' | 'login';

export default function AuthBox() {
  const [mode, setMode] = useState<Mode>('select');

  return (
    <Paper
      elevation={4}
      sx={{
        width: '100%',
        maxWidth: 480,
        p: { xs: 3, sm: 4 },
        borderRadius: 4,
        background: 'linear-gradient(135deg, #e8f0ff 0%, #ffffff 100%)',
      }}
    >
      <Box>
        {mode === 'select' && <ActionSelector onSelect={setMode} />}
        {mode === 'login' && <LoginForm onBack={() => setMode('select')} />}
        {mode === 'register' && <RegisterForm onBack={() => setMode('select')} />}
      </Box>
    </Paper>
  );
}
