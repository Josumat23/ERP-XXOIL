import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { lotesQueConsumieron } from "@/lib/trazabilidadInsumo";

// ---------------------------------------------------------------------------
// Un lote del proveedor puede llegar en varias recepciones.
//
// La pantalla de recall contestaba «¿qué se fabricó con este material?» por
// RECEPCIÓN. Pero el proveedor no llama por una recepción: llama por su lote
// —«el L-2026-014 salió con la viscosidad fuera»— y ese lote pudo entrar en
// dos, tres o cinco descargas.
//
// Consultar una sola devolvía la mitad de lo fabricado, y la devolvía con cara
// de respuesta completa: ni un dato en pantalla decía que faltaba algo. En un
// recall ese es el peor error posible, porque quien lee concluye que el alcance
// es menor de lo que es y deja producto afuera.
//
// La corrección NO agrega en silencio: a veces la pregunta sí es por una
// entrega puntual (llegó dañada, se descargó mal). La pantalla avisa que hay
// recepciones hermanas y ofrece ampliar el alcance en un clic.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const PAGINA = "src/app/(app)/produccion/lotes/recall/page.tsx";

const leerPagina = () => readFile(resolve(RAIZ, PAGINA), "utf8");

// --- La pantalla ------------------------------------------------------------

test("la pantalla busca las recepciones hermanas del mismo lote del proveedor", async () => {
  const pagina = await leerPagina();
  assert.match(pagina, /const hermanas =/, "no se buscan las otras recepciones del lote");
  // Las tres condiciones que definen «hermana», y ninguna de más.
  assert.match(pagina, /insumoId: recepcion\.insumoId/, "no acota al mismo material");
  assert.match(
    pagina,
    /numeroLoteProveedor: recepcion\.numeroLoteProveedor/,
    "no acota al mismo lote del proveedor"
  );
  assert.match(pagina, /id: \{ not: recepcionId \}/, "se incluiría a sí misma");
});

test("la consulta de hermanas está acotada a la empresa activa", async () => {
  // Un número de lote de proveedor no es exclusivo de nadie: dos empresas del
  // grupo pueden comprarle al mismo proveedor y recibir el mismo lote. Sin el
  // filtro, el recall de una mostraría los lotes fabricados por la otra.
  const pagina = await leerPagina();
  const consulta = pagina.slice(pagina.indexOf("const hermanas ="));
  assert.match(
    consulta.slice(0, consulta.indexOf("orderBy")),
    /recepcion: \{ ordenCompra: \{ empresaId \} \}/,
    "la consulta de hermanas no filtra por empresa"
  );
});

