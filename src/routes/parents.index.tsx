import { createFileRoute } from '@tanstack/react-router';
import { ParentsPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parents')({
  head: () => pageHead('Parents', 'See the people in your circle and how their day is going.'),
  component: ParentsPage,
});
