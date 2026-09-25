import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/features/care/entry-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/login')({
  head: () => pageHead('Login', 'Sign in to your CareCircle family workspace.'),
  component: AuthPage,
});
