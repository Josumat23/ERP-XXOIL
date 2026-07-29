import { redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/auth";
import PanelMonitoreo from "./PanelMonitoreo";

export default async function MonitoreoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Monitoreo del servidor
      </h1>
      <p className="text-neutral-500 mt-1">
        Métricas en vivo (CPU, memoria, disco, salud de la base de datos) del servidor donde corre el
        ERP, transmitidas por WebSocket cada 2 segundos.
      </p>
      <div className="mt-6">
        <PanelMonitoreo />
      </div>
    </div>
  );
}
