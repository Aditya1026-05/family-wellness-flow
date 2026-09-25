import { createFileRoute } from '@tanstack/react-router';
import { ParentTodayPage } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/today')({
  head: () => pageHead('Your day', 'See your care tasks for today.'),
  component: ParentTodayPage,
});
