import { createFileRoute } from '@tanstack/react-router';
import { NotificationDemo } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/notifications')({
  head: () => pageHead('Reminders', 'See your care reminders and notifications.'),
  component: NotificationDemo,
});
