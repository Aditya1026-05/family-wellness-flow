import { createFileRoute } from '@tanstack/react-router';
import { AddParentPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parents/new')({
  head: () => pageHead('Add a parent', 'Invite a parent to join your family care circle.'),
  component: AddParentPage,
});
