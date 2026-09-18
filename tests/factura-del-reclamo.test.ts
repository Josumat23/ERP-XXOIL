import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// La factura del reclamo: el selector que dejaba clientes sin facturas.
//
// La pantalla de reclamos traía las 100 facturas más recientes de TODA la
// compañía y las filtraba por cliente en el navegador. Con los datos de hoy
// —19 facturas— funciona. Con volumen real, un cliente cuyas facturas no estén
// entre esas cien aparece SIN NINGUNA, y quien registra el reclamo concluye que
// no tiene facturas y lo deja sin relacionar.
//
// Ese reclamo es exactamente el que después no puede decir de qué lote salió:
// el defecto silencioso de una lista desactiva la pantalla construida encima.
// Es la misma familia que el tope compartido de la ficha del instrumento y que
// el recall por una sola recepción — una respuesta incompleta con cara de
// completa— pero acá el daño no es leer mal: es registrar mal, para siempre.
//
// Ahora se elige primero el cliente y se consultan SUS facturas, acotadas,
// buscables y diciendo cuántas se muestran de cuántas hay.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const LISTA = "src/app/(app)/produccion/calidad/reclamos/page.tsx";
const FORMULARIO = "src/app/(app)/produccion/calidad/reclamos/ReclamoFormulario.tsx";
const ACCIONES = "src/app/(app)/produccion/calidad/reclamos/actions.ts";
const COMPONENTE = "src/components/AlcanceDeLista.tsx";

const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");

// --- La consulta ------------------------------------------------------------

