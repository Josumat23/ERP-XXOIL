// ---------------------------------------------------------------------------
// ¿La base recién sembrada trae los casos que las pantallas contestan?
//
// Una demo puede estar «cargada» y no mostrar nada: si ningún lote del
// proveedor llegó en dos recepciones, la pantalla de recall funciona pero su
// aviso de alcance ampliado no aparece nunca, y quien estrena el sistema
// concluye que la función no está.
//
// Esto corre dentro de `npm run semillas:desde-cero`, contra la base efímera
// que ese script crea y destruye. No mira `erp_dev`.
// ---------------------------------------------------------------------------
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import { revisarReensayos } from "../src/lib/reensayosConsulta";

const prisma = new PrismaClient({ adapter: crearAdaptador() });
const EMPRESA_ID = "1";

const fallas: string[] = [];
const comprobar = (condicion: boolean, queFalta: string) => {
  console.log(`  ${condicion ? "✔" : "✖"} ${queFalta}`);
  if (!condicion) fallas.push(queFalta);
};

async function main() {
  console.log("\nCasos que la demo tiene que traer:\n");

  // --- Recall por lote del proveedor ---------------------------------------
  const recepciones = await prisma.recepcionCompraDetalle.findMany({
    where: { recepcion: { ordenCompra: { empresaId: EMPRESA_ID } } },
    select: {
      cantidad: true,
      cantidadDisponible: true,
      numeroLoteProveedor: true,
      insumo: { select: { codigo: true, tipo: true } },
      recepcion: { select: { numero: true } },
      _count: { select: { asignacionesLote: true } },
    },
  });

  const materiaPrima = recepciones.filter((r) => r.insumo.tipo === "MATERIA_PRIMA");
  comprobar(
    materiaPrima.length > 0 && materiaPrima.every((r) => Boolean(r.numeroLoteProveedor)),
    "toda recepción de materia prima trae el número de lote del proveedor"
  );

  const porLote = new Map<string, typeof recepciones>();
  for (const r of recepciones) {
    if (!r.numeroLoteProveedor) continue;
    const clave = `${r.insumo.codigo}|${r.numeroLoteProveedor}`;
    porLote.set(clave, [...(porLote.get(clave) ?? []), r]);
  }
  const repartidos = [...porLote.entries()].filter(([, rs]) => rs.length >= 2);
  comprobar(
    repartidos.length > 0,
    "algún lote del proveedor llegó en más de una recepción (el aviso de alcance ampliado)"
  );
  for (const [clave, rs] of repartidos) {
    const recibido = rs.reduce((t, r) => t + r.cantidad.toNumber(), 0);
    const disponible = rs.reduce((t, r) => t + r.cantidadDisponible.toNumber(), 0);
    console.log(
      `      ${clave}: ${rs.map((r) => r.recepcion.numero).join(" + ")} — recibido ${recibido}, sin consumir ${disponible}`
    );
    comprobar(
      rs.some((r) => r._count.asignacionesLote > 0),
      `  ${clave}: alguna de sus entregas se consumió en producción`
    );
    comprobar(
      disponible > 0,
      `  ${clave}: queda material sin consumir (el dato accionable del recall)`
    );
  }

  // --- El tanque con mezcla -------------------------------------------------
  // Lo que distingue a este módulo es repartir el consumo en proporción entre
  // los lotes mezclados, en vez de obligar a elegir uno. Con un solo lote en el
  // tanque eso no se puede ver.
  const tanques = await prisma.tanque.findMany({
    where: { empresaId: EMPRESA_ID },
    select: {
      codigo: true,
      contenidoKg: true,
      aportes: { where: { cantidadKg: { gt: 0 } }, select: { cantidadKg: true } },
    },
  });
  comprobar(tanques.length > 0, "hay algún tanque cargado");
  const conMezcla = tanques.filter((t) => t.aportes.length >= 2);
  comprobar(
    conMezcla.length > 0,
    "algún tanque tiene dos o más lotes mezclados (el reparto proporcional)"
  );
  for (const t of conMezcla) {
    console.log(`      ${t.codigo}: ${t.contenidoKg} kg de ${t.aportes.length} recepciones`);
  }

  // --- A quiénes hay que avisar --------------------------------------------
  const clientesSinContacto = await prisma.cliente.count({
    where: { empresaId: EMPRESA_ID, contactos: { none: {} } },
  });
  comprobar(clientesSinContacto === 0, "todos los clientes tienen a quién llamar");

  // --- Del reclamo al lote --------------------------------------------------
  const reclamoConFactura = await prisma.reclamoCliente.findFirst({
    where: { empresaId: EMPRESA_ID, facturaId: { not: null } },
    select: { numero: true, factura: { select: { numero: true } } },
  });
  comprobar(Boolean(reclamoConFactura), "hay un reclamo con factura, para derivar el lote");

  // --- Laboratorio ----------------------------------------------------------
  const instrumentos = await prisma.instrumentoMedicion.count({ where: { empresaId: EMPRESA_ID } });
  comprobar(instrumentos > 0, "hay instrumentos de medición cargados");
  const medicionesConInstrumento = await prisma.resultadoCaracteristicaCalidad.count({
    where: { instrumentoId: { not: null }, controlCalidad: { loteGranel: { empresaId: EMPRESA_ID } } },
  });
  comprobar(medicionesConInstrumento > 0, "algún ensayo declara con qué instrumento se midió");

  const certificables = await prisma.loteGranel.count({
    where: {
      empresaId: EMPRESA_ID,
      controlCalidad: { resultado: "APROBADO", resultadosCaracteristica: { some: {} } },
    },
  });
  comprobar(certificables > 0, "algún lote puede emitir su certificado de análisis");

  // «Qué hay que reensayar» sale de una derivación, no de un campo guardado:
  // afirmar que la demo trae el caso sin ejecutarla sería suponerlo.
  const revision = await revisarReensayos(EMPRESA_ID);
  comprobar(
    revision.items.length > 0,
    "«Qué hay que reensayar» tiene algo que decir (ensayos sin respaldo de calibración)"
  );
  const despachados = revision.items.filter((i) => i.destino === "DESPACHADO").length;
  console.log(
    `      ${revision.items.length} ensayo(s) a revisar, ${despachados} ya en poder del cliente, ` +
      `de ${revision.medicionesEvaluadas} medición(es) evaluadas`
  );
  comprobar(
    despachados > 0,
    "alguno de esos ensayos ya salió al cliente (el caso urgente de la pantalla)"
  );

  // --- RRHH -----------------------------------------------------------------
  const empleados = await prisma.empleado.count({ where: { empresaId: EMPRESA_ID } });
  comprobar(empleados > 0, "hay empleados cargados");
  const cesados = await prisma.empleado.count({
    where: { empresaId: EMPRESA_ID, estado: "CESADO" },
  });
  comprobar(cesados > 0, "hay algún cesado (rotación y headcount no son una línea plana)");
  const conJefe = await prisma.empleado.count({
    where: { empresaId: EMPRESA_ID, jefeDirectoId: { not: null } },
  });
  comprobar(conJefe > 0, "hay jefaturas declaradas (el organigrama tiene forma de árbol)");

  const periodo = await prisma.planillaPeriodo.findFirst({
    where: { empresaId: EMPRESA_ID },
    select: { anio: true, mes: true, _count: { select: { detalles: true } } },
  });
  comprobar(Boolean(periodo && periodo._count.detalles > 0), "hay una planilla corrida con detalle");
  if (periodo) {
    console.log(`      planilla ${periodo.mes}/${periodo.anio} con ${periodo._count.detalles} boleta(s)`);
  }

  // El caso que el propio módulo documenta: sin sistema de pensión declarado,
  // el empleado queda FUERA de la corrida con una advertencia visible. Sin un
  // caso así en la demo, esa advertencia no se ve nunca.
  const sinPension = await prisma.empleado.count({
    where: {
      empresaId: EMPRESA_ID,
      estado: "ACTIVO",
      sistemaPension: null,
      tipoContrato: { not: "LOCACION_SERVICIOS" },
    },
  });
  comprobar(sinPension > 0, "hay un activo sin sistema de pensión (la advertencia de la corrida)");

  const posicionVacante = await prisma.posicionOrganizativa.count({
    where: { empresaId: EMPRESA_ID, asignaciones: { none: {} } },
  });
  comprobar(posicionVacante > 0, "hay una posición vacante (existe sin nadie que la ocupe)");

  const parametro = await prisma.parametroPlanilla.findFirst({ where: { empresaId: EMPRESA_ID } });
  comprobar(Boolean(parametro), "hay parámetros de planilla (RMV/UIT) para que el cálculo corra");

  // --- Los dos caminos de la trazabilidad de venta --------------------------
  // El lote puede quedar colgado del renglón de la FACTURA —venta que factura y
  // despacha en el mismo acto— o del de la GUÍA, cuando el pedido requiere
  // entrega. La segunda rama es la que «de qué lote salió» recorre ante un
  // reclamo sobre una entrega, y no la ejercitaba ningún dato.
  const porFactura = await prisma.asignacionLoteVenta.count({
    where: { facturaDetalleId: { not: null }, envasado: { empresaId: EMPRESA_ID } },
  });
  const porGuia = await prisma.asignacionLoteVenta.count({
    where: { guiaDetalleId: { not: null }, envasado: { empresaId: EMPRESA_ID } },
  });
  console.log(`      asignaciones de lote: ${porFactura} por factura, ${porGuia} por guía`);
  comprobar(porFactura > 0, "hay ventas con el lote colgado del renglón de la factura");
  comprobar(porGuia > 0, "hay una entrega con el lote colgado del renglón de la guía");

  // Y el puente entre las dos: sin él, la factura no llega al lote que salió
  // por la guía.
  const puentes = await prisma.facturaDetalleEntrega.count();
  comprobar(puentes > 0, "la factura de esa entrega está atada a su guía");

  // La reserva es transitoria: se toma al pedir y se libera al despachar. Una
  // reserva que sobrevive al despacho bloquea stock que sí está disponible, y
  // nadie la ve — el saldo simplemente «no alcanza» sin explicación.
  const reservasColgadas = await prisma.presentacion.findMany({
    where: { empresaId: EMPRESA_ID, stockReservado: { gt: 0 } },
    select: { nombre: true, stockReservado: true },
  });
  comprobar(
    reservasColgadas.length === 0,
    "ninguna presentación quedó con stock reservado después de despachar" +
      (reservasColgadas.length > 0
        ? ` (${reservasColgadas.map((p) => `${p.nombre}: ${p.stockReservado}`).join(", ")})`
        : "")
  );

  // --- Capacidad con carga abierta ------------------------------------------
  // La planificación muestra la carga de las órdenes que NO terminaron. Sin un
  // centro de trabajo, sin ruta en la fórmula o sin una orden abierta, la
  // pantalla sale vacía — y una planta siempre tiene trabajo en curso.
  const centros = await prisma.centroTrabajo.count({
    where: { empresaId: EMPRESA_ID, activo: true },
  });
  comprobar(centros > 0, "hay centros de trabajo");

  const abiertas = await prisma.loteGranel.findMany({
    where: { empresaId: EMPRESA_ID, estado: { in: ["PLANIFICADO", "EN_PROCESO"] } },
    select: {
      codigo: true,
      operaciones: { where: { estado: { not: "COMPLETADA" } }, select: { nombre: true } },
      reservasInsumo: { select: { cantidad: true } },
    },
  });
  comprobar(abiertas.length > 0, "hay una orden de producción abierta");
  const conRuta = abiertas.filter((l) => l.operaciones.length > 0);
  comprobar(conRuta.length > 0, "esa orden tiene ruta: la planificación tiene qué repartir");
  for (const l of conRuta) {
    console.log(
      `      ${l.codigo}: ${l.operaciones.length} operación(es) abiertas, ` +
        `${l.reservasInsumo.length} insumo(s) reservados`
    );
  }
  comprobar(
    conRuta.every((l) => l.reservasInsumo.length > 0),
    "la orden abierta reserva su material (reservar no mueve stock; consumir sí)"
  );

  // --- Un lote que no pasó calidad -----------------------------------------
  // La no conformidad la abre el sistema al rechazar: sin un lote rechazado no
  // existe ninguna, y todo el circuito que viene después —contención, causa
  // raíz, acción correctiva y verificación de eficacia— queda invisible.
  const rechazados = await prisma.loteGranel.count({
    where: { empresaId: EMPRESA_ID, estado: "RECHAZADO" },
  });
  comprobar(rechazados > 0, "hay un lote rechazado por calidad");

  const noConformidades = await prisma.noConformidadCalidad.count({
    where: { empresaId: EMPRESA_ID },
  });
  comprobar(noConformidades > 0, "ese rechazo abrió su no conformidad");

  // Un lote rechazado con todas las lecturas conformes es una contradicción:
  // la ficha mostraría un ensayo que no explica por qué se rechazó.
  const fueraDeEspec = await prisma.resultadoCaracteristicaCalidad.count({
    where: {
      conforme: false,
      controlCalidad: { loteGranel: { empresaId: EMPRESA_ID }, resultado: "RECHAZADO" },
    },
  });
  comprobar(
    fueraDeEspec > 0,
    "el lote rechazado tiene una medición fuera de especificación que lo explica"
  );

  if (fallas.length > 0) {
    console.error(`\n✖ La demo no trae ${fallas.length} caso(s):`);
    for (const f of fallas) console.error(`   - ${f}`);
    console.error(
      "\nUna demo sin el caso deja la función invisible: quien la estrena concluye que no está."
    );
    process.exit(1);
  }
  console.log("\n✔ La demo trae todos los casos.");
}

main().finally(() => prisma.$disconnect());
