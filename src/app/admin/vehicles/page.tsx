import { getVehicles } from "@/app/actions/vehicles";
import { getUsers } from "@/app/actions/users";
import { VehicleList } from "@/components/vehicles/VehicleList";
import { Car } from "lucide-react";

export default async function VehiclesPage() {
  const { vehicles, total } = await getVehicles(0, 20);
  const users = await getUsers();

  return (
    <div className="p-6 h-full overflow-y-auto space-y-8 animate-in fade-in duration-500 custom-scrollbar">
      {/* Modern Header */}
      <div className="flex items-center justify-between bg-neutral-900 p-6 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Car size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              Vehículos / Matrículas
            </h1>
            <p className="text-sm text-neutral-500 font-medium mt-1">
              Gestión completa del parque automotor
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Total</p>
            <p className="text-2xl font-black text-white">{total}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Activos</p>
            <p className="text-2xl font-black text-emerald-400">{total}</p>
          </div>
        </div>
      </div>

      <VehicleList initialVehicles={vehicles as any} initialTotal={total} users={users as any} />
    </div>
  );
}
