import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { clientesPorAvisar, resumenDespacho, type DestinoDeLote } from "@/lib/despachoLote";
import { contactoPara } from "@/lib/contactosCliente";

// ---------------------------------------------------------------------------
// La lista que se arma a mano el día del recall.
//
// La pantalla contestaba «cuántos clientes» y «qué lotes», pero para saber A
// QUIÉN LLAMAR había que entrar lote por lote, anotar los clientes y juntar los
// repetidos. Con tres lotes son tres pantallas y una hoja aparte, el día que
// menos tiempo hay — y el enlace «ver a quiénes» además hacía perder el alcance
// del material, así que había que volver a armar la consulta.
//
// Es una CONSULTA y nada más. No registra a quién se avisó ni marca nada como
// notificado: cómo se comunica un recall, quién lo firma y qué se le pide al
// cliente son decisiones del negocio que nadie tomó, y no se inventan desde
// una pantalla.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const PAGINA = "src/app/(app)/produccion/lotes/recall/page.tsx";
const leerPagina = () => readFile(resolve(RAIZ, PAGINA), "utf8");

const destino = (parcial: Partial<DestinoDeLote> = {}): DestinoDeLote => ({
  cantidad: 1,
  clienteId: "c1",
  clienteNombre: "Minera Andina S.A.C.",
  facturaNumero: "F001-1",
  pedidoNumero: "PED-1",
  envasadoId: "e1",
  envasadoCodigo: "ENV-00001",
  presentacionNombre: "Balde 35 lb",
  ...parcial,
});

// --- Cómo se agrupa ---------------------------------------------------------

test("sin destinos no hay a quién avisar", () => {
  assert.deepEqual(clientesPorAvisar([]), []);
});

test("se agrupa por cliente, no por entrega", () => {
  const filas = clientesPorAvisar([
    destino({ cantidad: 10, pedidoNumero: "PED-1" }),
    destino({ cantidad: 5, pedidoNumero: "PED-2", facturaNumero: "F001-2" }),
  ]);
  assert.equal(filas.length, 1, "el mismo cliente salió en dos renglones");
  assert.equal(filas[0].unidades, 15);
  assert.deepEqual(filas[0].pedidos, ["PED-1", "PED-2"]);
  assert.deepEqual(filas[0].facturas, ["F001-1", "F001-2"]);
});

test("se agrupa por id y no por razón social", () => {
  // Dos clientes pueden llamarse igual —o casi—; juntarlos por el nombre
  // mandaría a uno el aviso del otro, y dejaría al segundo sin avisar.
  const filas = clientesPorAvisar([
    destino({ clienteId: "c1", clienteNombre: "Ferretería Unión", cantidad: 4 }),
    destino({ clienteId: "c2", clienteNombre: "Ferretería Unión", cantidad: 6 }),
  ]);
  assert.equal(filas.length, 2, "dos clientes distintos con el mismo nombre se fusionaron");
  assert.deepEqual(
    filas.map((f) => f.clienteId),
    ["c2", "c1"]
  );
});

test("el mismo envase en dos entregas se suma, no se repite", () => {
  const filas = clientesPorAvisar([
    destino({ cantidad: 3, envasadoCodigo: "ENV-00001", pedidoNumero: "PED-1" }),
    destino({ cantidad: 4, envasadoCodigo: "ENV-00001", pedidoNumero: "PED-2" }),
    destino({ cantidad: 2, envasadoCodigo: "ENV-00002", pedidoNumero: "PED-3" }),
  ]);
  assert.equal(filas[0].envasados.length, 2);
  assert.equal(filas[0].envasados.find((e) => e.codigo === "ENV-00001")?.cantidad, 7);
});

test("primero quien más producto tiene", () => {
  // Si hay que empezar a llamar por alguien, es por ahí.
  const filas = clientesPorAvisar([
    destino({ clienteId: "poco", clienteNombre: "Poco", cantidad: 2 }),
    destino({ clienteId: "mucho", clienteNombre: "Mucho", cantidad: 90 }),
    destino({ clienteId: "medio", clienteNombre: "Medio", cantidad: 30 }),
  ]);
  assert.deepEqual(
    filas.map((f) => f.clienteId),
    ["mucho", "medio", "poco"]
  );
});

