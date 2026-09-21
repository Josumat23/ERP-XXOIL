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

  // La reserva es transitoria: se toma al pedir y se libera al despachar,
  // facturar o anular. Una reserva que sobrevive al despacho bloquea stock que
  // sí está disponible, y nadie la ve — el saldo simplemente «no alcanza» sin
  // explicación.
  //
  // Lo que no puede quedar es reserva SIN un pedido vivo que la justifique. La
  // de un pedido pendiente es legítima: para eso existe. Esta guarda pedía
  // CERO reservas, y se cumplía solo porque la demo no tenía ningún pedido
  // pendiente; en cuanto tuvo el primero —la cotización convertida— se puso en
  // rojo sobre un dato correcto. Comprobaba «no hay reservas» creyendo
  // comprobar «no hay reservas huérfanas».
  const reservadas = await prisma.presentacion.findMany({
    where: { empresaId: EMPRESA_ID, stockReservado: { gt: 0 } },
    select: { id: true, nombre: true, stockReservado: true },
  });
  const pedidosVivos = await prisma.pedidoDetalle.groupBy({
    by: ["presentacionId"],
    where: { pedido: { empresaId: EMPRESA_ID, estado: { in: ["PENDIENTE", "PARCIAL"] } } },
    _sum: { cantidad: true },
  });
  // Para un pedido PARCIAL esto suma la cantidad original y no el saldo, así
  // que la comparación queda del lado laxo: puede dejar pasar una reserva de
  // menos, nunca inventar una huérfana que no existe.
  const justificadas = new Map(pedidosVivos.map((v) => [v.presentacionId, v._sum.cantidad ?? 0]));
  const huerfanas = reservadas.filter(
    (p) => p.stockReservado.toNumber() > (justificadas.get(p.id) ?? 0) + 1e-9
  );
  comprobar(
    huerfanas.length === 0,
    "el stock reservado corresponde a pedidos vivos, sin reservas huérfanas" +
      (huerfanas.length > 0
        ? ` (${huerfanas.map((p) => `${p.nombre}: ${p.stockReservado} reservado, ${justificadas.get(p.id) ?? 0} pedido`).join(", ")})`
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

  // --- Las ocho pantallas que estaban en cero ------------------------------
  //
  // No alcanza con que la tabla tenga filas: cada una de estas pantallas
  // existe para contestar algo, y el caso que lo contesta es lo que se
  // comprueba acá. Una demo «cargada» que no trae el caso deja la función
  // invisible igual que una vacía.

  // El embudo compara estados: con todas las cotizaciones en el mismo estado
  // no hay embudo que mirar.
  const estadosCotizacion = new Set(
    (
      await prisma.cotizacion.findMany({
        where: { empresaId: EMPRESA_ID },
        select: { estado: true },
      })
    ).map((c) => c.estado)
  );
  comprobar(estadosCotizacion.size >= 3, "las cotizaciones están en al menos tres estados distintos");
  comprobar(
    (await prisma.cotizacion.count({ where: { empresaId: EMPRESA_ID, estado: "CONVERTIDA", pedidoId: { not: null } } })) > 0,
    "hay una cotización convertida en pedido, con su pedido colgado"
  );

  // Una hoja de ruta cerrada es la que enseña para qué sirve el «resultado».
  comprobar(
    (await prisma.hojaRutaVisita.count({
      where: { hojaRuta: { empresaId: EMPRESA_ID, estado: "COMPLETADA" }, resultado: { not: null } },
    })) > 0,
    "hay visitas de una hoja de ruta cerrada con su resultado escrito"
  );

  // «Comparación de ofertas» necesita dos ofertas: con una sola, la pantalla
  // no compara nada y el sistema ni siquiera deja adjudicar.
  const rfqsConDos = await prisma.rfqCompra.findMany({
    where: { empresaId: EMPRESA_ID },
    select: { estado: true, adjudicadaPorId: true, usuarioId: true, _count: { select: { ofertas: true } } },
  });
  comprobar(
    rfqsConDos.some((r) => r.estado === "ABIERTO" && r._count.ofertas >= 2),
    "hay un RFQ abierto con dos ofertas para comparar"
  );
  const adjudicado = rfqsConDos.find((r) => r.estado === "ADJUDICADO");
  comprobar(Boolean(adjudicado), "hay un RFQ ya adjudicado");
  // La regla que el sistema impone: quien pide no adjudica. Un dato de prueba
  // que la incumpla muestra algo que la aplicación nunca habría aceptado.
  comprobar(
    Boolean(adjudicado) && adjudicado!.adjudicadaPorId !== adjudicado!.usuarioId,
    "el RFQ adjudicado lo adjudicó alguien distinto de quien lo solicitó"
  );

  // Un acuerdo se entiende por su SALDO: con cero liberado no hay saldo.
  const lineasAcuerdo = await prisma.acuerdoSuministroLinea.findMany({
    where: { acuerdo: { empresaId: EMPRESA_ID } },
    select: { cantidadComprometida: true, cantidadLiberada: true },
  });
  comprobar(
    lineasAcuerdo.some(
      (l) => l.cantidadLiberada.toNumber() > 0 && l.cantidadLiberada.toNumber() < l.cantidadComprometida.toNumber()
    ),
    "hay un acuerdo de suministro liberado en parte, con saldo contractual pendiente"
  );
  comprobar(
    (await prisma.ordenCompra.count({ where: { empresaId: EMPRESA_ID, acuerdoId: { not: null } } })) > 0,
    "la liberación del acuerdo generó su orden de compra"
  );

  // Una orden interna sirve para acumular y después liquidar: hacen falta las
  // dos mitades, y una que se pase del presupuesto para ver que se marca.
  const ordenesInternas = await prisma.ordenInterna.findMany({
    where: { empresaId: EMPRESA_ID },
    select: { estado: true, presupuesto: true, totalAcumulado: true, _count: { select: { costos: true } } },
  });
  comprobar(
    ordenesInternas.some((o) => o.estado === "ABIERTA" && o._count.costos > 0),
    "hay una orden interna abierta con costos acumulados"
  );
  comprobar(
    ordenesInternas.some((o) => o.estado === "LIQUIDADA"),
    "hay una orden interna ya liquidada"
  );
  comprobar(
    ordenesInternas.some(
      (o) => o.presupuesto !== null && o.totalAcumulado.toNumber() > o.presupuesto.toNumber()
    ),
    "hay una orden interna que se pasó de su presupuesto"
  );

  // Un proyecto se mide contra su presupuesto: sin costos reales, la columna
  // «costo real» sale en cero y no se puede comparar nada.
  comprobar(
    (await prisma.costoProyecto.count({ where: { proyecto: { empresaId: EMPRESA_ID } } })) > 0,
    "el proyecto tiene costos reales cargados"
  );
  comprobar(
    (await prisma.edtProyecto.count({ where: { proyecto: { empresaId: EMPRESA_ID } } })) >= 2,
    "el proyecto tiene una EDT con más de un paquete"
  );

  // La conciliación existe para mostrar lo que NO cuadra: si todo concilia,
  // la pantalla no enseña nada.
  const extracto = await prisma.movimientoExtractoBancario.findMany({
    where: { conciliacion: { empresaId: EMPRESA_ID } },
    select: { _count: { select: { aplicaciones: true } } },
  });
  comprobar(extracto.length > 0, "hay una conciliación bancaria con su extracto");
  comprobar(
    extracto.some((m) => m._count.aplicaciones === 0),
    "quedan movimientos del extracto sin conciliar, que es lo que la pantalla sirve para encontrar"
  );
  comprobar(
    extracto.some((m) => m._count.aplicaciones > 0),
    "y hay movimientos ya conciliados, para ver las dos situaciones"
  );

  // Un conteo sin diferencias no prueba nada, y una diferencia sin su ajuste
  // de kardex es un inventario que ninguna operación real puede producir.
  const detallesConteo = await prisma.conteoInventarioDetalle.findMany({
    where: { conteo: { empresaId: EMPRESA_ID } },
    select: { diferencia: true, conteo: { select: { codigo: true } } },
  });
  const conDiferencia = detallesConteo.filter((d) => Math.abs(d.diferencia.toNumber()) > 1e-9);
  comprobar(conDiferencia.length > 0, "el conteo cíclico encontró al menos una diferencia");
  if (conDiferencia.length > 0) {
    const codigo = conDiferencia[0].conteo.codigo;
    comprobar(
      (await prisma.movimientoKardex.count({
        where: { empresaId: EMPRESA_ID, origen: "AJUSTE", referencia: codigo },
      })) > 0,
      "la diferencia del conteo dejó su ajuste en el kardex"
    );
  }

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
