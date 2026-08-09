import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { diasVencidos, nivelSugerido, ETIQUETA_NIVEL } from "@/lib/cobranza";
import { registrarAvisoCobranza, alternarBloqueoCliente } from "./actions";

export default async function CobranzaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA" && usuario.rol !== "VENTAS")) {
    redirect("/");
  }

  const hoy = new Date();

  const facturas = await prisma.factura.findMany({
    where: { estado: "PENDIENTE", fechaVencimiento: { lt: hoy } },
    include: {
      cliente: true,
      avisosCobranza: { orderBy: { fecha: "desc" }, take: 1 },
    },
    orderBy: { fechaVencimiento: "asc" },
  });

  const vencidas = facturas.filter((f) => f.saldo.toNumber() > 1e-9);
  const totalVencido = vencidas.reduce((acc, f) => acc + f.saldo.toNumber(), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Gestión de cobranza
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--epicor-texto-tenue)" }}>
        Facturas vencidas sin cobrar, con el nivel de aviso sugerido según días de atraso (1–15 días:
        amistoso, 16–30: formal, más de 30: final). Distinto del recargo por mora — esto es
        seguimiento de comunicación con el cliente, no un cargo adicional. Total vencido:{" "}
        <span className="font-semibold" style={{ color: "var(--epicor-texto)" }}>
          {formatMoneda(totalVencido)}
        </span>
      </p>

      <table className="tabla">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Factura</th>
            <th>Vencimiento</th>
            <th className="text-right">Días vencidos</th>
            <th className="text-right">Saldo</th>
            <th>Nivel sugerido</th>
            <th>Último aviso</th>
            <th className="no-imprimir">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {vencidas.map((f) => {
            const dias = diasVencidos(f.fechaVencimiento, hoy);
            const nivel = nivelSugerido(dias);
            const ultimoAviso = f.avisosCobranza[0];
            return (
              <tr key={f.id}>
                <td>
                  <Link href={`/comercial/clientes/${f.clienteId}`} className="hover:underline">
                    {f.cliente.razonSocial}
                  </Link>
                  {f.cliente.bloqueadoCobranza && (
                    <span className="insignia ml-2 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
                      Bloqueado
                    </span>
                  )}
                </td>
                <td className="font-mono text-xs">
                  <Link href={`/comercial/facturas/${f.id}`} className="hover:underline">
                    {f.numero}
                  </Link>
                </td>
                <td>{f.fechaVencimiento.toLocaleDateString("es-PE")}</td>
                <td className="text-right">{dias}</td>
                <td className="text-right">{formatMoneda(f.saldo.toNumber())}</td>
                <td>
                  <span
                    className={`insignia ${
                      nivel === 3
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                        : nivel === 2
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800"
                    }`}
                  >
                    {ETIQUETA_NIVEL[nivel]}
                  </span>
                </td>
                <td className="text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
                  {ultimoAviso
                    ? `${ETIQUETA_NIVEL[ultimoAviso.nivel]} · ${ultimoAviso.fecha.toLocaleDateString("es-PE")}`
                    : "Sin avisos"}
                </td>
                <td className="text-right no-imprimir">
                  <div className="flex items-center gap-3 justify-end">
                    <form
                      action={async () => {
                        "use server";
                        await registrarAvisoCobranza(f.id);
                      }}
                    >
                      <button type="submit" className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline">
                        Registrar aviso
                      </button>
                    </form>
                    {usuario.rol !== "VENTAS" && (
                      <form
                        action={async () => {
                          "use server";
                          await alternarBloqueoCliente(f.clienteId, !f.cliente.bloqueadoCobranza);
                        }}
                      >
                        <button type="submit" className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          {f.cliente.bloqueadoCobranza ? "Desbloquear" : "Bloquear"}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {vencidas.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                No hay facturas vencidas pendientes de cobro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