test("una guía facturada en varias facturas se abre en números sueltos", () => {
  // `destinosDeLote` las junta con «, » cuando una guía se facturó en varias;
  // en la lista de aviso tienen que ser buscables una por una.
  const filas = clientesPorAvisar([destino({ facturaNumero: "F001-9, F001-10" })]);
  assert.deepEqual(filas[0].facturas, ["F001-10", "F001-9"]);
});

test("sin factura vigente no se inventa un número", () => {
  const filas = clientesPorAvisar([destino({ facturaNumero: null })]);
  assert.deepEqual(filas[0].facturas, []);
});

test("las unidades coinciden con el resumen que muestra el encabezado", () => {
  // Dos cuentas de la misma cosa en la misma pantalla: si discrepan, quien lee
  // elige a cuál creerle.
  const destinos = [
    destino({ clienteId: "a", cantidad: 12 }),
    destino({ clienteId: "b", cantidad: 7 }),
    destino({ clienteId: "a", cantidad: 3 }),
  ];
  const resumen = resumenDespacho(destinos);
  const filas = clientesPorAvisar(destinos);
  assert.equal(
    filas.reduce((t, f) => t + f.unidades, 0),
    resumen.unidades
  );
  assert.equal(filas.length, resumen.clientes);
});

test("el resumen cuenta clientes por id, no por nombre", () => {
  // Antes contaba nombres distintos: dos clientes homónimos figuraban como
  // uno, y el recall decía que alcanzaba a menos gente de la que alcanza.
  const resumen = resumenDespacho([
    destino({ clienteId: "c1", clienteNombre: "Ferretería Unión" }),
    destino({ clienteId: "c2", clienteNombre: "Ferretería Unión" }),
  ]);
  assert.equal(resumen.clientes, 2);
});

// --- La pantalla ------------------------------------------------------------

test("la lista dice qué alcance cubre", async () => {
  // Con un lote Y un material elegidos hay dos listas de clientes en la misma
  // pantalla, con números distintos. Sin decir cuál es cuál, quien lee elige a
  // cuál creerle.
  const pagina = await leerPagina();
  assert.match(pagina, /const alcanceDelAviso =/);
  assert.match(pagina, /Alcance de esta lista: <strong>\{alcanceDelAviso\}<\/strong>/);
  assert.match(
    pagina,
    /La tabla de arriba es del lote \{lote\.codigo\} solamente/,
    "no aclara que la tabla del lote cubre menos"
  );
});

test("el enlace al lote conserva el alcance del material", async () => {
  // Antes «ver a quiénes» mandaba a `?loteId=X` a secas: se perdía la consulta
  // del material y había que volver a armarla desde el selector.
  const pagina = await leerPagina();
  assert.match(
    pagina,
    /recall\?loteId=\$\{c\.loteGranelId\}&recepcionId=\$\{recepcion\.id\}/,
    "el enlace al lote volvió a perder el material"
  );
  assert.match(pagina, /porLoteProveedor \? "&porLoteProveedor=1" : ""/);
});

test("los clientes se vuelven a pedir acotados a la compañía", async () => {
  // Los ids salen de la cadena comercial, que ya está acotada; volver a
  // pedirlos sin filtro sería confiar en el camino en vez de comprobarlo.
  const pagina = await leerPagina();
  const consulta = pagina.slice(pagina.indexOf("prisma.cliente.findMany"));
  assert.match(
    consulta.slice(0, consulta.indexOf("select:")),
    /where: \{ id: \{ in: porAvisar\.map\(\(c\) => c\.clienteId\) \}, empresaId \}/,
    "la consulta de clientes no filtra por empresa"
  );
});

