import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda } from "@/lib/format";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import { arbolUbigeos } from "@/lib/ubigeosCatalogo";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { formatFecha } from "@/lib/format";
import ClienteFormulario from "../ClienteFormulario";
import { actualizarCliente, aprobarCambioLimiteCredito } from "../actions";
import ResolverLimiteFormulario from "./ResolverLimiteFormulario";
import DireccionesCliente from "./DireccionesCliente";
import ContactosCliente from "./ContactosCliente";
import { propositosSinContacto } from "@/lib/contactosCliente";
import { depositoComprometido, saldoCascos } from "@/lib/logisticaCliente";
import { tiposFaltantes } from "@/lib/direccionesCliente";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();

  const [cliente, clientes, zonas, vendedores, facturasPendientes, arbol, config, movimientosCasco, solicitudes] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id, empresaId },
      include: {
        ubigeo: true,
        direcciones: {
          include: { ubigeo: true },
          orderBy: [{ activa: "desc" }, { tipo: "asc" }, { creadoEn: "asc" }],
        },
        contactos: {
          orderBy: [{ activo: "desc" }, { esPrincipal: "desc" }, { nombres: "asc" }],
        },
      },
    }),
    prisma.cliente.findMany({ where: { empresaId }, orderBy: { razonSocial: "asc" } }),
    prisma.zona.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    // select explícito: el formulario es un componente cliente y una fila
    // completa le mandaría `tasaComision` como Decimal de Prisma, que React no
    // sabe serializar — avisa en consola y no es un valor que el cliente use.
    prisma.vendedor.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.factura.findMany({ where: { clienteId: id, empresaId, estado: "PENDIENTE" } }),
    arbolUbigeos(),
    obtenerConfiguracionEmpresa(empresaId),
    prisma.movimientoCasco.findMany({
      where: { clienteId: id, empresaId },
      include: { insumo: { select: { id: true, nombre: true, montoDeposito: true } } },
    }),
    prisma.solicitudCambioCredito.findMany({
      where: { clienteId: id, empresaId },
      orderBy: { solicitadoEn: "desc" },
      take: 10,
    }),
  ]);
  if (!perteneceAEmpresaActiva(cliente, empresaId)) notFound();

  const saldosCasco = saldoCascos(movimientosCasco);
  const insumosCasco: Record<string, string> = Object.fromEntries(
    movimientosCasco.map((m) => [m.insumo.id, m.insumo.nombre])
  );
  const depositoPorInsumo: Record<string, number> = Object.fromEntries(
    movimientosCasco.map((m) => [m.insumo.id, m.insumo.montoDeposito?.toNumber() ?? 0])
  );

  const pendiente = solicitudes.find((s) => s.estado === "PENDIENTE") ?? null;
  // Editar direcciones es editar el maestro: mismo permiso que el resto de
  // la ficha, no el de aprobar.
  const puedeEditar = await puedeRealizar(usuario, "ventas", "editar");

  const puedeResolverLimite =
    (usuario.rol === "GERENCIA" || usuario.rol === "ADMIN") &&
    (await puedeRealizar(usuario, "ventas", "aprobar"));

  const deudaActual = facturasPendientes.reduce((acc, f) => acc + f.saldo.toNumber(), 0);
  const limite = cliente.limiteCredito?.toNumber() ?? null;

  return (
    <div>
      <Link href="/comercial/clientes" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a clientes
      </Link>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          {cliente.razonSocial}
        </h1>
        <span className="font-mono text-xs text-neutral-400">{cliente.codigo}</span>
      </div>
      <p className="text-neutral-500 mt-1 text-sm">
        Deuda actual: <span className="font-medium">{formatMoneda(deudaActual)}</span>
        {limite === 0 && (
          <>
            {" "}·{" "}
            <span className="font-medium text-amber-700 dark:text-amber-400">Sin crédito</span>{" "}
            (solo contado, hasta que Créditos lo evalúe)
          </>
        )}
        {limite === null && (
          <>
            {" "}·{" "}
            <span className="font-medium text-amber-700 dark:text-amber-400">Sin tope</span>{" "}
            (heredado, nunca evaluado)
          </>
        )}
        {limite !== null && limite > 0 && (
          <>
            {" "}
            · Límite de crédito: <span className="font-medium">{formatMoneda(limite)}</span> ·
            Disponible:{" "}
            <span
              className={`font-medium ${
                limite - deudaActual <= 0 ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {formatMoneda(Math.max(0, limite - deudaActual))}
            </span>
          </>
        )}
      </p>

      <div className="mt-4">
        <PanelMaestroDetalle
          seleccionadoId={id}
          nuevoHref="/comercial/clientes/nuevo"
          nuevoTexto="Nuevo cliente"
          registros={clientes.map((c) => ({
            id: c.id,
            href: `/comercial/clientes/${c.id}`,
            primario: c.razonSocial,
            secundario: c.codigo,
          }))}
        >
        <div className="max-w-2xl flex flex-col gap-6">
          {pendiente && (
            <section className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
              <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
                Aumento del límite pendiente de aprobación
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                De {pendiente.limiteAnterior === null ? "sin tope" : formatMoneda(pendiente.limiteAnterior)} a{" "}
                {formatMoneda(pendiente.limiteSolicitado)}, pedido por {pendiente.solicitadoPorNombre}{" "}
                el {formatFecha(pendiente.solicitadoEn)}. El límite vigente sigue siendo{" "}
                {limite === null ? "sin tope" : formatMoneda(limite)}.
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2">
                <span className="font-medium">Motivo:</span> {pendiente.motivo}
              </p>
              {puedeResolverLimite ? (
                <div className="flex flex-col gap-3 mt-4">
                  <form action={async () => { "use server"; await aprobarCambioLimiteCredito(pendiente.id); }}>
                    <button type="submit" className="boton-primario text-sm">Aprobar aumento</button>
                  </form>
                  <ResolverLimiteFormulario solicitudId={pendiente.id} />
                </div>
              ) : (
                <p className="text-xs text-neutral-500 mt-3">
                  Solo Gerencia o un Administrador con permiso de aprobación de Ventas puede resolverlo.
                </p>
              )}
            </section>
          )}
          <ClienteFormulario
            accion={actualizarCliente.bind(null, id)}
            zonas={zonas}
            vendedores={vendedores}
            arbolUbigeos={arbol}
            ubigeoSeleccionado={cliente.ubigeo}
            umbralAprobacionCredito={config.montoAprobacionCredito?.toNumber() ?? null}
            valoresIniciales={{
              razonSocial: cliente.razonSocial,
              nombreComercial: cliente.nombreComercial,
              tipoDocumentoFiscal: cliente.tipoDocumentoFiscal,
              ruc: cliente.ruc,
              pais: cliente.pais,
              canal: cliente.canal,
              departamento: cliente.departamento,
              provincia: cliente.provincia,
              distrito: cliente.distrito,
              direccion: cliente.direccion,
              telefono: cliente.telefono,
              email: cliente.email,
              contactoNombre: cliente.contactoNombre,
              contactoTelefono: cliente.contactoTelefono,
              zonaId: cliente.zonaId,
              vendedorId: cliente.vendedorId,
              limiteCredito: cliente.limiteCredito?.toNumber() ?? null,
              condicionPagoDefecto: cliente.condicionPagoDefecto,
              notas: cliente.notas,
            }}
            textoBoton="Guardar cambios"
          />
          <DireccionesCliente
            clienteId={cliente.id}
            direcciones={cliente.direcciones.map((d) => ({
              ...d,
              // Decimal de Prisma no cruza a un componente cliente: se manda
              // como texto y se muestra tal cual, sin redondear una coordenada.
              latitud: d.latitud?.toString() ?? null,
              longitud: d.longitud?.toString() ?? null,
            }))}
            arbol={arbol}
            faltantes={tiposFaltantes(cliente.direcciones)}
            puedeEditar={puedeEditar}
          />
          <ContactosCliente
            clienteId={cliente.id}
            contactos={cliente.contactos}
            sinAtender={propositosSinContacto(cliente.contactos)}
            puedeEditar={puedeEditar}
          />
          <PanelAdjuntos
            entidadTipo="Cliente"
            entidadId={cliente.id}
            rutaRevalidar={`/comercial/clientes/${cliente.id}`}
          />
          {saldosCasco.length > 0 && (
            <section className="borde-seccion">
              <h2 className="titulo-seccion">Envases retornables en poder del cliente</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Calculado desde los movimientos de casco, no guardado en la ficha: un saldo
                anotado se desincroniza y este no puede.
              </p>
              <table className="tabla mt-2">
                <thead>
                  <tr>
                    <th>Envase</th>
                    <th className="text-right">Pendientes</th>
                    <th className="text-right">Depósito comprometido</th>
                  </tr>
                </thead>
                <tbody>
                  {saldosCasco.map((s) => {
                    const insumo = insumosCasco[s.insumoId];
                    const deposito = depositoPorInsumo[s.insumoId] ?? 0;
                    return (
                      <tr key={s.insumoId}>
                        <td>{insumo ?? s.insumoId}</td>
                        <td
                          className={`text-right ${s.pendientes < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                        >
                          {s.pendientes}
                          {s.pendientes < 0 && " (revisar: más devoluciones que entregas)"}
                        </td>
                        <td className="text-right">
                          {formatMoneda(Math.max(0, s.pendientes) * deposito)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-sm">
                Depósito total comprometido:{" "}
                <span className="font-medium">
                  {formatMoneda(depositoComprometido(saldosCasco, depositoPorInsumo))}
                </span>
              </p>
            </section>
          )}

          {solicitudes.some((s) => s.estado !== "PENDIENTE") && (
            <section className="borde-seccion">
              <h2 className="titulo-seccion">Historial de límites de crédito</h2>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Solicitado</th>
                      <th className="text-right">De</th>
                      <th className="text-right">A</th>
                      <th>Estado</th>
                      <th>Resuelto por</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes
                      .filter((s) => s.estado !== "PENDIENTE")
                      .map((s) => (
                        <tr key={s.id}>
                          <td>{formatFecha(s.solicitadoEn)}</td>
                          <td className="text-right">
                            {s.limiteAnterior === null ? "Sin tope" : formatMoneda(s.limiteAnterior)}
                          </td>
                          <td className="text-right">{formatMoneda(s.limiteSolicitado)}</td>
                          <td>{s.estado === "APROBADA" ? "Aprobado" : "Rechazado"}</td>
                          <td>{s.resueltoPorNombre ?? "—"}</td>
                          <td className="text-xs">{s.motivoResolucion ?? s.motivo}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        </PanelMaestroDetalle>
      </div>
    </div>
  );
}
