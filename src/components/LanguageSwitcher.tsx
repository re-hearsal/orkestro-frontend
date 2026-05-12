import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const toggle = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  return (
    <Button onClick={toggle} sx={{ color: 'inherit', fontWeight: 'bold', minWidth: 64 }}>
      {t('language.current')}
    </Button>
  );
}
