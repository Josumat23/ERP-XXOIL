import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { prisma } from "@/lib/prisma";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { siguienteCodigoProyecto, siguienteCodigoTraslado } from "@/lib/correlativos";

// La configuración de la sociedad (RUC del emisor, moneda, tasa de IGV,
// credenciales SUNAT, umbrales de aprobación) era una fila única con id "1"
// compartida por todas las compañías. Estas pruebas fijan que ahora es una por
// compañía y que nada vuelve a leer la fila global.

test("cada compañía tiene su propia configuración y no ve la de la otra", async () => {
  const sufijo = Date.now().toString(36);
  const empresaA = `empresa-config-a-${sufijo}`;
  const empresaB = `empresa-config-b-${sufijo}`;
  await prisma.empresa.createMany({
    data: [empresaA, empresaB].map((id) => ({ id, razonSocial: id })),
  });

  try {
    // Se crea sola, con los valores por defecto del esquema.
    const configA = await obtenerConfiguracionEmpresa(empresaA);
    assert.equal(configA.empresaId, empresaA);
    assert.equal(configA.tasaIgv.toNumber(), 18);

    await prisma.configuracionEmpresa.update({
      where: { empresaId: empresaA },
      data: { ruc: "20111111111", tasaIgv: 18, sunatUsuarioSol: "USUARIO-A" },
    });

    // La segunda compañía nace con sus propios valores por defecto: **no**
    // hereda el RUC ni las credenciales SUNAT de la primera. Heredarlos haría
    // que emitiera comprobantes con la identidad tributaria ajena.
    const configB = await obtenerConfiguracionEmpresa(empresaB);
    assert.equal(configB.empresaId, empresaB);
    assert.equal(configB.ruc, null);
    assert.equal(configB.sunatUsuarioSol, null);
    assert.notEqual(configB.id, configA.id);

    await prisma.configuracionEmpresa.update({
      where: { empresaId: empresaB },
      data: { ruc: "20222222222", tasaIgv: 10 },
    });

    // Editar una no toca a la otra.
    const releidaA = await obtenerConfiguracionEmpresa(empresaA);
    const releidaB = await obtenerConfiguracionEmpresa(empresaB);
    assert.equal(releidaA.ruc, "20111111111");
    assert.equal(releidaA.tasaIgv.toNumber(), 18);
    assert.equal(releidaB.ruc, "20222222222");
    assert.equal(releidaB.tasaIgv.toNumber(), 10);
  } finally {
    await prisma.configuracionEmpresa.deleteMany({
      where: { empresaId: { in: [empresaA, empresaB] } },
    });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaA, empresaB] } } });
  }
});

test("una compañía no puede tener dos configuraciones", async () => {
  const sufijo = Date.now().toString(36);
  const empresaId = `empresa-config-unica-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    await obtenerConfiguracionEmpresa(empresaId);
    await assert.rejects(
      () => prisma.configuracionEmpresa.create({ data: { empresaId } }),
      "el índice único de empresaId debe impedir una segunda fila"
    );
    assert.equal(await prisma.configuracionEmpresa.count({ where: { empresaId } }), 1);
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("la configuración no queda huérfana: borrar la compañía se rechaza", async () => {
  const sufijo = Date.now().toString(36);
  const empresaId = `empresa-config-fk-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    await obtenerConfiguracionEmpresa(empresaId);
    // onDelete: Restrict — igual que el resto del grafo transaccional.
    await assert.rejects(() => prisma.empresa.delete({ where: { id: empresaId } }));
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("el correlativo sigue funcionando con configuraciones de varias compañías", async () => {
  // Regresión concreta: el cerrojo de numeración se tomaba con
  // `INSERT INTO configuracion_empresa (id) VALUES ('1')`, que daba por hecho
  // una sola fila de configuración. Con una fila por compañía ese INSERT choca
  // contra el índice único de empresaId y **toda** generación de correlativo
  // falla. El cerrojo vive ahora en su propia tabla.
  const sufijo = Date.now().toString(36);
  const empresaId = `empresa-config-cerrojo-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    await obtenerConfiguracionEmpresa("1");
    await obtenerConfiguracionEmpresa(empresaId);

    const codigos = await prisma.$transaction(async (tx) => [
      await siguienteCodigoTraslado(tx, empresaId),
      await siguienteCodigoProyecto(tx, empresaId),
    ]);
    assert.match(codigos[0], /^TR-\d{5}$/);
    assert.match(codigos[1], /^PRY-\d{5}$/);

    // El cerrojo dejó su fila, y es una sola.
    assert.equal(await prisma.cerrojoCorrelativo.count(), 1);
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

// --- Guardia estructural ----------------------------------------------------
// El riesgo de este cambio no es que falle: es que alguien vuelva a escribir
// `where: { id: "1" }` y lea la configuración de la compañía principal desde
// otra compañía, sin error de TypeScript ni de lint y sin nada visible en
// pantalla. Por eso se audita el código fuente.

async function archivosFuente(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const rutas: string[] = [];
  for (const entrada of entradas) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "generated" || entrada.name === "node_modules") continue;
      rutas.push(...(await archivosFuente(ruta)));
    } else if (/\.tsx?$/.test(entrada.name)) {
      rutas.push(ruta);
    }
  }
  return rutas;
}

test("nadie lee la configuración por la fila global id \"1\"", async () => {
  const raiz = resolve(process.cwd(), "src");
  const culpables: string[] = [];

  for (const ruta of await archivosFuente(raiz)) {
    const contenido = await readFile(ruta, "utf8");
    if (!contenido.includes("configuracionEmpresa")) continue;
    // Se busca la llamada completa (`configuracionEmpresa.loQueSea({ ...
    // where: { id: "1" } ... })`) y no la mera cercanía de las dos cadenas:
    // `empresaId: "1"` es la forma correcta de pedir la compañía principal, y
    // un `id: "1"` de otra tabla en las líneas siguientes no es asunto de esta
    // guardia.
    if (/configuracionEmpresa\.\w+\([\s\S]{0,200}?where:\s*\{\s*id:\s*"1"/.test(contenido)) {
      culpables.push(ruta.replace(raiz, "src"));
    }
  }

  assert.deepEqual(
    culpables,
    [],
    `Estos archivos leen la configuración de la compañía "1" en vez de la activa:\n${culpables.join("\n")}`
  );
});

test("la configuración se pide siempre con una compañía explícita", async () => {
  const raiz = resolve(process.cwd(), "src");
  const culpables: string[] = [];

  for (const ruta of await archivosFuente(raiz)) {
    const contenido = await readFile(ruta, "utf8");
    // Sin argumento TypeScript ya falla; la guardia cubre el caso de que
    // alguien le devuelva un valor por defecto a empresaId y reabra la fuga
    // en silencio.
    if (/obtenerConfiguracionEmpresa\(\s*\)/.test(contenido)) {
      culpables.push(ruta.replace(raiz, "src"));
    }
  }

  assert.deepEqual(culpables, [], culpables.join("\n"));
});

test("la firma de obtenerConfiguracionEmpresa exige empresaId", async () => {
  const fuente = await readFile(resolve(process.cwd(), "src/lib/empresa.ts"), "utf8");
  assert.match(fuente, /empresaId:\s*string,/);
  assert.doesNotMatch(
    fuente,
    /empresaId:\s*string\s*=/,
    "empresaId no debe tener valor por defecto: haría que un llamador distraído leyera otra compañía"
  );
});
