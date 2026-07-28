import { prisma } from "@/lib/prisma";
import CascoFormulario from "./CascoFormulario";

export default async function CascosPage() {
  const [clientes, insumosRetornables, movimientos] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.insumo.findMany({ where: { esRetornable: true }, orderBy: { codigo: "asc" } }),
    prisma.movimientoCasco.findMany({
      include: { cliente: true, insumo: true },
      orderBy: { fecha: "desc" },
    }),
  ]);

  // Pendiente por (cliente, insumo) = ENTREGADO − DEVUELTO.
  const pendientes = new Map<
    string,
    { clienteNombre: string; insumoNombre: string; montoDeposito: number; cantidad: number }
  >();
  for (const m of movimientos) {
    const clave = `${m.clienteId}:${m.insumoId}`;
    const actual = pendientes.get(clave) ?? {
      clienteNombre: m.cliente.razonSocial,
      insumoNombre: m.insumo.nombre,
      montoDeposito: m.insumo.montoDeposito?.toNumber() ?? 0,
      cantidad: 0,
    };
    actual.cantidad += m.tipo === "ENTREGADO" ? m.cantidad : -m.cantidad;
    pendientes.set(clave, actual);
  }
  const pendientesConSaldo = [...pendientes.values()].filter((p) => p.cantidad > 0);
  const totalDepositoPendiente = pendientesConSaldo.reduce(
    (acc, p) => acc + p.cantidad * p.montoDeposito,
    0
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Cascos pendientes por cliente
      </h1>
      <p className="text-neutral-500 mt-1">
        Envases retornables (ej. tambores metálicos) entregados a clientes y aún no devueltos, con
        su depósito asociado. Registro manual — no se deriva automáticamente de las ventas.
      </p>

      {insumosRetornables.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mt-4">
          No hay insumos marcados como "envase retornable" todavía — márcalos en Catálogo → Insumos.
        </p>
      ) : (
        <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <CascoFormulario
            clientes={clientes.map((c) => ({ id: c.id, etiqueta: c.razonSocial }))}
            insumos={insumosRetornables.map((i) => ({ id: i.id, etiqueta: i.nombre }))}
          />
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Pendientes por cliente</h2>
          <p className="text-sm text-neutral-500">
            Depósito total comprometido: S/ {totalDepositoPendiente.toFixed(2)}
          </p>
        </div>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Envase</th>
              <th className="text-right">Cascos pendientes</th>
              <th className="text-right">Depósito comprometido</th>
            </tr>
          </thead>
          <tbody>
            {pendientesConSaldo.map((p, i) => (
              <tr key={i}>
                <td>{p.clienteNombre}</td>
                <td>{p.insumoNombre}</td>
                <td className="text-right">{p.cantidad}</td>
                <td className="text-right">S/ {(p.cantidad * p.montoDeposito).toFixed(2)}</td>
              </tr>
            ))}
            {pendientesConSaldo.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-neutral-500 py-4">
                  Sin cascos pendientes de devolución.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Movimientos recientes</h2>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Envase</th>
              <th>Movimiento</th>
              <th className="text-right">Cantidad</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.slice(0, 50).map((m) => (
              <tr key={m.id}>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(m.fecha)}
                </td>
                <td>{m.cliente.razonSocial}</td>
                <td className="text-sm text-neutral-500">{m.insumo.nombre}</td>
                <td>
                  <span
                    className={`insignia ${
                      m.tipo === "ENTREGADO"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                        : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                    }`}
                  >
                    {m.tipo === "ENTREGADO" ? "Entregado" : "Devuelto"}
                  </span>
                </td>
                <td className="text-right">{m.cantidad}</td>
                <td className="text-sm text-neutral-500">{m.referencia ?? "—"}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-500 py-4">
                  Sin movimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
