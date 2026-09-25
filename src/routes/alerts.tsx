import { createFileRoute } from '@tanstack/react-router';
import { AlertsPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/alerts')({
  head: () => pageHead('Alerts', 'See missed tasks, escalations and important reminders.'),
  component: AlertsPage,
});