test("no se amplía el alcance por nuestra cuenta: hay que pedirlo", async () => {
  // Ampliar solo contestaría otra pregunta. El aviso se muestra siempre; la
  // ampliación la decide quien consulta.
  const pagina = await leerPagina();
  assert.match(pagina, /parametros\.porLoteProveedor === "1"/);
  assert.match(
    pagina,
    /porLoteProveedor \? hermanas\.flatMap\(\(h\) => h\.asignacionesLote\) : \[\]/,
    "las hermanas entran en el alcance sin que nadie lo haya pedido"
  );
  // El aviso NO depende de haber ampliado: aparece por existir hermanas.
  assert.match(pagina, /\{hermanas\.length > 0 && \(/);
});

test("desde el alcance ampliado se puede volver a la recepción sola", async () => {
  // Si ampliar fuera un camino de ida, la pregunta por una entrega puntual
  // —llegó dañada, se descargó mal— quedaría sin forma de hacerse.
  const pagina = await leerPagina();
  assert.match(pagina, /recall\?recepcionId=\$\{recepcion\.id\}&porLoteProveedor=1`/);
  // El de vuelta: el mismo href, sin el parámetro.
  assert.match(pagina, /recall\?recepcionId=\$\{recepcion\.id\}`/);
});

test("el encabezado cuenta lo mismo que la tabla", async () => {
  // Decir «recibido 300 kg» encima de un consumo de 600 es una contradicción
  // impresa, y es la clase de dato que alguien copia a un informe.
  const pagina = await leerPagina();
  assert.match(pagina, /const recibidoEnAlcance =/);
  assert.match(pagina, /const sinConsumirEnAlcance =/);
  assert.match(pagina, /formatNumero\(recibidoEnAlcance, 3\)/);
  assert.match(pagina, /formatNumero\(sinConsumirEnAlcance, 3\)/);
  // Y las cifras de una sola recepción ya no se imprimen sueltas.
  assert.doesNotMatch(
    pagina,
    /formatNumero\(recepcion\.cantidad, 3\)/,
    "el encabezado volvió a mostrar solo la recepción elegida"
  );
  assert.doesNotMatch(pagina, /formatNumero\(recepcion\.cantidadDisponible, 3\)/);
});

test("el aviso dice cuántas recepciones son y cuáles", async () => {
  // «Hay más» sin decir cuántas obliga a buscarlas a mano, que es justo lo que
  // esta pantalla existe para evitar.
  const pagina = await leerPagina();
  assert.match(pagina, /hermanas\.length \+ 1/, "no dice cuántas recepciones cubre");
  assert.match(
    pagina,
    /\[recepcion\.recepcion\.numero, \.\.\.hermanas\.map\(\(h\) => h\.recepcion\.numero\)\]/,
    "no enumera las recepciones del alcance"
  );
});

test("el select de líneas de venta está escrito una sola vez", async () => {
  // Era el mismo bloque de veinte líneas repetido; con la consulta de hermanas
  // habría sido la tercera copia, y la tercera copia es la que se desincroniza.
  const pagina = await leerPagina();
  const copias = pagina.match(/pedidoDetalleId: true/g) ?? [];
  assert.equal(copias.length, 1, `el select de ventas está duplicado ${copias.length} veces`);
  const usos = pagina.match(/select: SELECT_ASIGNACIONES_VENTA/g) ?? [];
  assert.equal(usos.length, 2, "alguna de las dos consultas no usa el select común");
});

// --- Contra la base ---------------------------------------------------------

test("las dos descargas del mismo lote del proveedor se encuentran juntas", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const loteProveedor = `LP-${sufijo.toUpperCase()}`;
  const proveedor = await prisma.proveedor.findFirstOrThrow({ where: { empresaId } });
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });
  const otroInsumo = await prisma.insumo.findFirstOrThrow({
    where: { empresaId, id: { not: insumo.id } },
  });
  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-LP-${sufijo}`,
      proveedorId: proveedor.id,
      total: 100,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalles: string[] = [];
  const recepciones: string[] = [];

  try {
    const crearRecepcion = async (n: number) => {
      const r = await prisma.recepcionCompra.create({
        data: {
          empresaId,
          ordenCompraId: orden.id,
          numero: `RC-LP-${sufijo}-${n}`,
          usuarioId: "u",
          usuarioNombre: "u",
        },
      });
      recepciones.push(r.id);
      return r;
    };
    const crearDetalle = async (
      recepcionId: string,
      insumoId: string,
      cantidad: number,
      numeroLoteProveedor: string
    ) => {
      const d = await prisma.recepcionCompraDetalle.create({
        data: {
          recepcionId,
          insumoId,
          cantidad,
          cantidadDisponible: cantidad,
          costoUnitario: 1,
          numeroLoteProveedor,
        },
      });
      detalles.push(d.id);
      return d;
    };

    const r1 = await crearRecepcion(1);
    const r2 = await crearRecepcion(2);
    const r3 = await crearRecepcion(3);

    const primera = await crearDetalle(r1.id, insumo.id, 300, loteProveedor);
    const segunda = await crearDetalle(r2.id, insumo.id, 200, loteProveedor);
    // Trampa 1: el mismo número de lote, OTRO material. Un número de lote del
    // proveedor solo identifica algo junto con el material: dos productos
    // distintos del mismo proveedor pueden traer la misma numeración.
    await crearDetalle(r3.id, otroInsumo.id, 999, loteProveedor);
    // Trampa 2: el mismo material, otro lote.
    await crearDetalle(r3.id, insumo.id, 777, `${loteProveedor}-OTRO`);

    const hermanas = await prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId } },
        insumoId: primera.insumoId,
        numeroLoteProveedor: primera.numeroLoteProveedor,
        id: { not: primera.id },
      },
      select: { id: true, cantidad: true },
    });

    assert.equal(hermanas.length, 1, "no encontró exactamente la otra descarga del mismo lote");
    assert.equal(hermanas[0].id, segunda.id);

    // Lo que ve quien consulta con el alcance ampliado: 500, no 300.
    const recibido =
      primera.cantidad.toNumber() + hermanas.reduce((t, h) => t + h.cantidad.toNumber(), 0);
    assert.equal(recibido, 500, "el alcance ampliado no suma las dos descargas");
  } finally {
    for (const id of detalles) {
      await prisma.recepcionCompraDetalle.delete({ where: { id } }).catch(() => {});
    }
    for (const id of recepciones) {
      await prisma.recepcionCompra.delete({ where: { id } }).catch(() => {});
    }
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
  }
});

test("el lote del proveedor de otra empresa no entra en el alcance", async () => {
  // El filtro por empresa de la consulta de hermanas, ejercido de verdad: dos
  // empresas que le compran al mismo proveedor reciben el mismo número de lote.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const loteProveedor = `LP-X-${sufijo.toUpperCase()}`;
  const ajena = `empresa-lp-${sufijo}`;
  await prisma.empresa.create({ data: { id: ajena, razonSocial: ajena } });
  const proveedorAjeno = await prisma.proveedor.create({
    data: { empresaId: ajena, razonSocial: `Proveedor común ${sufijo}` },
  });
  const insumoAjeno = await prisma.insumo.create({
    data: {
      empresaId: ajena,
      codigo: `INS-${sufijo}`,
      nombre: "Aceite base",
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
    },
  });
  const ordenAjena = await prisma.ordenCompra.create({
    data: {
      empresaId: ajena,
      numero: `OC-X-${sufijo}`,
      proveedorId: proveedorAjeno.id,
      total: 10,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const recepcionAjena = await prisma.recepcionCompra.create({
    data: {
      empresaId: ajena,
      ordenCompraId: ordenAjena.id,
      numero: `RC-X-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalleAjeno = await prisma.recepcionCompraDetalle.create({
    data: {
      recepcionId: recepcionAjena.id,
      insumoId: insumoAjeno.id,
      cantidad: 500,
      cantidadDisponible: 500,
      costoUnitario: 1,
      numeroLoteProveedor: loteProveedor,
    },
  });

  try {
    // La empresa 1 pregunta por ese mismo número de lote. No es suyo.
    const desdeLaUno = await prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId: "1" } },
        numeroLoteProveedor: loteProveedor,
      },
      select: { id: true },
    });
    assert.equal(desdeLaUno.length, 0, "el recall de una empresa alcanzó material de otra");

    // Y la dueña sí lo ve.
    const desdeLaSuya = await prisma.recepcionCompraDetalle.findMany({
      where: {
        recepcion: { ordenCompra: { empresaId: ajena } },
        numeroLoteProveedor: loteProveedor,
      },
      select: { id: true },
    });
    assert.equal(desdeLaSuya.length, 1);
    assert.equal(desdeLaSuya[0].id, detalleAjeno.id);
  } finally {
    await prisma.recepcionCompraDetalle.delete({ where: { id: detalleAjeno.id } }).catch(() => {});
    await prisma.recepcionCompra.delete({ where: { id: recepcionAjena.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: ordenAjena.id } }).catch(() => {});
    await prisma.insumo.delete({ where: { id: insumoAjeno.id } }).catch(() => {});
    await prisma.proveedor.delete({ where: { id: proveedorAjeno.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: ajena } }).catch(() => {});
  }
});

