import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/profile')({
  head: () => pageHead('Profile', 'Manage your CareCircle family profile and preferences.'),
  component: ProfilePage,
});
