import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/features/care/entry-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/')({
  head: () => pageHead('CareCircle', 'Helping families care from anywhere. A simpler way to support the people you love.'),
  component: LandingPage,
});
