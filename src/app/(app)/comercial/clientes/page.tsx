import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import { ETIQUETA_CANAL_CLIENTE } from "@/lib/etiquetas";
import { alternarActivoCliente } from "./actions";

const CANALES = Object.keys(ETIQUETA_CANAL_CLIENTE) as (keyof typeof ETIQUETA_CANAL_CLIENTE)[];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; canal?: string }>;
}) {
  const { q, estado, canal } = await searchParams;
  const filtroCanal = CANALES.find((c) => c === canal);

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(estado === "activo" ? { activo: true } : estado === "inactivo" ? { activo: false } : {}),
      ...(filtroCanal ? { canal: filtroCanal } : {}),
      ...(q
        ? {
            OR: [
              { razonSocial: { contains: q } },
              { nombreComercial: { contains: q } },
              { codigo: { contains: q } },
              { ruc: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      zona: true,
      vendedorAsignado: true,
      _count: { select: { pedidos: true } },
      facturas: { where: { estado: "PENDIENTE" }, select: { saldo: true } },
    },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>Clientes</h1>
          <p className="text-sm no-imprimir" style={{ color: "var(--epicor-texto-tenue)" }}>
            Cartera de clientes de la empresa.
          </p>
        </div>
        <div className="flex gap-2 no-imprimir">
          <BotonImprimir />
        </div>
      </div>

      <BarraFiltro q={q} placeholder="Razón social, código o RUC...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={estado ?? ""} className="campo-input">
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Canal</span>
          <select name="canal" defaultValue={filtroCanal ?? ""} className="campo-input">
            <option value="">Todos</option>
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CANAL_CLIENTE[c]}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        nuevoHref="/comercial/clientes/nuevo"
        nuevoTexto="Nuevo cliente"
        registros={clientes.map((c) => ({
          id: c.id,
          href: `/comercial/clientes/${c.id}`,
          primario: c.razonSocial,
          secundario: c.codigo,
        }))}
      >
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Razón social</th>
            <th>RUC / DNI</th>
            <th>Canal</th>
            <th>Ubicación</th>
            <th>Zona</th>
            <th>Vendedor</th>
            <th className="text-right">Deuda</th>
            <th className="text-right">Límite créd.</th>
            <th>Estado</th>
            <th className="no-imprimir"></th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => {
            const deuda = c.facturas.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
            const limite = c.limiteCredito.toNumber();
            const excedido = limite > 0 && deuda >= limite;
            return (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.codigo}</td>
                <td>
                  <span className="font-medium">{c.razonSocial}</span>
                  {c.nombreComercial && (
                    <span className="block text-xs text-neutral-400">{c.nombreComercial}</span>
                  )}
                </td>
                <td className="font-mono text-xs">{c.ruc ?? "—"}</td>
                <td className="text-sm text-neutral-500">
                  {c.canal ? ETIQUETA_CANAL_CLIENTE[c.canal] : "—"}
                </td>
                <td className="text-sm text-neutral-500">
                  {[c.distrito, c.departamento].filter(Boolean).join(", ") || "—"}
                </td>
                <td>{c.zona?.nombre ?? "—"}</td>
                <td className="text-sm">{c.vendedorAsignado?.nombre ?? "—"}</td>
                <td
                  className={`text-right ${
                    excedido ? "text-red-600 dark:text-red-400 font-medium" : ""
                  }`}
                >
                  {formatMoneda(deuda)}
                </td>
                <td className="text-right text-neutral-500">
                  {limite > 0 ? formatMoneda(limite) : "Sin límite"}
                </td>
                <td>
                  <span
                    className={`insignia ${
                      c.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right no-imprimir">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/comercial/clientes/${c.id}`}
                      className="text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      Ficha
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await alternarActivoCliente(c.id, !c.activo);
                      }}
                    >
                      <button type="submit" className="text-neutral-600 dark:text-neutral-400 hover:underline">
                        {c.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {clientes.length === 0 && (
            <tr>
              <td colSpan={11} className="text-center text-neutral-500 py-6">
                No hay clientes registrados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </PanelMaestroDetalle>
    </div>
  );
}
