import { createFileRoute } from '@tanstack/react-router';
import { ParentDetailsPage } from '@/features/care/child-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parents/$parentId')({
  head: () => pageHead('Parent details', 'Review a parent’s tasks, activity and weekly adherence.'),
  component: ParentDetailsPage,
});
