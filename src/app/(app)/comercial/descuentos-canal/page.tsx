import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { ETIQUETA_CANAL_CLIENTE } from "@/lib/etiquetas";
import DescuentoCanalFormulario from "./DescuentoCanalFormulario";

const CANALES = Object.keys(ETIQUETA_CANAL_CLIENTE) as (keyof typeof ETIQUETA_CANAL_CLIENTE)[];

export default async function DescuentosCanalPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const descuentos = await prisma.descuentoCanal.findMany();
  const porCanal = new Map(descuentos.map((d) => [d.canal, d.descuentoPct.toNumber()]));

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Descuento por canal de cliente
      </h1>
      <p className="text-neutral-500 mt-1">
        Se aplica sobre el precio ya resuelto por cantidad (escalón por volumen o precio base) al
        crear un pedido o cotización, según el canal del cliente seleccionado.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {CANALES.map((c) => (
          <div key={c} className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              {ETIQUETA_CANAL_CLIENTE[c]}
            </p>
            <DescuentoCanalFormulario canal={c} descuentoPct={porCanal.get(c) ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
