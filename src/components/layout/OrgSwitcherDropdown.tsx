import { Menu, MenuItem, Typography } from '@mui/material';
import { useOrganization } from '../../hooks/useOrganization';

interface OrgSwitcherDropdownProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function OrgSwitcherDropdown({ anchorEl, onClose }: OrgSwitcherDropdownProps) {
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();

  const handleSelect = (org: (typeof organizations)[number]) => {
    setCurrentOrganization(org);
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{
        paper: {
          elevation: 4,
          sx: { mt: 1, minWidth: 200, borderRadius: 2 },
        },
      }}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
    >
      {organizations.map((org) => (
        <MenuItem
          key={org.id}
          selected={org.id === currentOrganization?.id}
          onClick={() => handleSelect(org)}
          sx={{
            fontFamily: 'Century Gothic, sans-serif',
            fontSize: '0.9rem',
            '&.Mui-selected': { bgcolor: 'rgba(15,62,181,0.08)' },
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Century Gothic, sans-serif',
              fontSize: '0.9rem',
              fontWeight: org.id === currentOrganization?.id ? 700 : 400,
            }}
          >
            {org.name}
          </Typography>
        </MenuItem>
      ))}
    </Menu>
  );
}
