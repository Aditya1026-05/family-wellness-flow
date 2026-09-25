import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/dashboard')({
  head: () => pageHead('Family dashboard', 'See today’s care tasks, family progress, alerts and activity.'),
  component: DashboardPage,
});
