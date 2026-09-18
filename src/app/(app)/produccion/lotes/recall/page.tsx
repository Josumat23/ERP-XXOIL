import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";
import { ETIQUETA_ESTADO_LOTE } from "@/lib/etiquetas";
import BotonImprimir from "@/components/BotonImprimir";
import AlcanceDeLista from "@/components/AlcanceDeLista";
import { clientesPorAvisar, destinosDeLote, resumenDespacho } from "@/lib/despachoLote";
import { contactoPara } from "@/lib/contactosCliente";
import { lotesQueConsumieron, resumenTrazabilidadInsumo } from "@/lib/trazabilidadInsumo";
import { contiene } from "@/lib/busqueda";

/** Lo que hace falta de una línea de venta para saber cuánto salió y a quién. */
const SELECT_ASIGNACIONES_VENTA = {
  tipo: true,
  cantidad: true,
  pedidoDetalleId: true,
  facturaDetalleId: true,
  guiaDetalleId: true,
  pedidoDetalle: {
    select: { pedido: { select: { numero: true, cliente: { select: { id: true, razonSocial: true } } } } },
  },
  facturaDetalle: { select: { factura: { select: { numero: true } } } },
  guiaDetalle: {
    select: {
      facturaAsignaciones: {
        select: {
          facturaDetalle: { select: { factura: { select: { numero: true, estado: true } } } },
        },
      },
    },
  },
} as const;

