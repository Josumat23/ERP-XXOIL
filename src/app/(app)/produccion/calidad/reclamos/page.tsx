import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import BarraFiltro from "@/components/BarraFiltro";
import ReclamoFormulario from "./ReclamoFormulario";
import { contiene } from "@/lib/busqueda";
import AlcanceDeLista from "@/components/AlcanceDeLista";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  CERRADO: "Cerrado",
};

// Cuántas opciones se ofrecen en cada lista antes de pedir que se filtre.
const TOPE_SELECTOR = 50;

export default async function ReclamosClientePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    paraCliente?: string;
    qCliente?: string;
    qFactura?: string;
  }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const { q, estado, paraCliente, qCliente, qFactura } = await searchParams;
  const filtroEstado = Object.keys(ETIQUETA_ESTADO).find((e) => e === estado);
  const empresaId = usuario.empresaId;

  const [reclamos, clientes, clientesTotales, causas] = await Promise.all([
    prisma.reclamoCliente.findMany({
      where: {
        empresaId,
        ...(filtroEstado ? { estado: filtroEstado as "ABIERTO" | "EN_PROCESO" | "CERRADO" } : {}),
        ...(q
          ? { OR: [{ numero: contiene(q) }, { cliente: { razonSocial: contiene(q) } }] }
          : {}),
      },
      include: { cliente: true, causa: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.cliente.findMany({
      where: {
        empresaId,
        estado: "ACTIVO",
        ...(qCliente
          ? { OR: [{ razonSocial: contiene(qCliente) }, { codigo: contiene(qCliente) }] }
          : {}),
      },
      orderBy: { razonSocial: "asc" },
      take: TOPE_SELECTOR,
    }),
    prisma.cliente.count({ where: { empresaId, estado: "ACTIVO" } }),
    prisma.causaCalidad.findMany({
      where: { empresaId, activo: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  // -------------------------------------------------------------------------
  // Las facturas del cliente, no las últimas cien de la compañía.
  //
  // La pantalla traía las 100 facturas más recientes de TODA la empresa y las
  // filtraba por cliente en el navegador. Con los datos de hoy —19 facturas—
  // funciona. Con volumen real, un cliente cuyas facturas no estén entre las
  // cien últimas aparece SIN NINGUNA, y quien registra el reclamo concluye que
  // no tiene facturas y lo deja sin relacionar.
  //
  // Y el reclamo sin factura es precisamente el que después no puede decir de
  // qué lote salió: el defecto silencioso de esta lista desactiva la pantalla
  // que se construyó encima.
  //
  // Ahora se elige primero el cliente y se consultan SUS facturas, acotadas y
  // buscables, diciendo cuántas se muestran de cuántas hay.
  // -------------------------------------------------------------------------
  const clienteElegido = paraCliente
    ? await prisma.cliente.findFirst({
        // El id viene del navegador: se comprueba contra la compañía activa.
        where: { id: paraCliente, empresaId, estado: "ACTIVO" },
        select: { id: true, codigo: true, razonSocial: true },
      })
    : null;

  const [facturas, facturasTotales] = clienteElegido
    ? await Promise.all([
        prisma.factura.findMany({
          where: {
            empresaId,
            clienteId: clienteElegido.id,
            estado: { not: "ANULADA" },
            ...(qFactura ? { numero: contiene(qFactura) } : {}),
          },
          select: { id: true, numero: true, fechaEmision: true },
          orderBy: { fechaEmision: "desc" },
          take: TOPE_SELECTOR,
        }),
        prisma.factura.count({
          where: { empresaId, clienteId: clienteElegido.id, estado: { not: "ANULADA" } },
        }),
      ])
    : [[], 0];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/produccion/calidad" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
            ← Volver a control de calidad
          </Link>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
            Reclamos de cliente
          </h1>
          <p className="text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
            Notificación formal de calidad recibida después de la venta, con seguimiento hasta el
            cierre.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <BarraFiltro q={q} placeholder="Número o cliente...">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
          <select name="estado" defaultValue={filtroEstado ?? ""} className="campo-input">
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
      </BarraFiltro>

      <PanelMaestroDetalle
        registros={reclamos.map((r) => ({
          id: r.id,
          href: `/produccion/calidad/reclamos/${r.id}`,
          primario: r.numero,
          secundario: r.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        {/*
          El cliente se elige primero, por GET, y recién entonces se consultan
          SUS facturas. Va en su propio formulario y no dentro del de alta
          porque un formulario no se anida en otro — y porque son dos cosas
          distintas: una consulta y un alta.
        */}
        <form method="get" className="flex flex-wrap items-end gap-3 mb-3 no-imprimir">
          {q && <input type="hidden" name="q" value={q} />}
          {filtroEstado && <input type="hidden" name="estado" value={filtroEstado} />}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Filtrar clientes
            </span>
            <input
              type="search"
              name="qCliente"
              defaultValue={qCliente ?? ""}
              placeholder="Razón social o código"
              className="campo-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Reclamo de qué cliente
            </span>
            <select
              name="paraCliente"
              defaultValue={clienteElegido?.id ?? ""}
              className="campo-input min-w-72"
            >
              <option value="">Seleccione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razonSocial}
                </option>
              ))}
            </select>
          </label>
          {clienteElegido && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Filtrar sus facturas
              </span>
              <input
                type="search"
                name="qFactura"
                defaultValue={qFactura ?? ""}
                placeholder="Número de factura"
                className="campo-input"
              />
            </label>
          )}
          <button type="submit" className="boton-secundario">
            Buscar
          </button>
        </form>
        <AlcanceDeLista
          mostrados={clientes.length}
          totales={clientesTotales}
          tope={TOPE_SELECTOR}
          busqueda={qCliente}
          queBusca="clientes activos"
        />
        {clienteElegido && (
          <AlcanceDeLista
            mostrados={facturas.length}
            totales={facturasTotales}
            tope={TOPE_SELECTOR}
            busqueda={qFactura}
            queBusca={`facturas de ${clienteElegido.razonSocial}`}
          />
        )}

        {clienteElegido ? (
          <ReclamoFormulario
            cliente={{ id: clienteElegido.id, etiqueta: clienteElegido.razonSocial }}
            facturas={facturas.map((f) => ({ id: f.id, numero: f.numero }))}
            causas={causas.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
          />
        ) : (
          <p className="text-sm borde-seccion" style={{ color: "var(--epicor-texto-tenue)" }}>
            Elija el cliente para registrar un reclamo. Sus facturas se consultan recién entonces:
            ofrecer las últimas de toda la compañía dejaría fuera a quien no facturó hace poco, y
            un reclamo sin factura después no puede decir de qué lote salió.
          </p>
        )}

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Causa</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {reclamos.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">
                  <Link href={`/produccion/calidad/reclamos/${r.id}`} className="hover:underline">
                    {r.numero}
                  </Link>
                </td>
                <td>{r.cliente.razonSocial}</td>
                <td className="text-sm text-neutral-500">{r.causa?.nombre ?? "—"}</td>
                <td>
                  <span
                    className={`insignia ${
                      r.estado === "CERRADO"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                        : r.estado === "EN_PROCESO"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {ETIQUETA_ESTADO[r.estado]}
                  </span>
                </td>
                <td className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(r.fecha)}
                </td>
              </tr>
            ))}
            {reclamos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-500 py-6">
                  No hay reclamos registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