// --- La aritmética del alcance unido ----------------------------------------

test("un lote fabricado con dos descargas del mismo material sale en una sola fila", () => {
  // La consecuencia de unir los alcances: si el LG-00007 consumió 120 kg de una
  // descarga y 80 de la otra, lleva 200 kg de ese lote del proveedor. Dos filas
  // de 120 y 80 harían creer que son dos lotes distintos, y el informe diría
  // «2 lotes fabricados» donde hay uno.
  const comun = {
    loteGranelId: "lg-7",
    loteCodigo: "LG-00007",
    productoNombre: "Grasa EP-2",
    estadoLote: "APROBADO",
    destinos: [],
  };
  const consumos = lotesQueConsumieron([
    { ...comun, asignacion: { cantidad: 120, devoluciones: [] } },
    { ...comun, asignacion: { cantidad: 80, devoluciones: [] } },
  ]);
  assert.equal(consumos.length, 1, "el mismo lote apareció dos veces");
  assert.equal(consumos[0].cantidadConsumida, 200);
});

test("lo devuelto a almacén no cuenta, tampoco con el alcance ampliado", () => {
  // Una asignación devuelta por completo no es un consumo: acusar al lote de
  // llevar material que volvió al estante ampliaría el recall sin motivo.
  const consumos = lotesQueConsumieron([
    {
      loteGranelId: "lg-8",
      loteCodigo: "LG-00008",
      productoNombre: "Grasa EP-2",
      estadoLote: "APROBADO",
      asignacion: { cantidad: 50, devoluciones: [{ cantidad: 50 }] },
      destinos: [],
    },
  ]);
  assert.equal(consumos.length, 0);
});
