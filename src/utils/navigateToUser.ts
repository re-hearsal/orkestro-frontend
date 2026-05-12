import type { NavigateFunction } from 'react-router-dom';

export function navigateToUser(
  userId: number | undefined,
  currentUserId: number | undefined,
  navigate: NavigateFunction
): void {
  if (userId === undefined || userId === null) return;
  if (userId === currentUserId) {
    navigate('/profile');
  } else {
    navigate(`/users/${userId}`);
  }
}
