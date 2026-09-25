import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/features/care/entry-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/register')({
  head: () => pageHead('Create account', 'Create an account to coordinate care with your family.'),
  component: () => <AuthPage register />,
});
