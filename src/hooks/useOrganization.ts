import { useContext } from 'react';
import { OrganizationContext } from '../context/OrganizationContext.context';

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return ctx;
}
