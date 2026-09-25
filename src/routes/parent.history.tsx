import { createFileRoute } from '@tanstack/react-router';
import { ParentHistoryPage } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/history')({
  head: () => pageHead('Your last 7 days', 'See your recent care completion history.'),
  component: ParentHistoryPage,
});
