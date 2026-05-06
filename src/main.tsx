import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

if (import.meta.env.DEV) {
  const _origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('outdated JSX transform')) return
    _origError(...args)
  }
}
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import './i18n/index.ts'
import App from './App.tsx'
import theme from './theme/theme.ts'
import { AuthProvider } from './context/AuthContext.tsx'
import { OrganizationProvider } from './context/OrganizationContext.tsx'
import { AppAlertProvider } from './context/AppAlertContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppAlertProvider>
        <AuthProvider>
          <OrganizationProvider>
            <App />
          </OrganizationProvider>
        </AuthProvider>
      </AppAlertProvider>
    </ThemeProvider>
  </StrictMode>,
)
