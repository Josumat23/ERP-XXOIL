import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";
import { diasVencidos, nivelSugerido, ETIQUETA_NIVEL } from "@/lib/cobranza";
import {
  ETIQUETA_ESTADO_AVISO,
  situacionDelAviso,
  type EstadoRegistrado,
  type SituacionAviso,
} from "@/lib/gestionCobranza";
import { registrarAvisoCobranza, alternarBloqueoCliente } from "./actions";
import RespuestaAvisoFormulario from "./RespuestaAvisoFormulario";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

// Un compromiso incumplido es lo que hay que mirar primero; lo demás informa.
const COLOR_SITUACION: Record<SituacionAviso, string> = {
  COMPROMISO_INCUMPLIDO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  EN_DISPUTA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  SIN_RESPUESTA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  COMPROMISO_PAGO: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  PENDIENTE: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800",
};

function comoFechaInput(fecha: Date | null): string {
  if (!fecha) return "";
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export default async function CobranzaPage() {
  const usuario = await obtenerUsuario();
  if (
    !usuario ||
    (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA" && usuario.rol !== "VENTAS") ||
    !(await puedeRealizar(usuario, "finanzas", "ver"))
  ) {
    redirect("/");
  }

  const hoy = new Date();
  const empresaId = await obtenerEmpresaActivaId();

  const facturas = await prisma.factura.findMany({
    where: { empresaId, estado: "PENDIENTE", fechaVencimiento: { lt: hoy } },
    include: {
      cliente: true,
      avisosCobranza: { orderBy: { fecha: "desc" }, take: 1 },
    },
    orderBy: { fechaVencimiento: "asc" },
  });

  const vencidas = facturas.filter((f) => f.saldo.toNumber() > 1e-9);
  const totalVencido = vencidas.reduce((acc, f) => acc + f.saldo.toNumber(), 0);

  // La situación no se guarda: se deriva de la fecha comprometida, que se vence
  // sola con el calendario sin que nadie toque el aviso.
  const situaciones = new Map<string, SituacionAviso>();
  for (const factura of vencidas) {
    const aviso = factura.avisosCobranza[0];
    if (aviso) situaciones.set(aviso.id, situacionDelAviso(aviso, hoy));
  }
  const incumplidos = [...situaciones.values()].filter((s) => s === "COMPROMISO_INCUMPLIDO").length;

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
        . El seguimiento registra qué contestó el cliente; un compromiso de pago cuya fecha ya pasó
        con la factura todavía impaga se marca solo como incumplido.
      </p>

      {incumplidos > 0 && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {incumplidos} {incumplidos === 1 ? "compromiso de pago incumplido" : "compromisos de pago incumplidos"}:
          el cliente se comprometió a una fecha que ya pasó y la factura sigue impaga.
        </p>
      )}

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
            <th>Seguimiento</th>
            <th className="no-imprimir">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {vencidas.map((f) => {
            const dias = diasVencidos(f.fechaVencimiento, hoy);
            const nivel = nivelSugerido(dias);
            const ultimoAviso = f.avisosCobranza[0];
            const situacion: SituacionAviso | null = ultimoAviso
              ? situaciones.get(ultimoAviso.id) ?? (ultimoAviso.estado as SituacionAviso)
              : null;
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
                <td className="text-xs">
                  {ultimoAviso && situacion ? (
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`insignia ${COLOR_SITUACION[situacion]}`}>
                        {ETIQUETA_ESTADO_AVISO[situacion]}
                        {ultimoAviso.compromisoPagoEn &&
                          ` · ${ultimoAviso.compromisoPagoEn.toLocaleDateString("es-PE")}`}
                      </span>
                      {ultimoAviso.detalleRespuesta && (
                        <span style={{ color: "var(--epicor-texto-tenue)" }}>
                          {ultimoAviso.detalleRespuesta}
                        </span>
                      )}
                      <div className="no-imprimir">
                        <RespuestaAvisoFormulario
                          // La `key` incluye lo guardado: cuando el aviso
                          // cambia en base, el formulario se reinicia desde ahí.
                          // Sin esto el selector conserva lo último que alguien
                          // eligió en pantalla y puede quedar mostrando un
                          // estado distinto del que realmente se guardó.
                          key={`${ultimoAviso.id}-${ultimoAviso.estado}-${ultimoAviso.compromisoPagoEn?.getTime() ?? ""}`}
                          avisoId={ultimoAviso.id}
                          estadoActual={ultimoAviso.estado as EstadoRegistrado}
                          compromisoActual={comoFechaInput(ultimoAviso.compromisoPagoEn)}
                          detalleActual={ultimoAviso.detalleRespuesta ?? ""}
                        />
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "var(--epicor-texto-tenue)" }}>—</span>
                  )}
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
              <td colSpan={9} className="text-center text-neutral-500 py-6">
                No hay facturas vencidas pendientes de cobro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
