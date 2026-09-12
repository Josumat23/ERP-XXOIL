import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  siguienteCodigoCliente,
  siguienteNumeroCotizacion,
  siguienteCodigoOrdenInterna,
  siguienteNumeroPedido,
} from "@/lib/correlativos";

// Trece de los diecinueve generadores leían el máximo global, sin filtrar por
// compañía. En cuanto existe una segunda sociedad eso rompe de dos maneras: el
// alta falla contra el índice único, o la numeración de una compañía continúa
// desde el máximo de la otra.

async function conDosEmpresas<T>(cuerpo: (a: string, b: string) => Promise<T>): Promise<T> {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const a = `empresa-corr-a-${sufijo}`;
  const b = `empresa-corr-b-${sufijo}`;
  await prisma.empresa.createMany({
    data: [a, b].map((id) => ({ id, razonSocial: id })),
  });
  try {
    return await cuerpo(a, b);
  } finally {
    await prisma.ordenInterna.deleteMany({ where: { empresaId: { in: [a, b] } } });
    await prisma.cotizacion.deleteMany({ where: { empresaId: { in: [a, b] } } });
    await prisma.cliente.deleteMany({ where: { empresaId: { in: [a, b] } } });
    await prisma.empresa.deleteMany({ where: { id: { in: [a, b] } } });
  }
}

test("un código no numérico de OTRA compañía ya no reinicia el correlativo", async () => {
  // Reproducción exacta del fallo: la segunda compañía tenía un cliente
  // sembrado como "CLI-SUR-001". Al crear un cliente en la primera, el máximo
  // global era ese, parseaba como NaN, el contador volvía a 1 y chocaba con el
  // CLI-00001 que ya existía. El alta fallaba y el usuario solo veía
  // "Ya existe un cliente con el documento null".
  await conDosEmpresas(async (a, b) => {
    await prisma.cliente.create({
      data: { empresaId: a, codigo: "CLI-00001", razonSocial: "Cliente A uno" },
    });
    await prisma.cliente.create({
      data: { empresaId: b, codigo: "CLI-SUR-001", razonSocial: "Cliente B sembrado a mano" },
    });

    const siguiente = await prisma.$transaction((tx) => siguienteCodigoCliente(tx, a));
    assert.equal(siguiente, "CLI-00002");

    // Y se puede crear de verdad, que es lo que fallaba.
    const creado = await prisma.cliente.create({
      data: { empresaId: a, codigo: siguiente, razonSocial: "Cliente A dos" },
    });
    assert.equal(creado.codigo, "CLI-00002");
  });
});

test("cada compañía lleva su propia serie, sin huecos ni continuidad ajena", async () => {
  await conDosEmpresas(async (a, b) => {
    for (const numero of ["PED-00001", "PED-00002", "PED-00003"]) {
      await prisma.cliente.create({
        data: { empresaId: a, codigo: numero.replace("PED", "CLI"), razonSocial: numero },
      });
    }

    // La compañía B no tiene clientes: su primer código debe ser el 1, no el 4.
    assert.equal(await prisma.$transaction((tx) => siguienteCodigoCliente(tx, b)), "CLI-00001");
    // Y la A sigue su propia cuenta.
    assert.equal(await prisma.$transaction((tx) => siguienteCodigoCliente(tx, a)), "CLI-00004");
  });
});

test("el mismo número puede existir en dos compañías a la vez", async () => {
  // Es lo correcto: son series independientes, y el índice único es
  // (empresaId, codigo), no (codigo).
  await conDosEmpresas(async (a, b) => {
    const enA = await prisma.$transaction((tx) => siguienteCodigoCliente(tx, a));
    const enB = await prisma.$transaction((tx) => siguienteCodigoCliente(tx, b));
    assert.equal(enA, "CLI-00001");
    assert.equal(enB, "CLI-00001");

    await prisma.cliente.create({ data: { empresaId: a, codigo: enA, razonSocial: "A" } });
    await prisma.cliente.create({ data: { empresaId: b, codigo: enB, razonSocial: "B" } });
    // Acotado a las dos compañías de esta prueba: otras pruebas del archivo
    // crean sus propios CLI-00001, que es justamente lo que se permite ahora.
    assert.equal(
      await prisma.cliente.count({ where: { codigo: "CLI-00001", empresaId: { in: [a, b] } } }),
      2
    );
  });
});

