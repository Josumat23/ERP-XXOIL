import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { coberturaEspecificaciones } from "@/lib/equivalencias";
import {
  disponibleParaPrometer,
  ordenarSugerencias,
  resumenCobertura,
  type Sugerencia,
} from "@/lib/sugerenciaEquivalente";

// ---------------------------------------------------------------------------
// De la ficha de competencia al renglón de la cotización.
//
// Las equivalencias ya existían y se justificaban contra especificaciones. Lo
// que faltaba era que sirvieran en el momento en que hacen falta: el cliente
// pide un Delvac 1340 y el vendedor está cotizando. Hasta ahora había que
// abrir la ficha de competencia, buscar el equivalente, volver, buscar el SKU y
// su precio — cuatro pantallas para una pregunta.
//
// El salto que una tabla de sinónimos no resuelve ni teniendo la fila: la
// equivalencia apunta a un **producto**, pero se cotiza una **presentación**.
// Saber que la Grasa Chasis reemplaza al Delvac no dice qué SKU ofrecer, a qué
// precio, ni si hay con qué cumplir.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

const sugerencia = (
  codigo: string,
  cubiertas: number,
  total: number,
  disponible: number
): Sugerencia => ({
  productoId: codigo,
  codigo,
  nombre: codigo,
  cobertura: {
    cubiertas: Array.from({ length: cubiertas }, (_, i) => `c${i}`),
    faltantes: Array.from({ length: total - cubiertas }, (_, i) => `f${i}`),
    total,
    esTotal: total > 0 && cubiertas === total,
  },
  justificacion: null,
  presentaciones: [
    {
      presentacionId: `${codigo}-p`,
      sku: `${codigo}-SKU`,
      nombre: "Balde",
      precio: 100,
      moneda: "PEN",
      disponible,
    },
  ],
});

// --- Lo que se puede prometer ----------------------------------------------

test("disponible es el stock sin lo ya comprometido", () => {
  // Ofrecer stock reservado es prometer dos veces la misma unidad.
  assert.equal(disponibleParaPrometer({ stock: 100, stockReservado: 30 }), 70);
  assert.equal(disponibleParaPrometer({ stock: 100, stockReservado: 0 }), 100);
});

test("un saldo comprometido de más no devuelve negativo", () => {
  // Puede pasar por un ajuste: un negativo en pantalla se lee como una deuda
  // de stock y no como «no hay».
  assert.equal(disponibleParaPrometer({ stock: 10, stockReservado: 25 }), 0);
});

// --- El orden en que alguien busca un reemplazo ----------------------------

test("primero lo que más cubre", () => {
  const orden = ordenarSugerencias([
    sugerencia("PARCIAL", 1, 3, 500),
    sugerencia("TOTAL", 3, 3, 10),
  ]).map((s) => s.codigo);
  // Aunque el parcial tenga cincuenta veces más stock: lo que el cliente pidió
  // manda sobre lo que sobra en el almacén.
  assert.deepEqual(orden, ["TOTAL", "PARCIAL"]);
});

test("entre dos que cubren lo mismo, primero lo que se puede entregar", () => {
  const orden = ordenarSugerencias([
    sugerencia("SIN-STOCK", 3, 3, 0),
    sugerencia("CON-STOCK", 3, 3, 40),
  ]).map((s) => s.codigo);
  assert.deepEqual(orden, ["CON-STOCK", "SIN-STOCK"]);
});

test("nada se esconde: el que no tiene stock también sale", () => {
  // Decir «no tenemos» es peor que decir «lo tenemos, sin stock hoy», y
  // ocultarlo llevaría a ofrecerle al cliente el producto del competidor.
  const orden = ordenarSugerencias([sugerencia("A", 3, 3, 0)]);
  assert.equal(orden.length, 1);
  assert.equal(orden[0].presentaciones[0].disponible, 0);
});

test("el orden es estable cuando todo empata", () => {
  const orden = ordenarSugerencias([
    sugerencia("GR-Z", 2, 2, 5),
    sugerencia("GR-A", 2, 2, 5),
  ]).map((s) => s.codigo);
  assert.deepEqual(orden, ["GR-A", "GR-Z"]);
});

