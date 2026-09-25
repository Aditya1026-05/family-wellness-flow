import { createFileRoute } from '@tanstack/react-router';
import { ParentHomePage } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/home')({
  head: () => pageHead('Your next task', 'One simple care task at a time.'),
  component: ParentHomePage,
});
