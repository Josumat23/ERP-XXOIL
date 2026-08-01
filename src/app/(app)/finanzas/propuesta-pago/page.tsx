import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PropuestaPagoFormulario from "./PropuestaPagoFormulario";

// Propuesta de pago a proveedores (equivalente reducido al programa de pago
// automático F110 de SAP): en vez de registrar cada pago uno por uno, se
// seleccionan varias cuentas por pagar vencidas o próximas a vencer y se
// pagan todas de una vez, con el mismo motor y las mismas reglas de
// aprobación que el pago individual.
export default async function PropuestaPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ hasta?: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA")) redirect("/");

  const { hasta: hastaParam } = await searchParams;
  const hoy = new Date();
  const hasta = hastaParam && /^\d{4}-\d{2}-\d{2}$/.test(hastaParam) ? new Date(hastaParam) : hoy;

  const cuentas = await prisma.cuentaPorPagar.findMany({
    where: {
      estado: "PENDIENTE",
      OR: [{ fechaVencimiento: null }, { fechaVencimiento: { lte: hasta } }],
    },
    include: { proveedor: true },
    orderBy: [{ fechaVencimiento: "asc" }],
  });

  const totalPendiente = cuentas.reduce((acc, c) => acc + c.saldo.toNumber(), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Propuesta de pago a proveedores
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Cuentas por pagar vencidas o con vencimiento hasta la fecha elegida. Total mostrado:{" "}
        <span className="font-semibold" style={{ color: "var(--epicor-texto)" }}>
          {formatMoneda(totalPendiente)}
        </span>
      </p>

      <form method="get" className="flex items-end gap-3 mb-6 no-imprimir">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Pagar vencimientos hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta.toISOString().slice(0, 10)}
            className="campo-input"
          />
        </label>
        <button type="submit" className="boton-secundario">
          Filtrar
        </button>
      </form>

      <PropuestaPagoFormulario
        cuentas={cuentas.map((c) => ({
          id: c.id,
          numeroDocumento: c.numeroDocumento,
          proveedor: c.proveedor.razonSocial,
          fechaVencimiento: c.fechaVencimiento ? c.fechaVencimiento.toLocaleDateString("es-PE") : null,
          saldo: c.saldo.toNumber(),
        }))}
      />
    </div>
  );
}
