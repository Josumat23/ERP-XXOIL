import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Una demo puede estar «cargada» y no mostrar nada.
//
// Corriendo los sembradores desde una base VACÍA por primera vez aparecieron
// dos agujeros que ninguna prueba veía, porque todo se había probado siempre
// contra `erp_dev` —que tenía datos cargados a mano meses antes—:
//
//   1. Ningún lote del proveedor llegaba en dos recepciones, así que el aviso
//      de «alcance ampliado» del recall no aparecía nunca.
//   2. Ningún ensayo declaraba con qué instrumento se midió. Peor: los
//      controles de calidad de la demo no tenían NINGUNA medición, así que el
//      certificado de análisis ni siquiera abría —lo exige— y «Qué hay que
//      reensayar» decía que no hay nada.
//
// Tres pantallas en blanco en una instalación recién sembrada. Quien la
// estrena no concluye «faltan datos»: concluye que la función no está.
//
// La comprobación de verdad es `npm run semillas:desde-cero`, que siembra una
// base efímera y verifica los casos ejecutando las mismas consultas que las
// pantallas. No entra en `npm test` porque sembrar la demo entera tarda y la
// suite ya dura ocho minutos. Lo de acá es la guarda barata: que el script
// exista y que los sembradores no pierdan lo que hace que los casos ocurran.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");

test("hay un comando para sembrar desde cero y comprobar los casos", async () => {
  const paquete = JSON.parse(await leer("package.json")) as { scripts: Record<string, string> };
  assert.equal(paquete.scripts["semillas:desde-cero"], "node scripts/probar-semillas.mjs");
});

test("la base efímera lleva el prefijo que autoriza a destruirla", async () => {
  // La garantía de que esto no toca `erp_dev` es el NOMBRE: los ayudantes solo
  // destruyen bases que empiezan por el prefijo de pruebas.
  const script = await leer("scripts/probar-semillas.mjs");
  assert.match(script, /PREFIJO_BASE_PRUEBAS \+ "semillas_"/);
  assert.match(script, /eliminarBase\(plantilla, nombreBase, PREFIJO_BASE_PRUEBAS\)/);
  // Y se destruye pase lo que pase.
  assert.match(script, /\} finally \{/);
});

test("el script comprueba los casos ejecutando, no leyendo código", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /revisarReensayos\(EMPRESA_ID\)/, "no ejecuta la derivación de reensayos");
  assert.match(casos, /process\.exit\(1\)/, "no falla cuando falta un caso");
});

test("la compra registra el lote del proveedor", async () => {
  // El campo existía y nadie lo llenaba: sin él la pantalla de recall se abre
  // pero no se puede estrenar.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /numeroLoteProveedor: string \| null = null/);
  assert.match(semilla, /cantidadDisponible: cantidad, numeroLoteProveedor/);
});

test("un lote del proveedor llega en dos entregas, y la segunda queda sin consumir", async () => {
  // Es el caso que la pantalla de recall existe para contestar. La segunda
  // entrega va después de producción a propósito: así queda en almacén y el
  // recall puede decir cuánto del lote sospechoso sigue sin consumirse.
  const semilla = await leer("prisma/seed-demo.ts");
  const compras = semilla.match(/comprarInsumo\([^)]*"AB-2026-014"\)/g) ?? [];
  assert.equal(compras.length, 2, `el lote AB-2026-014 se compra ${compras.length} vez/veces`);

  const produccion = semilla.indexOf("const lote1 = await producirLote");
  const segunda = semilla.lastIndexOf('"AB-2026-014")');
  assert.ok(
    segunda > produccion,
    "la segunda entrega quedó antes de producción: se consumiría y no habría saldo que inmovilizar"
  );
});

test("el laboratorio deja escrito qué se midió al liberar", async () => {
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /async function sembrarMedicionesDeLiberacion\(\)/);
  assert.match(semilla, /await sembrarMedicionesDeLiberacion\(\);/, "la función está pero no se llama");
  // Del plan publicado, con su instrumento: no valores inventados sueltos.
  assert.match(semilla, /instrumentoId: c\.instrumentoId/);
  assert.match(semilla, /planInspeccionId: plan\.id, planVersion: plan\.version/);
});

test("no se pisan los ensayos que alguien cargó", async () => {
  // Solo se escribe sobre controles SIN mediciones. Un ensayo cargado por
  // pantalla es trabajo de una persona.
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /resultadosCaracteristica: \{ none: \{\} \}/);
  // Y sin plan publicado no se inventa qué se midió.
  assert.match(semilla, /if \(!plan \|\| plan\.caracteristicas\.length === 0\)/);
});

test("la densidad medida queda en el lote, como cuando se carga por pantalla", async () => {
  // Es el número que convierte kg en litros en los comprobantes. Dejarlo en
  // null haría que el lote use la del producto sin que nadie lo note.
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /data: \{ densidadKgL: densidad \}/);
});