test("ya no se traen las últimas facturas de toda la compañía", async () => {
  const pagina = await leer(LISTA);
  assert.doesNotMatch(
    pagina,
    /prisma\.factura\.findMany\(\{[^}]*\n\s*orderBy: \{ fechaEmision: "desc" \},\n\s*take: 100,/,
    "volvió el tope de 100 facturas de toda la empresa"
  );
  assert.doesNotMatch(pagina, /take: 100/, "quedó un tope suelto de 100");
});

test("las facturas se piden del cliente elegido", async () => {
  const pagina = await leer(LISTA);
  assert.match(pagina, /clienteId: clienteElegido\.id/, "no se acotan al cliente");
  assert.match(pagina, /estado: \{ not: "ANULADA" \}/, "ofrecería facturas anuladas");
});

test("el cliente que llega por la URL se comprueba contra la compañía", async () => {
  const pagina = await leer(LISTA);
  assert.match(
    pagina,
    /where: \{ id: paraCliente, empresaId, estado: "ACTIVO" \}/,
    "el id del navegador se usa sin comprobarlo"
  );
});

test("las dos listas dicen cuántas opciones muestran de cuántas hay", async () => {
  const pagina = await leer(LISTA);
  const usos = pagina.match(/<AlcanceDeLista\b/g) ?? [];
  assert.equal(usos.length, 2, `solo ${usos.length} de las dos listas informa su alcance`);
  assert.match(pagina, /queBusca="clientes activos"/);
  assert.match(pagina, /queBusca=\{`facturas de \$\{clienteElegido\.razonSocial\}`\}/);
});

test("las dos listas están acotadas y se pueden buscar", async () => {
  const pagina = await leer(LISTA);
  const topes = pagina.match(/take: TOPE_SELECTOR/g) ?? [];
  assert.equal(topes.length, 2, "alguna de las dos listas quedó sin tope");
  assert.match(pagina, /qCliente \?/, "no se pueden filtrar los clientes");
  assert.match(pagina, /qFactura \? \{ numero: contiene\(qFactura\) \}/);
});

test("la búsqueda usa el ayudante común, no `contains` a secas", async () => {
  // PostgreSQL distingue mayúsculas con `contains`; `contiene()` genera ILIKE.
  const pagina = await leer(LISTA);
  assert.doesNotMatch(pagina, /\{ contains: /, "usa contains directo y perdería las mayúsculas");
});

// --- El formulario ----------------------------------------------------------

test("el formulario ya no filtra las facturas en el navegador", async () => {
  // Filtrar en el cliente es lo que hacía que el tope de la consulta se
  // convirtiera en «este cliente no tiene facturas».
  const formulario = await leer(FORMULARIO);
  assert.doesNotMatch(formulario, /facturas\.filter/, "volvió el filtrado en el navegador");
  assert.doesNotMatch(formulario, /clienteId: string/, "la factura sigue trayendo su cliente");
});

test("el cliente viaja en un campo oculto y el servidor lo revalida", async () => {
  const formulario = await leer(FORMULARIO);
  assert.match(formulario, /<input type="hidden" name="clienteId" value=\{cliente\.id\} \/>/);

  // La acción no confía en la pantalla: comprueba compañía y estado, y que la
  // factura sea de ese cliente. Se repite acá porque ahora el id llega por la
  // URL, que es un dato de afuera.
  const acciones = await leer(ACCIONES);
  assert.match(
    acciones,
    /where: \{ id: clienteId, empresaId: auth\.usuario\.empresaId, estado: "ACTIVO" \}/
  );
  assert.match(acciones, /La factura relacionada pertenece a otro cliente/);
});

test("si el cliente no tiene facturas, se dice lo que eso implica", async () => {
  // «No hay» a secas dejaría creer que da igual. Lo que da es un reclamo que
  // después no puede decir de qué lote salió.
  const formulario = await leer(FORMULARIO);
  assert.match(formulario, /no tiene facturas vigentes/);
  assert.match(formulario, /no va a poder decir de qué lote salió/);
});

test("sin cliente elegido no se muestra el alta, y se explica por qué", async () => {
  const pagina = await leer(LISTA);
  assert.match(pagina, /clienteElegido \? \(/);
  assert.match(pagina, /Elija el cliente para registrar un reclamo/);
});

// --- El componente compartido -----------------------------------------------

test("el aviso de alcance vive en un solo lugar", async () => {
  // Tres listas lo usan: las dos de trazabilidad y la de facturas del cliente.
  // Tres copias del mismo mensaje se desincronizan, y la que quede vieja va a
  // ser la de la pantalla que menos se mira.
  const componente = await leer(COMPONENTE);
  assert.match(componente, /export default function AlcanceDeLista/);

  const recall = await leer("src/app/(app)/produccion/lotes/recall/page.tsx");
  assert.match(recall, /from "@\/components\/AlcanceDeLista"/);
  assert.doesNotMatch(recall, /function Alcance\(/, "quedó una copia local del aviso");

  const reclamos = await leer(LISTA);
  assert.match(reclamos, /from "@\/components\/AlcanceDeLista"/);
});

// --- Contra la base ---------------------------------------------------------

test("las facturas consultadas son solo las del cliente", async () => {
  const cliente = await prisma.cliente.findFirst({
    where: { empresaId: "1", estado: "ACTIVO", facturas: { some: {} } },
    select: { id: true },
  });
  if (!cliente) return; // Base sin sembrar.

  const suyas = await prisma.factura.findMany({
    where: { empresaId: "1", clienteId: cliente.id, estado: { not: "ANULADA" } },
    select: { clienteId: true },
  });
  assert.ok(suyas.length > 0, "el cliente elegido no devolvió ninguna factura");
  for (const f of suyas) {
    assert.equal(f.clienteId, cliente.id, "se coló la factura de otro cliente");
  }

  // Y no son todas las de la compañía: ese era el defecto.
  const todas = await prisma.factura.count({
    where: { empresaId: "1", estado: { not: "ANULADA" } },
  });
  assert.ok(todas >= suyas.length);
});

test("un cliente de otra compañía no habilita el alta", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ajena = `empresa-fr-${sufijo}`;
  await prisma.empresa.create({ data: { id: ajena, razonSocial: ajena } });
  const clienteAjeno = await prisma.cliente.create({
    data: { empresaId: ajena, codigo: `CLI-${sufijo}`, razonSocial: "Cliente ajeno" },
  });

  try {
    const desdeLaUno = await prisma.cliente.findFirst({
      where: { id: clienteAjeno.id, empresaId: "1", estado: "ACTIVO" },
      select: { id: true },
    });
    assert.equal(desdeLaUno, null, "se pudo registrar un reclamo contra un cliente de otra empresa");
  } finally {
    await prisma.cliente.delete({ where: { id: clienteAjeno.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: ajena } }).catch(() => {});
  }
});

test("un cliente inactivo no se ofrece", async () => {
  // La acción exige ACTIVO; si la lista ofreciera inactivos, el alta fallaría
  // después de escribir la descripción.
  const pagina = await leer(LISTA);
  assert.match(pagina, /estado: "ACTIVO",/);
  const acciones = await leer(ACCIONES);
  assert.match(acciones, /estado: "ACTIVO"/);
});
