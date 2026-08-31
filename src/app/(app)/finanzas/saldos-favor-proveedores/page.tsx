import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatFecha, formatMoneda } from "@/lib/format";
import { ETIQUETA_MEDIO_PAGO } from "@/lib/etiquetas";
import { OperacionesCreditoProveedor } from "./FormulariosCreditoProveedor";

export default async function SaldosFavorProveedoresPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "finanzas", "ver"))) redirect("/");
  const puedeEditar = await puedeRealizar(usuario, "finanzas", "editar");
  const [creditos, cuentasPendientes] = await Promise.all([
    prisma.creditoProveedor.findMany({
      include: {
        proveedor: true,
        devolucion: { include: { recepcionCompraDetalle: { include: { recepcion: true, insumo: true } } } },
        aplicaciones: { include: { cuentaPorPagar: true }, orderBy: { fecha: "desc" } },
        reembolsos: { orderBy: { fecha: "desc" } },
      },
      orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    }),
    prisma.cuentaPorPagar.findMany({
      where: { estado: "PENDIENTE", saldo: { gt: 0 } },
      select: { id: true, empresaId: true, proveedorId: true, numeroDocumento: true, saldo: true },
      orderBy: { fechaEmision: "asc" },
    }),
  ]);
  const totalDisponible = creditos.filter((credito) => credito.estado === "DISPONIBLE")
    .reduce((total, credito) => total + credito.saldoFuncional.toNumber(), 0);
  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Saldos a favor en proveedores</h1>
          <p className="mt-1 text-sm text-neutral-500">Activo recuperable originado por devoluciones que exceden la CxP abierta.</p></div>
        <div className="rounded-lg border border-black/10 px-4 py-3 text-right dark:border-white/10"><p className="text-xs text-neutral-500">Activo disponible (PEN)</p><p className="text-xl font-semibold">{formatMoneda(totalDisponible)}</p></div>
      </div>
      <div className="space-y-4">
        {creditos.map((credito) => {
          const detalle = credito.devolucion.recepcionCompraDetalle;
          const cuentas = cuentasPendientes.filter((cuenta) => cuenta.empresaId === credito.empresaId && cuenta.proveedorId === credito.proveedorId)
            .map((cuenta) => ({ id: cuenta.id, numeroDocumento: cuenta.numeroDocumento, saldo: cuenta.saldo.toNumber() }));
          return <article key={credito.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{credito.proveedor.razonSocial}</p><p className="font-mono text-xs text-neutral-500">Devolución recepción {detalle.recepcion.numero} · {detalle.insumo.nombre}</p><p className="text-xs text-neutral-500">{formatFecha(credito.creadoEn)}</p></div><div className="text-right"><span className="insignia bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{credito.estado === "DISPONIBLE" ? "Disponible" : "Agotado"}</span><p className="mt-2 text-lg font-semibold">{formatMoneda(credito.saldoFuncional)}</p><p className="text-xs text-neutral-500">Origen {formatMoneda(credito.montoFuncionalOriginal)}</p></div></div>
            {credito.estado === "DISPONIBLE" && puedeEditar && <OperacionesCreditoProveedor creditoId={credito.id} saldo={credito.saldoFuncional.toNumber()} cuentas={cuentas} />}
            {credito.aplicaciones.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Compensaciones</h3>{credito.aplicaciones.map((aplicacion) => <p key={aplicacion.id} className="mt-1 text-sm">{formatFecha(aplicacion.fecha) + " · " + aplicacion.cuentaPorPagar.numeroDocumento + " · " + formatMoneda(aplicacion.montoFuncional)}</p>)}</div>}
            {credito.reembolsos.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Reembolsos recibidos</h3>{credito.reembolsos.map((reembolso) => <p key={reembolso.id} className="mt-1 text-sm">{formatFecha(reembolso.fecha) + " · " + ETIQUETA_MEDIO_PAGO[reembolso.medioPago] + " · " + formatMoneda(reembolso.montoFuncional) + " · " + (reembolso.referencia ?? "—")}</p>)}</div>}
          </article>;
        })}
        {creditos.length === 0 && <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500 dark:border-white/15">No existen saldos a favor. Se crearán cuando una devolución exceda el saldo pendiente de la recepción.</div>}
      </div>
    </div>
  );
}
