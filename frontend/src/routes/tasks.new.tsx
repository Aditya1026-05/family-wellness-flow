import { createFileRoute } from '@tanstack/react-router';
import { CreateTaskPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/tasks/new')({
  head: () => pageHead('Create a task', 'Set a care reminder for someone you love.'),
  component: CreateTaskPage,
});
