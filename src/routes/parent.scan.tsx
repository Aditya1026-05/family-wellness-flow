import { createFileRoute } from '@tanstack/react-router';
import { ScanPage } from '@/features/care/parent-pages';
import { pageHead } from '@/features/care/meta';
export const Route = createFileRoute('/parent/scan')({
  head: () => pageHead('Join your circle', 'Scan an invite to join your family on CareCircle.'),
  component: ScanPage,
});
