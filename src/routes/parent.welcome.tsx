import { createFileRoute } from '@tanstack/react-router';
import { WelcomePage } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/welcome')({
  head: () => pageHead('Welcome', 'Welcome to your simple daily care experience.'),
  component: WelcomePage,
});