// --- El tanque con mezcla ---------------------------------------------------

test("la descarga al tanque la hace el servicio, no el sembrador", async () => {
  // `descargarEnTanque()` mueve la disponibilidad del envase al tanque con
  // reclamo optimista y registra el aporte. Insertar las filas por afuera
  // sería una segunda implementación de una regla de saldos.
  const semilla = await leer("prisma/seed-trazabilidad.ts");
  assert.match(semilla, /import \{ descargarEnTanque \} from "\.\.\/src\/lib\/tanquesServicio"/);
  assert.match(semilla, /descargarEnTanque\(tx, \{/);
  assert.doesNotMatch(semilla, /aporteTanque\.create/, "el sembrador escribe el aporte a mano");
});

test("se descarga solo una parte: el resto queda suelto", async () => {
  // Dos motivos. Uno: el negocio confirmó que recibe de las dos formas, y lo
  // envasado conserva su lote. Dos: descargar todo dejaría la recepción en
  // cero y la pantalla de recall ya no podría decir cuánto del lote sospechoso
  // sigue sin consumirse — que es su dato accionable.
  const semilla = await leer("prisma/seed-trazabilidad.ts");
  assert.match(semilla, /disponible \* 0\.6/);
  assert.match(semilla, /siguen sueltos/);
});

test("al tanque entran dos lotes del proveedor, no uno", async () => {
  // Con un solo lote el reparto proporcional —el punto del diseño— no se ve.
  const semilla = await leer("prisma/seed-trazabilidad.ts");
  assert.match(semilla, /conSaldo\.slice\(0, 2\)/);

  const demo = await leer("prisma/seed-demo.ts");
  assert.match(demo, /"AB-2026-021"/, "falta la cisterna del segundo lote");
  const lotesDeAceite = demo.match(/comprarInsumo\(provQuimicos\.id, aceite\.id[^)]*\)/g) ?? [];
  assert.ok(
    lotesDeAceite.length >= 3,
    `solo ${lotesDeAceite.length} compras de aceite base: hacen falta tres para que quede saldo de dos lotes`
  );
});

test("un tanque ya cargado no se toca", async () => {
  const semilla = await leer("prisma/seed-trazabilidad.ts");
  assert.match(semilla, /const yaHay = await prisma\.tanque\.count/);
  assert.match(semilla, /no se toca ninguno/);
});

test("la comprobación desde cero exige que el tanque tenga mezcla", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /aportes\.length >= 2/);
  assert.match(casos, /el reparto proporcional/);
});

// --- Un lote que no pasó calidad --------------------------------------------

test("la no conformidad la abre el rechazo, no una fila suelta", async () => {
  // En la aplicación, `noConformidadCalidad` se crea SOLO cuando calidad
  // rechaza. Sembrar una por afuera diría que existe sin que nada la haya
  // provocado, que es justo lo contrario de lo que la pantalla explica.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /if \(rechazado\) \{/);
  assert.match(semilla, /noConformidadCalidad\.create/);
  assert.match(semilla, /estadoNuevo: "ABIERTA"/, "la no conformidad nace sin su primer evento");
  // Y el lote rechazado no deja nada disponible para envasar.
  assert.match(semilla, /kgDisponibles: rechazado \? 0 : kgProducidos/);
  assert.match(semilla, /estado: rechazado \? "RECHAZADO" : "APROBADO"/);
});

test("el lote rechazado tiene una medición que lo explica", async () => {
  // Un rechazo con todas las lecturas conformes es una contradicción: la ficha
  // mostraría un ensayo que no dice por qué se rechazó.
  const semilla = await leer("prisma/seed-calidad.ts");
  assert.match(semilla, /const rechazado = control\.resultado === "RECHAZADO"/);
  assert.match(semilla, /caracteristicaQueFalla/);
  // Y la que falla es la que menciona la causa raíz: la penetración.
  assert.match(semilla, /includes\("penetraci"\)/);
});

test("la comprobación desde cero exige el rechazo y su no conformidad", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /hay un lote rechazado por calidad/);
  assert.match(casos, /ese rechazo abrió su no conformidad/);
  assert.match(casos, /fuera de especificación que lo explica/);
});

test("`dev:demo` levanta con TODOS los sembradores", async () => {
  // Es la forma de revisar la aplicación en el navegador, y levantaba una base
  // sin laboratorio, sin trazabilidad y sin RRHH: las mismas pantallas en
  // blanco, pero en la base que se usa justamente para mirar.
  const script = await leer("scripts/dev-demo.mjs");
  for (const semilla of [
    "prisma/seed.ts",
    "prisma/seed-demo.ts",
    "prisma/seed-calidad.ts",
    "prisma/seed-trazabilidad.ts",
    "prisma/seed-rrhh.ts",
  ]) {
    assert.match(script, new RegExp(`"${semilla.replace(/[/.]/g, "\$&")}"`), semilla);
  }
});