test("el contacto sale del maestro, no de un propósito inventado", async () => {
  // No hay un propósito «calidad» ni «recall» declarado y no se inventa uno:
  // se usa DESPACHO —quien atiende la mercadería— y `contactoPara` cae en el
  // principal si nadie está designado para eso.
  const pagina = await leerPagina();
  assert.match(pagina, /contactoPara\(c\.contactos, "DESPACHO"\)/);
  assert.doesNotMatch(pagina, /paraCalidad|paraRecall/);
});

test("la pantalla no registra a quién se avisó", async () => {
  // El principio del ciclo: es una consulta. Cómo se comunica un recall, quién
  // lo firma y qué se le pide al cliente son decisiones que nadie tomó.
  //
  // Se comprueba sobre el CÓDIGO y no sobre el texto: la propia explicación de
  // arriba dice «notificado», y una guarda que se dispara con su propio
  // comentario no está mirando lo que dice mirar.
  const pagina = await leerPagina();
  assert.doesNotMatch(
    pagina,
    /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/,
    "la pantalla de recall empezó a escribir en la base"
  );
  assert.doesNotMatch(pagina, /"use server"/, "aparecieron acciones de servidor en una consulta");
});

test("cuando no hay a quién avisar, la sección no aparece", async () => {
  // Un encabezado con una tabla vacía hace dudar de si falta información.
  const pagina = await leerPagina();
  assert.match(pagina, /\{porAvisar\.length > 0 && \(/);
});

// --- Contra la base ---------------------------------------------------------

test("un cliente de otra compañía no entra en la lista aunque se pida su id", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ajena = `empresa-av-${sufijo}`;
  await prisma.empresa.create({ data: { id: ajena, razonSocial: ajena } });
  const clienteAjeno = await prisma.cliente.create({
    data: { empresaId: ajena, codigo: `CLI-${sufijo}`, razonSocial: "Cliente de otra empresa" },
  });

  try {
    const desdeLaUno = await prisma.cliente.findMany({
      where: { id: { in: [clienteAjeno.id] }, empresaId: "1" },
      select: { id: true },
    });
    assert.equal(desdeLaUno.length, 0, "el recall de una compañía alcanzó un cliente de otra");

    const desdeLaSuya = await prisma.cliente.findMany({
      where: { id: { in: [clienteAjeno.id] }, empresaId: ajena },
      select: { id: true },
    });
    assert.equal(desdeLaSuya.length, 1);
  } finally {
    await prisma.cliente.delete({ where: { id: clienteAjeno.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: ajena } }).catch(() => {});
  }
});

test("el contacto de despacho sembrado es el que la pantalla elegiría", async () => {
  // Los clientes sembrados no tenían ni un contacto, así que la pantalla solo
  // podía mostrar el teléfono de la empresa. `npm run seed:trazabilidad` carga
  // uno de despacho por cliente —personas inventadas— y esta prueba comprueba
  // que la regla de elección lo encuentra.
  const conContactos = await prisma.cliente.findFirst({
    where: { empresaId: "1", contactos: { some: { paraDespacho: true, activo: true } } },
    select: {
      contactos: {
        select: {
          id: true,
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
  if (!conContactos) return; // Base sin sembrar: no hay nada que comprobar.

  const elegido = contactoPara(conContactos.contactos, "DESPACHO");
  assert.ok(elegido, "con un contacto de despacho activo, no eligió ninguno");
  const contacto = conContactos.contactos.find((c) => c.id === elegido);
  assert.equal(contacto?.paraDespacho, true, "eligió un contacto que no atiende despacho");
});

test("el sembrador no pisa los contactos ya cargados", async () => {
  // La condición del sembrador: solo toca clientes SIN ningún contacto. El que
  // alguien cargó a mano no se reemplaza.
  const sembrador = await readFile(resolve(RAIZ, "prisma/seed-trazabilidad.ts"), "utf8");
  assert.match(sembrador, /contactos: \{ none: \{\} \}/, "el sembrador podría pisar un contacto");
  assert.match(sembrador, /Son personas inventadas/, "no advierte que los datos son ficticios");
});
