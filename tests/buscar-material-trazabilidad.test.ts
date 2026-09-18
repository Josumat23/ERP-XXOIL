import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { contiene } from "@/lib/busqueda";

// ---------------------------------------------------------------------------
// Encontrar el material en la pantalla de trazabilidad.
//
// La pantalla se construyó con dos listas desplegables: una con TODOS los lotes
// de la historia y otra con las últimas 200 recepciones. Con los datos de hoy
// —cinco lotes, siete recepciones— funciona; con volumen real, buscar en una
// lista de miles es imposible, y el día de un recall es cuando menos tiempo
// hay.
//
// El dato que importa buscar es el LOTE DEL PROVEEDOR: es con el que llama
// quien reporta el problema, y el único que no se puede deducir de los demás.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

test("se busca por lote del proveedor, insumo y recepción", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /numeroLoteProveedor: contiene\(/, "no se puede buscar por lote del proveedor");
  assert.match(pagina, /insumo: \{ codigo: contiene\(/, "no se puede buscar por código de insumo");
  assert.match(pagina, /insumo: \{ nombre: contiene\(/, "no se puede buscar por nombre de insumo");
  assert.match(pagina, /recepcion: \{ numero: contiene\(/, "no se puede buscar por recepción");
});

test("también se filtran los lotes, que era la lista sin tope", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /qLote/, "el selector de lotes sigue sin filtro");
  assert.match(pagina, /codigo: contiene\(qLote\)/);
});

test("las dos listas están acotadas", async () => {
  // La de lotes no tenía tope: traía la historia entera en cada visita.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  const topes = pagina.match(/take: TOPE_SELECTOR/g) ?? [];
  assert.equal(topes.length, 2, "alguna de las dos listas quedó sin tope");
});

test("la pantalla dice cuántas opciones muestra de cuántas hay", async () => {
  // Un selector acotado sin decirlo es peor que uno largo: quien no encuentra
  // su lote concluye que no existe.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  // El aviso vivía dentro de esta pantalla; al necesitarlo una tercera lista
  // —la de facturas del cliente, en reclamos— se extrajo a un componente. La
  // guarda sigue comprobando lo mismo: que las DOS listas de acá lo informen.
  assert.match(pagina, /from "@\/components\/AlcanceDeLista"/);
  const usos = pagina.match(/<AlcanceDeLista\b/g) ?? [];
  assert.equal(usos.length, 2, `solo ${usos.length} de las dos listas informa su alcance`);

  const componente = await readFile(resolve(RAIZ, "src/components/AlcanceDeLista.tsx"), "utf8");
  assert.match(componente, /Ningún resultado para/, "no avisa cuando la búsqueda no encuentra nada");
  assert.match(componente, /Se muestran los \{mostrados\} más recientes de \{totales\}/);
});

test("la búsqueda usa el ayudante común, no `contains` a secas", async () => {
  // PostgreSQL distingue mayúsculas con `contains`; `contiene()` genera ILIKE.
  // Buscar «ferreteria» tiene que encontrar «FERRETERIA».
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /from "@\/lib\/busqueda"/);
  assert.doesNotMatch(pagina, /\{ contains: /, "usa contains directo y perdería las mayúsculas");
});

// --- Contra la base ---------------------------------------------------------

test("buscar por lote del proveedor encuentra su recepción, sin importar mayúsculas", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const proveedor = await prisma.proveedor.findFirstOrThrow({ where: { empresaId } });
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });
  const loteProveedor = `PROV-${sufijo.toUpperCase()}`;

  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-BM-${sufijo}`,
      proveedorId: proveedor.id,
      total: 100,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const recepcion = await prisma.recepcionCompra.create({
    data: {
      empresaId,
      ordenCompraId: orden.id,
      numero: `RC-BM-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalle = await prisma.recepcionCompraDetalle.create({
    data: {
      recepcionId: recepcion.id,
      insumoId: insumo.id,
      cantidad: 10,
      costoUnitario: 1,
      numeroLoteProveedor: loteProveedor,
    },
  });

  try {
    // En minúsculas: es como lo escribe quien atiende la llamada.
    const encontrados = await prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        OR: [
          { numeroLoteProveedor: contiene(loteProveedor.toLowerCase()) },
          { insumo: { codigo: contiene(loteProveedor.toLowerCase()) } },
        ],
      },
      select: { id: true, numeroLoteProveedor: true },
    });
    assert.equal(encontrados.length, 1, "no encontró el lote del proveedor escrito en minúsculas");
    assert.equal(encontrados[0].id, detalle.id);
    assert.equal(encontrados[0].numeroLoteProveedor, loteProveedor);

    // Y una búsqueda que no corresponde a nada no devuelve de más.
    const ninguno = await prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        OR: [{ numeroLoteProveedor: contiene(`NO-EXISTE-${sufijo}`) }],
      },
      select: { id: true },
    });
    assert.equal(ninguno.length, 0);
  } finally {
    await prisma.recepcionCompraDetalle.delete({ where: { id: detalle.id } }).catch(() => {});
    await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
  }
});

test("no dice «no hay ninguna» cuando lo que pasó es que la búsqueda no encontró", async () => {
  // Con el filtro puesto y sin resultados, la pantalla mostraba DOS mensajes
  // contradictorios: «ningún resultado para X entre los 3 materiales» y
  // «todavía no hay recepciones consumidas». Visto en el navegador.
  //
  // Es el mismo defecto que ya apareció con el catálogo de especificaciones:
  // un estado vacío que no distingue «no existe nada» de «no coincide nada».
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/produccion/lotes/recall/page.tsx"),
    "utf8"
  );
  assert.match(
    pagina,
    /recepcionesTotales === 0 &&/,
    "el mensaje de «no hay ninguna» volvió a colgar del resultado de la búsqueda"
  );
  assert.doesNotMatch(pagina, /recepciones\.length === 0 &&/);
});
