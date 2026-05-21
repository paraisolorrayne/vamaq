import { adminListVehicles } from '@/lib/repositories/vehiclesAdmin';
import VeiculosListClient from './VeiculosListClient';

export const dynamic = 'force-dynamic';

export default async function VeiculosListPage() {
  const vehicles = await adminListVehicles();
  return <VeiculosListClient vehicles={vehicles} />;
}