// Vista de recall: dado un lote granel, agrega TODOS sus envasados y TODOS
// los clientes/facturas que recibieron unidades — de un vistazo, sin tener
// que entrar envasado por envasado (que es como se ve la trazabilidad en el
// detalle de cada Envasado).
export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{
    loteId?: string;
    recepcionId?: string;
    porLoteProveedor?: string;
    qLote?: string;
    qMaterial?: string;
  }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "produccion", "ver"))) redirect("/");

  const parametros = await searchParams;
  const { loteId, recepcionId, qLote, qMaterial } = parametros;
  // Ampliar el alcance a todas las recepciones del mismo lote del proveedor.
  const porLoteProveedor = parametros.porLoteProveedor === "1";
  const empresaId = usuario.empresaId;

  // Los dos selectores se acotan y se pueden buscar. Antes uno traía TODOS los
  // lotes de la historia y el otro las últimas 200 recepciones: con volumen
  // real, encontrar algo en una lista desplegable de miles es imposible, y el
  // día del recall es cuando menos tiempo hay.
  const TOPE_SELECTOR = 50;

  const [lotes, lotesTotales, recepciones, recepcionesTotales] = await Promise.all([
    prisma.loteGranel.findMany({
      where: {
        empresaId,
        ...(qLote
          ? {
              OR: [
                { codigo: contiene(qLote) },
                { formula: { producto: { nombre: contiene(qLote) } } },
              ],
            }
          : {}),
      },
      include: { formula: { include: { producto: true } } },
      orderBy: { fechaInicio: "desc" },
      take: TOPE_SELECTOR,
    }),
    prisma.loteGranel.count({ where: { empresaId } }),
    // Las recepciones que de verdad entraron en producción. Ofrecer las que
    // nunca se consumieron llenaría el selector de opciones que no contestan
    // nada.
    //
    // Se busca por código o nombre del insumo, por el número de recepción, y
    // por el LOTE DEL PROVEEDOR — que es el dato con el que llama el proveedor
    // cuando avisa de un problema, y el único que no se puede deducir de los
    // demás.
    prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        asignacionesLote: { some: {} },
        ...(qMaterial
          ? {
              OR: [
                { numeroLoteProveedor: contiene(qMaterial) },
                { insumo: { codigo: contiene(qMaterial) } },
                { insumo: { nombre: contiene(qMaterial) } },
                { recepcion: { numero: contiene(qMaterial) } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        insumo: { select: { codigo: true, nombre: true } },
        numeroLoteProveedor: true,
        recepcion: { select: { numero: true, fecha: true } },
      },
      orderBy: { recepcion: { fecha: "desc" } },
      take: TOPE_SELECTOR,
    }),
    prisma.recepcionCompraDetalle.count({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        asignacionesLote: { some: {} },
      },
    }),
  ]);

  const lote = loteId
    ? await prisma.loteGranel.findFirst({
        where: { id: loteId, empresaId: usuario.empresaId },
        include: {
          formula: { include: { producto: true } },
          envasados: {
            include: {
              presentacion: true,
              asignacionesLote: {
                include: {
                  pedidoDetalle: {
                    include: { pedido: { include: { cliente: true } } },
                  },
                  facturaDetalle: { include: { factura: true } },
                  guiaDetalle: {
                    include: {
                      facturaAsignaciones: {
                        include: { facturaDetalle: { include: { factura: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // La dirección de ida: de un material recibido a los clientes que lo tienen.
  // La ficha del lote ya contesta la de vuelta —de qué recepciones salió— y
  // faltaba esta, que es la del día que un proveedor avisa de un problema.
  const recepcion = recepcionId
    ? await prisma.recepcionCompraDetalle.findFirst({
        where: { id: recepcionId, recepcion: { ordenCompra: { empresaId } } },
        select: {
          id: true,
          cantidad: true,
          cantidadDisponible: true,
          numeroLoteProveedor: true,
          insumoId: true,
          insumo: { select: { codigo: true, nombre: true, unidadMedida: true } },
          recepcion: {
            select: {
              numero: true,
              fecha: true,
              ordenCompra: {
                select: { numero: true, proveedor: { select: { razonSocial: true } } },
              },
            },
          },
          asignacionesLote: {
            select: {
              cantidad: true,
              devolucionAsignacionLoteInsumos: { select: { cantidad: true } },
              loteGranel: {
                select: {
                  id: true,
                  codigo: true,
                  estado: true,
                  formula: { select: { producto: { select: { nombre: true } } } },
                  envasados: {
                    select: {
                      id: true,
                      codigo: true,
                      presentacion: { select: { nombre: true } },
                      asignacionesLote: { select: SELECT_ASIGNACIONES_VENTA },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // ---------------------------------------------------------------------
  // El mismo lote del proveedor puede haber llegado en varias recepciones.
  //
  // Consultar una sola devuelve la mitad de lo fabricado — y la devuelve con
  // cara de respuesta completa, que en un recall es el peor error posible:
  // quien lee concluye que el alcance es menor de lo que es.
  //
  // No se agrega en silencio: a veces la pregunta SÍ es por una entrega
  // puntual (llegó dañada, se descargó mal). Se avisa que hay hermanas y se
  // ofrece ampliar el alcance en un clic.
  // ---------------------------------------------------------------------
  const hermanas =
    recepcion?.numeroLoteProveedor && recepcionId
      ? await prisma.recepcionCompraDetalle.findMany({
          where: {
            recepcion: { ordenCompra: { empresaId } },
            insumoId: recepcion.insumoId,
            numeroLoteProveedor: recepcion.numeroLoteProveedor,
            id: { not: recepcionId },
          },
          select: {
            id: true,
            cantidad: true,
            cantidadDisponible: true,
            recepcion: { select: { numero: true } },
            asignacionesLote: {
              select: {
                cantidad: true,
                devolucionAsignacionLoteInsumos: { select: { cantidad: true } },
                loteGranel: {
                  select: {
                    id: true,
                    codigo: true,
                    estado: true,
                    formula: { select: { producto: { select: { nombre: true } } } },
                    envasados: {
                      select: {
                        id: true,
                        codigo: true,
                        presentacion: { select: { nombre: true } },
                        asignacionesLote: { select: SELECT_ASIGNACIONES_VENTA },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { recepcion: { fecha: "asc" } },
        })
      : [];

  // Las asignaciones que entran en la consulta: solo las de la recepción
  // elegida, o las de todas las del mismo lote del proveedor.
  const asignacionesEnAlcance = [
    ...(recepcion?.asignacionesLote ?? []),
    ...(porLoteProveedor ? hermanas.flatMap((h) => h.asignacionesLote) : []),
  ];

  // Las cantidades del encabezado tienen que cubrir el mismo alcance que la
  // tabla: decir «recibido 300 kg» encima de un consumo de 600 sería una
  // contradicción impresa.
  const recibidoEnAlcance =
    (recepcion?.cantidad.toNumber() ?? 0) +
    (porLoteProveedor ? hermanas.reduce((t, h) => t + h.cantidad.toNumber(), 0) : 0);
  const sinConsumirEnAlcance =
    (recepcion?.cantidadDisponible.toNumber() ?? 0) +
    (porLoteProveedor ? hermanas.reduce((t, h) => t + h.cantidadDisponible.toNumber(), 0) : 0);

  const consumos = recepcion
    ? lotesQueConsumieron(
        asignacionesEnAlcance.map((a) => ({
          loteGranelId: a.loteGranel.id,
          loteCodigo: a.loteGranel.codigo,
          productoNombre: a.loteGranel.formula.producto.nombre,
          estadoLote: a.loteGranel.estado,
          asignacion: {
            cantidad: a.cantidad.toNumber(),
            devoluciones: a.devolucionAsignacionLoteInsumos.map((d) => ({
              cantidad: d.cantidad.toNumber(),
            })),
          },
          destinos: destinosDeLote(a.loteGranel.envasados),
        }))
      )
    : [];
  const resumenInsumo = resumenTrazabilidadInsumo(consumos);

  // El neto vigente por línea de venta (ASIGNADA − LIBERADA) vive en su propio
  // módulo desde que una tercera pantalla lo necesitó: la de qué reensayar.
  const destinos = lote ? destinosDeLote(lote.envasados) : [];
  const { unidades: totalUnidadesVendidas, clientes: clientesUnicos } = resumenDespacho(destinos);

  // -------------------------------------------------------------------------
  // A quiénes hay que avisar.
  //
  // La pantalla contestaba «cuántos clientes» y «qué lotes», pero la lista de a
  // quién llamar había que armarla a mano: entrar lote por lote, anotar los
  // clientes y juntar los repetidos. Con tres lotes son tres pantallas y una
  // hoja aparte, el día que menos tiempo hay.
  //
  // Un lote fabricado con el material en cuestión está comprometido ENTERO: la
  // grasa no se des-mezcla. Por eso se cuentan todos los destinos de cada lote
  // alcanzado, no solo la parte proporcional al insumo sospechoso.
  //
  // Es una consulta y nada más. No registra a quién se avisó ni marca nada como
  // notificado: cómo se comunica un recall, quién lo firma y qué se le pide al
  // cliente son decisiones del negocio que nadie tomó.
  // -------------------------------------------------------------------------
  const porAvisar = clientesPorAvisar(
    recepcion ? consumos.flatMap((c) => c.destinos) : destinos
  );
  // Qué alcance cubre esta lista, dicho con todas las letras.
  //
  // Con un lote Y un material elegidos hay DOS listas de clientes en la misma
  // pantalla —la del lote, arriba, y esta— con números distintos. Sin decir
  // cuál es cuál, quien lee elige a cuál creerle; es el mismo defecto que ya
  // apareció con el encabezado del recall y con el estado vacío de la búsqueda.
  const alcanceDelAviso = recepcion
    ? `${recepcion.insumo.codigo}${
        recepcion.numeroLoteProveedor ? ` · lote del proveedor ${recepcion.numeroLoteProveedor}` : ""
      }, ${
        porLoteProveedor && hermanas.length > 0
          ? `${hermanas.length + 1} recepciones`
          : recepcion.recepcion.numero
      }`
    : lote
      ? `lote ${lote.codigo}`
      : "";
  const clientesConContacto =
    porAvisar.length === 0
      ? []
      : await prisma.cliente.findMany({
          // Acotado a la compañía: los ids salen de la cadena comercial, pero
          // volver a pedirlos sin filtro sería confiar en el camino.
          where: { id: { in: porAvisar.map((c) => c.clienteId) }, empresaId },
          select: {
            id: true,
            telefono: true,
            email: true,
            contactos: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                cargo: true,
                telefono: true,
                celular: true,
                email: true,
                activo: true,
                esPrincipal: true,
                paraPedidos: true,
                paraFacturacion: true,
                paraCobranza: true,
                paraDespacho: true,
              },
            },
          },
        });
  const contactoDelCliente = new Map(
    clientesConContacto.map((c) => {
      // No hay un propósito «calidad» ni «recall» declarado en el maestro y no
      // se inventa uno: se usa el de DESPACHO, que es quien atiende la
      // mercadería, y `contactoPara` cae en el principal si nadie lo atiende.
      const elegido = contactoPara(c.contactos, "DESPACHO");
      const contacto = c.contactos.find((x) => x.id === elegido) ?? null;
      return [
        c.id,
        {
          contacto,
          telefonoEmpresa: c.telefono,
          emailEmpresa: c.email,
        },
      ];
    })
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Trazabilidad / recall
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        La cadena en las dos direcciones. Desde un <strong>lote granel</strong>: todos sus envasados
        y todos los clientes que recibieron unidades. Desde un <strong>material recibido</strong>:
        qué lotes se fabricaron con él y hasta dónde llegaron.
      </p>

      <form method="get" className="mt-5 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Filtrar lotes
          </span>
          <input
            type="search"
            name="qLote"
            defaultValue={qLote ?? ""}
            placeholder="Código de lote o producto"
            className="campo-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Lote granel</span>
          <select name="loteId" defaultValue={loteId ?? ""} className="campo-input min-w-72">
            <option value="" disabled>
              Seleccione
            </option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} — {l.formula.producto.nombre} ({ETIQUETA_ESTADO_LOTE[l.estado]})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton-secundario">
          Buscar
        </button>
      </form>
      <AlcanceDeLista
        mostrados={lotes.length}
        totales={lotesTotales}
        tope={TOPE_SELECTOR}
        busqueda={qLote}
        queBusca="lotes"
      />

      {lote && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Dato etiqueta="Envasados de este lote" valor={String(lote.envasados.length)} />
            <Dato etiqueta="Unidades vendidas vigentes" valor={formatNumero(totalUnidadesVendidas, 0)} />
            <Dato etiqueta="Clientes distintos afectados" valor={String(clientesUnicos)} />
            <Dato etiqueta="Estado del lote" valor={ETIQUETA_ESTADO_LOTE[lote.estado]} />
          </div>

          <table className="tabla mt-6">
            <thead>
              <tr>
                <th>Envasado</th>
                <th>Presentación</th>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Factura</th>
                <th className="text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((d, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs">
                    <Link href={`/produccion/envasados/${d.envasadoId}`} className="hover:underline">
                      {d.envasadoCodigo}
                    </Link>
                  </td>
                  <td className="text-sm text-neutral-500">{d.presentacionNombre}</td>
                  <td>{d.clienteNombre}</td>
                  <td className="font-mono text-xs">{d.pedidoNumero}</td>
                  <td className="font-mono text-xs">{d.facturaNumero ?? "—"}</td>
                  <td className="text-right">{d.cantidad}</td>
                </tr>
              ))}
              {destinos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-500 py-6">
                    Este lote todavía no tiene unidades vendidas vigentes en ningún cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/*
        La dirección de ida. Va en esta misma pantalla y no en una nueva porque
        es la misma pregunta —«¿a quién le llegó esto?»— entrando por el otro
        extremo de la cadena.
      */}
      <section className="mt-10 border-t border-black/10 dark:border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Desde un material recibido
        </h2>
        <p className="text-neutral-500 text-sm mt-1">
          Qué lotes se fabricaron con una recepción de compra y hasta dónde llegó cada uno. Es la
          consulta del día que un proveedor avisa de un problema con su material.
        </p>

        <form method="get" className="mt-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Filtrar materiales
            </span>
            <input
              type="search"
              name="qMaterial"
              defaultValue={qMaterial ?? ""}
              placeholder="Insumo, recepción o lote del proveedor"
              className="campo-input min-w-64"
            />
            <span className="text-xs text-neutral-500">
              El lote del proveedor es el dato con el que llama quien reporta el problema.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Material recibido
            </span>
            <select name="recepcionId" defaultValue={recepcionId ?? ""} className="campo-input min-w-96">
              <option value="" disabled>
                Seleccione
              </option>
              {recepciones.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.recepcion.numero} · {r.insumo.codigo} — {r.insumo.nombre}
                  {r.numeroLoteProveedor ? ` · lote ${r.numeroLoteProveedor}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton-secundario">
            Buscar
          </button>
        </form>
        <AlcanceDeLista
          mostrados={recepciones.length}
          totales={recepcionesTotales}
          tope={TOPE_SELECTOR}
          busqueda={qMaterial}
          queBusca="materiales consumidos"
        />

        {/*
          Solo cuando de verdad no hay ninguna, no cuando la búsqueda no
          encontró: con el filtro puesto, este texto contradecía al de arriba
          —«ningún resultado para X entre los 3 materiales»— y dejaba al lector
          eligiendo a cuál de los dos creerle.
        */}
        {recepcionesTotales === 0 && (
          <p className="text-sm text-neutral-500 mt-3">
            Todavía no hay recepciones consumidas en producción. Solo se listan las que ya entraron
            en algún lote: las demás no tienen nada que rastrear.
          </p>
        )}

        {recepcion && (
          <>
            <p className="text-sm text-neutral-500 mt-5">
              {recepcion.insumo.codigo} — {recepcion.insumo.nombre} · recepción{" "}
              {recepcion.recepcion.numero} ({recepcion.recepcion.ordenCompra.numero}) de{" "}
              {recepcion.recepcion.ordenCompra.proveedor.razonSocial}
              {recepcion.numeroLoteProveedor
                ? ` · lote del proveedor ${recepcion.numeroLoteProveedor}`
                : ""}
            </p>

            {/*
              El aviso que evita la respuesta incompleta con cara de completa.
              No se agrega solo: a veces la pregunta SÍ es por una entrega
              puntual —llegó dañada, se descargó mal— y ampliar el alcance por
              nuestra cuenta contestaría otra cosa.
            */}
            {hermanas.length > 0 && (
              <p
                className={`text-sm mt-3 rounded-md border px-3 py-2 ${
                  porLoteProveedor
                    ? "border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900"
                    : "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                }`}
              >
                {porLoteProveedor ? (
                  <>
                    Alcance ampliado: el lote del proveedor{" "}
                    <strong>{recepcion.numeroLoteProveedor}</strong> llegó en{" "}
                    {hermanas.length + 1} recepciones y esta consulta las cubre todas (
                    {[recepcion.recepcion.numero, ...hermanas.map((h) => h.recepcion.numero)].join(
                      ", "
                    )}
                    ).{" "}
                    <Link
                      href={`/produccion/lotes/recall?recepcionId=${recepcion.id}`}
                      className="hover:underline text-blue-700 dark:text-blue-400"
                    >
                      Ver solo {recepcion.recepcion.numero}
                    </Link>
                  </>
                ) : (
                  <>
                    El lote del proveedor <strong>{recepcion.numeroLoteProveedor}</strong> también
                    llegó en {hermanas.map((h) => h.recepcion.numero).join(", ")}. Esta consulta
                    cubre solo {recepcion.recepcion.numero}.{" "}
                    <Link
                      href={`/produccion/lotes/recall?recepcionId=${recepcion.id}&porLoteProveedor=1`}
                      className="hover:underline font-medium"
                    >
                      Ver todo el lote del proveedor
                    </Link>
                  </>
                )}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <Dato
                etiqueta={porLoteProveedor ? "Recibido (todo el lote)" : "Recibido"}
                valor={`${formatNumero(recibidoEnAlcance, 3)} ${recepcion.insumo.unidadMedida}`}
              />
              <Dato
                etiqueta={porLoteProveedor ? "Sin consumir (todo el lote)" : "Sin consumir"}
                valor={`${formatNumero(sinConsumirEnAlcance, 3)} ${recepcion.insumo.unidadMedida}`}
              />
              <Dato etiqueta="Lotes fabricados" valor={String(resumenInsumo.lotes)} />
              <Dato
                etiqueta="Clientes alcanzados"
                valor={String(resumenInsumo.clientesAfectados)}
              />
            </div>

            {consumos.length === 0 ? (
              <p className="text-sm text-neutral-500 mt-4">
                Este material no entró en ningún lote todavía. Si se recibió y está en almacén, no
                hay nada fabricado que rastrear.
              </p>
            ) : (
              <table className="tabla mt-5">
                <thead>
                  <tr>
                    <th>Lote fabricado</th>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th className="text-right">Material usado</th>
                    <th>Hasta dónde llegó</th>
                  </tr>
                </thead>
                <tbody>
                  {consumos.map((c) => {
                    const salida = resumenDespacho(c.destinos);
                    return (
                      <tr key={c.loteGranelId}>
                        <td className="font-medium align-top">
                          <Link
                            href={`/produccion/lotes/${c.loteGranelId}`}
                            className="hover:underline"
                          >
                            {c.loteCodigo}
                          </Link>
                        </td>
                        <td className="align-top">{c.productoNombre}</td>
                        <td className="align-top text-sm">
                          {ETIQUETA_ESTADO_LOTE[c.estadoLote as keyof typeof ETIQUETA_ESTADO_LOTE] ??
                            c.estadoLote}
                        </td>
                        <td className="align-top text-right">
                          {formatNumero(c.cantidadConsumida, 3)} {recepcion.insumo.unidadMedida}
                        </td>
                        <td className="align-top">
                          {salida.unidades > 0 ? (
                            <>
                              <span className="text-red-700 dark:text-red-400 font-medium">
                                {formatNumero(salida.unidades, 0)} unidades en{" "}
                                {salida.clientes === 1 ? "1 cliente" : `${salida.clientes} clientes`}
                              </span>
                              {" · "}
                              {/*
                                El alcance del material viaja con el enlace: sin
                                eso, mirar el detalle de un lote hacía perder la
                                consulta y había que volver a armarla.
                              */}
                              <Link
                                href={`/produccion/lotes/recall?loteId=${c.loteGranelId}&recepcionId=${recepcion.id}${
                                  porLoteProveedor ? "&porLoteProveedor=1" : ""
                                }`}
                                className="hover:underline text-blue-700 dark:text-blue-400"
                              >
                                ver a quiénes
                              </Link>
                            </>
                          ) : (
                            <span className="text-neutral-500">No salió a ningún cliente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {/*
        A quiénes hay que avisar.
        =========================
        La lista que se arma a mano el día del recall: un renglón por cliente,
        con todo lo que tiene y con quién atenderlo. Va al final porque se lee
        después de haber decidido el alcance, y sale en la impresión.
      */}
      {porAvisar.length > 0 && (
        <section className="mt-10 border-t border-black/10 dark:border-white/10 pt-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            A quiénes hay que avisar
          </h2>
          <p className="text-neutral-500 text-sm mt-1">
            Alcance de esta lista: <strong>{alcanceDelAviso}</strong>.{" "}
            {porAvisar.length === 1 ? "1 cliente tiene" : `${porAvisar.length} clientes tienen`}{" "}
            {formatNumero(
              porAvisar.reduce((t, c) => t + c.unidades, 0),
              0
            )}{" "}
            unidades, ordenados por cuánto tiene cada uno.
            {recepcion && lote && (
              <span className="block mt-1">
                La tabla de arriba es del lote {lote.codigo} solamente; esta cubre todo lo
                fabricado con el material.
              </span>
            )}
          </p>

          <table className="tabla mt-4">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Unidades</th>
                <th>Qué tiene</th>
                <th>Documentos</th>
                <th>A quién llamar</th>
              </tr>
            </thead>
            <tbody>
              {porAvisar.map((c) => {
                const datos = contactoDelCliente.get(c.clienteId);
                const contacto = datos?.contacto ?? null;
                const canales = [
                  contacto?.celular,
                  contacto?.telefono,
                  contacto?.email,
                  // Los del cliente son el último recurso: son de la empresa,
                  // no de una persona.
                  datos?.telefonoEmpresa,
                  datos?.emailEmpresa,
                ].filter(Boolean);
                return (
                  <tr key={c.clienteId}>
                    <td className="font-medium align-top">
                      <Link href={`/comercial/clientes/${c.clienteId}`} className="hover:underline">
                        {c.clienteNombre}
                      </Link>
                    </td>
                    <td className="align-top text-right font-medium">
                      {formatNumero(c.unidades, 0)}
                    </td>
                    <td className="align-top text-sm">
                      {c.envasados.map((e) => (
                        <span key={e.codigo} className="block">
                          <span className="font-mono text-xs">{e.codigo}</span> · {e.presentacion} ×{" "}
                          {formatNumero(e.cantidad, 0)}
                        </span>
                      ))}
                    </td>
                    <td className="align-top text-sm">
                      <span className="block font-mono text-xs">{c.pedidos.join(", ")}</span>
                      {c.facturas.length > 0 ? (
                        <span className="block font-mono text-xs">{c.facturas.join(", ")}</span>
                      ) : (
                        <span className="text-neutral-500 text-xs">Sin factura vigente</span>
                      )}
                    </td>
                    <td className="align-top text-sm">
                      {contacto ? (
                        <>
                          <span className="block">
                            {[contacto.nombres, contacto.apellidos].filter(Boolean).join(" ")}
                            {contacto.cargo && (
                              <span className="text-neutral-500"> — {contacto.cargo}</span>
                            )}
                          </span>
                          {canales.length > 0 ? (
                            <span className="block text-xs text-neutral-500">
                              {canales.join(" · ")}
                            </span>
                          ) : (
                            <span className="block text-xs text-amber-700 dark:text-amber-500">
                              Sin teléfono ni correo cargados
                            </span>
                          )}
                        </>
                      ) : canales.length > 0 ? (
                        <>
                          <span className="block text-neutral-500">Sin contacto designado</span>
                          <span className="block text-xs text-neutral-500">
                            {canales.join(" · ")}
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-500">
                          Sin contacto ni datos de la empresa
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-xs text-neutral-500">
            Un lote fabricado con el material en cuestión está comprometido entero: se listan todas
            las unidades de cada lote alcanzado, no una parte proporcional. El contacto es el de
            <strong> despacho</strong> —quien atiende la mercadería— y, si nadie está designado
            para eso, el principal del cliente. Esta pantalla no registra a quién se avisó.
          </p>
        </section>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{valor}</p>
    </div>
  );
}
