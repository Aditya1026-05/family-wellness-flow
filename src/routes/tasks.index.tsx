import { createFileRoute } from '@tanstack/react-router';
import { TasksPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/tasks/')({
  head: () => pageHead('Care tasks', 'Manage meals, medicines, exercise and other care tasks.'),
  component: TasksPage,
});