test("ordenar no modifica la lista que recibe", () => {
  const original = [sugerencia("B", 1, 2, 0), sugerencia("A", 2, 2, 0)];
  const copia = [...original];
  ordenarSugerencias(original);
  assert.deepEqual(original.map((s) => s.codigo), copia.map((s) => s.codigo));
});

// --- Lo que se le dice a quien cotiza --------------------------------------

test("la cobertura se dice en palabras, no en un «equivalente» a secas", () => {
  // Quien cotiza tiene que poder repetirle al cliente qué cubre y qué no.
  assert.match(
    resumenCobertura({ cubiertas: ["a", "b"], faltantes: [], total: 2, esTotal: true }),
    /cubre las 2 que declara/
  );
  assert.match(
    resumenCobertura({ cubiertas: ["a"], faltantes: ["b"], total: 2, esTotal: false }),
    /cubre 1 de 2/
  );
  assert.match(
    resumenCobertura({ cubiertas: [], faltantes: [], total: 0, esTotal: false }),
    /sin especificaciones que comparar/
  );
});

// --- Guardias estructurales -------------------------------------------------

test("la cobertura del panel es la de hoy, no la guardada", async () => {
  // Es el punto: una homologación vencida tiene que verse al cotizar, no solo
  // en la ficha. Si el panel leyera `cubiertasAlDeclarar`, ofrecería una
  // equivalencia que dejó de sostenerse.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/equivalentes/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /coberturaEspecificaciones\(/, "el buscador no recalcula la cobertura");
  assert.doesNotMatch(pagina, /cubiertasAlDeclarar/, "está usando la cobertura guardada");
});

test("el id que llega por la URL no se usa sin comprobar la compañía", async () => {
  const buscador = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/equivalentes/page.tsx"),
    "utf8"
  );
  // El competidor se busca con empresaId.
  assert.match(buscador, /productoCompetencia\.findFirst\(\{[\s\S]{0,80}empresaId/);
  // Y la presentación a precargar se valida, en la pantalla de cotización,
  // contra las que ya cargó para la compañía activa.
  const cotizacion = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/cotizaciones/nuevo/page.tsx"),
    "utf8"
  );
  assert.match(cotizacion, /presentaciones\.some\(\(p\) => p\.id === presentacionPedida\)/);
  // Y se remonta el formulario cuando cambia: `useState` no se reinicializa en
  // una navegación de cliente, y sin esto el enlace no precargaría nada.
  assert.match(cotizacion, /key=\{presentacionInicial \?\? "vacio"\}/);
});

test("el panel dice qué no cubre, y no inventa un reemplazo cuando no hay", async () => {
  const panel = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/equivalentes/PanelEquivalente.tsx"),
    "utf8"
  );
  assert.match(panel, /no cubre:/, "no nombra lo que falta");
  assert.match(
    panel,
    /No hay ningún producto declarado como equivalente/,
    "no dice que no hay equivalente"
  );
  // Es un formulario GET: la búsqueda la resuelve el servidor y el resultado
  // queda en la URL.
  assert.match(panel, /method="GET"/);
  assert.match(panel, /name="equivalenteA"/);
  // Y el enlace que lleva a cotizar con la presentación ya elegida.
  assert.match(panel, /cotizaciones\/nuevo\?presentacion=\$\{p\.presentacionId\}/);
});

test("el buscador está en el menú de Ventas y la cotización lleva a él", async () => {
  // Una pantalla sin enlace no existe para quien la usa, y la pregunta llega
  // justo cuando alguien está por cotizar.
  const navegacion = await readFile(resolve(RAIZ, "src/lib/navegacion.ts"), "utf8");
  assert.match(navegacion, /\/comercial\/equivalentes/);
  const cotizacion = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/cotizaciones/nuevo/page.tsx"),
    "utf8"
  );
  assert.match(cotizacion, /\/comercial\/equivalentes/);
});