// --- Capacidad con carga abierta --------------------------------------------

test("la planta tiene centros de trabajo y la fórmula su ruta", async () => {
  // La planificación de capacidad reparte la carga POR CENTRO: sin centros no
  // hay dónde repartirla, y sin ruta en la fórmula no hay qué repartir.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /centroTrabajo\.upsert/);
  assert.match(semilla, /formulaOperacion\.create/);
  assert.match(semilla, /CT-REACTOR/);
});

test("hay una orden abierta, y reserva en vez de consumir", async () => {
  // Una planta siempre tiene trabajo en curso: sembrar solo órdenes terminadas
  // deja la planificación sin nada que planificar.
  //
  // Reservar NO mueve stock —eso pasa al liberar la orden—, así que la orden
  // abierta no toca ningún saldo ni el kardex. Es la misma secuencia que hace
  // `crearLote()` por pantalla.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /estado: "PLANIFICADO"/);
  assert.match(semilla, /reservaInsumoProduccion\.createMany/);
  // Solo el bloque de la orden abierta, acotado por los dos extremos: cortar
  // hasta el final del archivo arrastraba lo que viniera después —y al agregar
  // la venta con entrega, que sí mueve stock, esta guarda se puso en rojo sin
  // que la orden abierta hubiera cambiado.
  const desde = semilla.indexOf("Orden abierta: es la carga");
  const hasta = semilla.indexOf("Orden de producción abierta ${codigo}", desde);
  assert.ok(desde >= 0 && hasta > desde, "no se pudo acotar el bloque de la orden abierta");
  assert.doesNotMatch(
    semilla.slice(desde, hasta),
    /registrarMovimiento/,
    "la orden abierta mueve stock: reservar y consumir no son lo mismo"
  );
});

test("las órdenes ya terminadas llevan su ruta completada", async () => {
  // Sin ella, la ficha de un lote cerrado no muestra por dónde pasó y la ruta
  // parecería inventada para la orden nueva.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /estado: "COMPLETADA"/);
  assert.match(semilla, /for \(const lote of \[lote1, lote2, lote3\]\)/);
});

test("la comprobación desde cero exige carga abierta con ruta", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /hay centros de trabajo/);
  assert.match(casos, /hay una orden de producción abierta/);
  assert.match(casos, /la planificación tiene qué repartir/);
  assert.match(casos, /reservar no mueve stock; consumir sí/);
});

// --- Los dos caminos de la trazabilidad de venta -----------------------------

test("hay una venta que se despacha con guía, y va aparte del bucle", async () => {
  // Las veinte ventas del bucle facturan y mueven stock en el mismo acto. La
  // venta con entrega sigue el otro camino —reservar, despachar, facturar— y
  // va en su propio bloque para no tocar los números de las otras veinte.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /requiereEntrega: true/);
  assert.match(semilla, /guiaRemision\.create/);
  assert.match(semilla, /guiaDetalleId: lineaGuia\.id/, "el lote no cuelga del renglón de la guía");
  assert.match(semilla, /facturaDetalleEntrega\.create/, "falta el puente factura ↔ guía");
});

test("el costo de ventas se postea al despachar, no dos veces", async () => {
  // `postearSalidaMercancia` ya carga el costo al despachar; volver a cargarlo
  // al facturar lo contaría dos veces.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /postearSalidaMercancia\(/);
  assert.match(semilla, /costoVentas: 0, \/\/ ya se posteó al despachar/);
});

test("la reserva se toma y se libera", async () => {
  // Una reserva que sobrevive al despacho bloquea stock disponible sin que
  // nadie la vea: el saldo «no alcanza» y no hay dónde mirar por qué.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /stockReservado: \{ increment: ventaConGuia\.cantidad \}/);
  assert.match(semilla, /stockReservado: \{ decrement: ventaConGuia\.cantidad \}/);

  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /ninguna presentación quedó con stock reservado/);
});

test("la fecha de la entrega no depende del día del mes", async () => {
  // Con un día fijo el bloque se salta solo cuando el sembrador corre antes de
  // esa fecha, y la entrega desaparece sin que nadie lo note. Pasó al
  // escribirlo: la comprobación desde cero lo encontró.
  const semilla = await leer("prisma/seed-demo.ts");
  assert.match(semilla, /const fechaEntrega = new Date\(hoy\.getTime\(\) - 5 \* 24 \* 60 \* 60 \* 1000\)/);
  assert.doesNotMatch(semilla, /const fechaEntrega = fechaHace\(/);
});

test("la comprobación desde cero exige los dos caminos", async () => {
  const casos = await leer("scripts/casos-de-la-demo.ts");
  assert.match(casos, /colgado del renglón de la factura/);
  assert.match(casos, /colgado del renglón de la guía/);
  assert.match(casos, /atada a su guía/);
});