test("los documentos numerados también quedan acotados a su compañía", async () => {
  await conDosEmpresas(async (a, b) => {
    const actor = { usuarioId: "u", usuarioNombre: "u" };
    await prisma.ordenInterna.create({
      data: { empresaId: a, codigo: "OI-00007", descripcion: "Campaña A", ...actor },
    });

    assert.equal(await prisma.$transaction((tx) => siguienteCodigoOrdenInterna(tx, a)), "OI-00008");
    assert.equal(await prisma.$transaction((tx) => siguienteCodigoOrdenInterna(tx, b)), "OI-00001");
    // Estos no tienen filas en ninguna de las dos: ambas empiezan en 1.
    assert.equal(await prisma.$transaction((tx) => siguienteNumeroCotizacion(tx, b)), "COT-00001");
    assert.equal(await prisma.$transaction((tx) => siguienteNumeroPedido(tx, b)), "PED-00001");
  });
});

test("el índice único de los documentos numerados es por compañía", async () => {
  // Antes era global: `numero String @unique`. Con dos sociedades reales eso
  // impedía que cada una llevara su propia serie — la segunda chocaba contra
  // el número que ya había usado la primera.
  await conDosEmpresas(async (a, b) => {
    const actor = { usuarioId: "u", usuarioNombre: "u" };
    await prisma.ordenInterna.create({
      data: { empresaId: a, codigo: "OI-00001", descripcion: "Campaña A", ...actor },
    });
    // El mismo código en la otra compañía: permitido.
    await prisma.ordenInterna.create({
      data: { empresaId: b, codigo: "OI-00001", descripcion: "Campaña B", ...actor },
    });
    assert.equal(
      await prisma.ordenInterna.count({ where: { codigo: "OI-00001", empresaId: { in: [a, b] } } }),
      2
    );

    // Repetido dentro de la MISMA compañía: sigue prohibido.
    await assert.rejects(() =>
      prisma.ordenInterna.create({
        data: { empresaId: a, codigo: "OI-00001", descripcion: "Duplicada", ...actor },
      })
    );
  });
});

// --- Guardia estructural ----------------------------------------------------

test("todo generador de correlativo filtra por compañía", async () => {
  // Sin esto, agregar un generador nuevo sin `where: { empresaId }` reintroduce
  // el defecto en silencio: con una sola compañía funciona perfecto y solo
  // falla el día que se abre la segunda.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/correlativos.ts"), "utf8");
  const generadores = [...fuente.matchAll(/export async function (siguiente\w+)\(([\s\S]*?)\n\}/g)];
  assert.ok(generadores.length >= 19, `Se esperaban los generadores y se hallaron ${generadores.length}`);

  const sinEmpresa = generadores
    .filter(([bloque]) => !bloque.includes("empresaId"))
    .map(([, nombre]) => nombre);
  assert.deepEqual(sinEmpresa, [], "Estos generadores no filtran por compañía");

  // Y el parámetro es obligatorio: un valor por defecto haría que un llamador
  // distraído volviera a numerar contra la compañía principal sin error.
  const conDefecto = generadores
    .filter(([bloque]) => /empresaId:\s*string\s*=/.test(bloque))
    .map(([, nombre]) => nombre);
  assert.deepEqual(conDefecto, [], "empresaId no debe tener valor por defecto");
});

test("los dos generadores de número de asiento filtran por compañía", async () => {
  // Hay dos copias: la del motor automático y la de los asientos manuales.
  for (const ruta of ["src/lib/contabilidad.ts", "src/app/(app)/finanzas/asientos/actions.ts"]) {
    const fuente = await readFile(resolve(process.cwd(), ruta), "utf8");
    const bloque = fuente.slice(
      fuente.indexOf("async function siguienteNumeroAsiento"),
      fuente.indexOf("async function siguienteNumeroAsiento") + 500
    );
    assert.match(bloque, /empresaId: string/, `${ruta} debe recibir empresaId`);
    assert.match(bloque, /where: \{ empresaId \}/, `${ruta} debe filtrar por empresaId`);
  }
});