test("el formulario de cotización acepta la presentación precargada", async () => {
  // Sin esto el «Cotizar este» sería un enlace que no hace nada.
  const formulario = await readFile(
    resolve(RAIZ, "src/app/(app)/comercial/cotizaciones/CotizacionFormulario.tsx"),
    "utf8"
  );
  assert.match(formulario, /presentacionInicial/);
  assert.match(formulario, /presentacionId: presentacionInicial \?\? ""/);
  // Y trae el precio de lista para no obligar a buscarlo aparte.
  assert.match(formulario, /presentaciones\.find\(\(p\) => p\.id === presentacionInicial\)\?\.precio/);
});

// --- Contra la base ---------------------------------------------------------

test("la cadena completa: competidor, equivalencia, presentación y disponible", async () => {
  // Une las tres piezas de los ciclos anteriores con la venta, contra filas
  // reales: especificación → producto propio → equivalencia → presentación.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `COT-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });
  const espec = await prisma.especificacionTecnica.create({
    data: { empresaId, organismo: "API", codigo: `COT-${sufijo}` },
  });

  try {
    await prisma.especificacionProducto.create({
      data: {
        empresaId,
        productoId: producto.id,
        especificacionId: espec.id,
        tipo: "CUMPLE",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const presentacion = await prisma.presentacion.create({
      data: {
        empresaId,
        productoId: producto.id,
        sku: `COT-${sufijo}`,
        nombre: "Balde 5 gal",
        contenidoKg: 18,
        precio: 250,
        stock: 40,
        stockReservado: 15,
      },
    });
    const competidor = await prisma.productoCompetencia.create({
      data: {
        empresaId,
        marca: `Marca ${sufijo}`,
        nombre: `Producto ${sufijo}`,
        especificaciones: { create: [{ empresaId, especificacionId: espec.id }] },
        equivalencias: {
          create: [
            {
              empresaId,
              productoId: producto.id,
              cubiertasAlDeclarar: 1,
              totalAlDeclarar: 1,
              usuarioId: "u",
              usuarioNombre: "u",
            },
          ],
        },
      },
      include: {
        especificaciones: { select: { especificacionId: true } },
        equivalencias: {
          include: {
            producto: {
              include: {
                especificaciones: { select: { especificacionId: true, tipo: true, vigenteHasta: true } },
                presentaciones: { where: { activo: true } },
              },
            },
          },
        },
      },
    });

    const sugerencias = ordenarSugerencias(
      competidor.equivalencias.map((eq) => ({
        productoId: eq.productoId,
        codigo: eq.producto.codigo,
        nombre: eq.producto.nombre,
        cobertura: coberturaEspecificaciones(
          eq.producto.especificaciones,
          competidor.especificaciones
        ),
        justificacion: eq.justificacion,
        presentaciones: eq.producto.presentaciones.map((p) => ({
          presentacionId: p.id,
          sku: p.sku,
          nombre: p.nombre,
          precio: p.precio.toNumber(),
          moneda: p.moneda,
          disponible: disponibleParaPrometer({
            stock: p.stock.toNumber(),
            stockReservado: p.stockReservado.toNumber(),
          }),
        })),
      }))
    );

    assert.equal(sugerencias.length, 1);
    assert.equal(sugerencias[0].cobertura.esTotal, true);
    assert.equal(sugerencias[0].presentaciones[0].presentacionId, presentacion.id);
    assert.equal(sugerencias[0].presentaciones[0].precio, 250);
    // 40 en stock, 15 comprometidos: 25 es lo que se puede prometer hoy.
    assert.equal(sugerencias[0].presentaciones[0].disponible, 25);

    await prisma.productoCompetencia.delete({ where: { id: competidor.id } });
  } finally {
    await prisma.presentacion.deleteMany({ where: { productoId: producto.id } });
    await prisma.especificacionProducto.deleteMany({ where: { productoId: producto.id } });
    await prisma.equivalenciaProducto.deleteMany({ where: { productoId: producto.id } });
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.especificacionTecnica.delete({ where: { id: espec.id } }).catch(() => {});
  }
});
