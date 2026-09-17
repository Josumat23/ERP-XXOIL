import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  EXPLICACION_NIVEL_RECEPCION,
  NIVELES_CONTROL,
  controlDeRecepcion,
} from "@/lib/calibracion";

// ---------------------------------------------------------------------------
// La inspección de entrada deja de retener el material.
//
// Decisión del negocio (2026-09-17): todo insumo se compra y puede ir directo a
// producción, pase o no por laboratorio.
//
// Hasta acá, marcar un insumo como «requiere inspección» era un BLOQUEO duro y
// sin alternativa: la recepción no ingresaba el stock, así que la planta veía
// la materia prima en el almacén y no la podía usar. Es el bloqueo más caro del
// sistema y estaba puesto sin que nadie lo hubiera decidido — era el efecto
// secundario de una casilla del maestro de insumos.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();

// --- Qué hace cada nivel al recibir -----------------------------------------

test("un insumo que no requiere inspección entra directo, en cualquier nivel", () => {
  for (const nivel of NIVELES_CONTROL) {
    assert.deepEqual(controlDeRecepcion(nivel, false), {
      creaInspeccion: false,
      ingresaStock: true,
    });
  }
});

test("NO_APLICA ni siquiera crea la inspección", () => {
  assert.deepEqual(controlDeRecepcion("NO_APLICA", true), {
    creaInspeccion: false,
    ingresaStock: true,
  });
});

test("ADVIERTE crea la inspección Y deja pasar el material", () => {
  // Es el punto de todo el ciclo: el laboratorio se entera, y producción no
  // espera.
  assert.deepEqual(controlDeRecepcion("ADVIERTE", true), {
    creaInspeccion: true,
    ingresaStock: true,
  });
});

test("BLOQUEA retiene el material, que es el comportamiento anterior", () => {
  assert.deepEqual(controlDeRecepcion("BLOQUEA", true), {
    creaInspeccion: true,
    ingresaStock: false,
  });
});

test("la explicación de BLOQUEA advierte de lo que cuesta", () => {
  // Quien elige un nivel tiene que saber lo que está eligiendo: retener
  // material es el bloqueo más caro del sistema.
  assert.match(EXPLICACION_NIVEL_RECEPCION.BLOQUEA, /retenido|espera/i);
  assert.match(EXPLICACION_NIVEL_RECEPCION.ADVIERTE, /entra al stock/i);
});

test("marcar el insumo dice SI se mira; el nivel dice CUÁNTO pesa", () => {
  // Son dos decisiones distintas y estaban colapsadas en una: marcar el insumo
  // era, sin decirlo, elegir BLOQUEA.
  assert.equal(controlDeRecepcion("BLOQUEA", false).ingresaStock, true);
  assert.equal(controlDeRecepcion("BLOQUEA", true).ingresaStock, false);
});

// --- Que esté conectado -----------------------------------------------------

test("la recepción aplica el nivel de la compañía, no la casilla del insumo", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/ordenes-compra/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /controlDeRecepcion\(/, "la recepción no consulta el control");
  assert.match(
    acciones,
    /nivelInspeccionRecepcion/,
    "no lee el nivel de la configuración de la compañía"
  );
  // Y la decisión de retener ya no cuelga de `requiereInspeccion` a secas.
  assert.doesNotMatch(
    acciones,
    /if \(insumo\.requiereInspeccion\) \{/,
    "volvió a retener el material solo por estar marcado"
  );
});

test("aprobar la inspección no ingresa dos veces el mismo material", async () => {
  // Con el control en ADVIERTE el stock entró al recibirlo. Ingresarlo otra vez
  // al aprobar pondría el mismo material dos veces en el kardex y calcularía el
  // costo promedio sobre el doble de cantidad.
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/inspeccion-compras/actions.ts"),
    "utf8"
  );
  assert.match(
    acciones,
    /!inspeccion\.stockIngresadoEnRecepcion/,
    "no comprueba si el material ya había entrado"
  );
});

test("la pantalla ofrece los tres niveles y explica cada uno", async () => {
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/logistica/inspeccion-compras/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /NIVELES_CONTROL\.map/);
  assert.match(pagina, /fijarNivelInspeccionRecepcion\(/);
  assert.match(pagina, /EXPLICACION_NIVEL_RECEPCION/);
});

test("los dos controles comparten un solo tipo de nivel", async () => {
  // Dos enumeraciones idénticas terminan divergiendo: una gana un valor y la
  // otra no, y a partir de ahí hay que recordar cuál es cuál.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  assert.match(esquema, /nivelControlCalibracion\s+NivelControl/);
  assert.match(esquema, /nivelInspeccionRecepcion\s+NivelControl/);
  assert.doesNotMatch(esquema, /enum NivelControlCalibracion/);
});

test("el control de recepción nace sin frenar", async () => {
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  assert.match(esquema, /nivelInspeccionRecepcion\s+NivelControl\s+@default\(ADVIERTE\)/);
});

// --- Contra la base ---------------------------------------------------------

test("la compañía nace en ADVIERTE: la recepción no retiene material", async () => {
  const configuracion = await prisma.configuracionEmpresa.findFirst({ where: { empresaId: "1" } });
  assert.ok(configuracion);
  assert.equal(configuracion.nivelInspeccionRecepcion, "ADVIERTE");
});

test("una inspección recuerda si el material ya había entrado", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const proveedor = await prisma.proveedor.findFirstOrThrow({ where: { empresaId } });
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { empresaId } });

  const orden = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-NB-${sufijo}`,
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
      numero: `RC-NB-${sufijo}`,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const detalle = await prisma.recepcionCompraDetalle.create({
    data: {
      recepcionId: recepcion.id,
      insumoId: insumo.id,
      cantidad: 10,
      costoUnitario: 5,
      // Con el control en ADVIERTE el saldo entra al recibirlo.
      cantidadDisponible: 10,
    },
  });

  try {
    const inspeccion = await prisma.inspeccionCompra.create({
      data: {
        recepcionCompraDetalleId: detalle.id,
        resultado: "PENDIENTE",
        stockIngresadoEnRecepcion: true,
      },
    });
    assert.equal(inspeccion.stockIngresadoEnRecepcion, true);
    assert.equal(inspeccion.resultado, "PENDIENTE");

    // El material está disponible para producción aunque calidad no lo haya
    // mirado todavía. Es exactamente lo que el negocio pidió.
    const leido = await prisma.recepcionCompraDetalle.findUniqueOrThrow({
      where: { id: detalle.id },
    });
    assert.equal(leido.cantidadDisponible.toNumber(), 10);

    // Y las inspecciones viejas quedan en `false`: se crearon cuando la
    // recepción retenía, y su aprobación sigue siendo la que ingresa.
    const otra = await prisma.inspeccionCompra.create({
      data: { recepcionCompraDetalleId: detalle.id, resultado: "PENDIENTE" },
    }).catch(() => null);
    if (otra) {
      assert.equal(otra.stockIngresadoEnRecepcion, false);
      await prisma.inspeccionCompra.delete({ where: { id: otra.id } });
    }
  } finally {
    await prisma.inspeccionCompra.deleteMany({ where: { recepcionCompraDetalleId: detalle.id } });
    await prisma.recepcionCompraDetalle.delete({ where: { id: detalle.id } }).catch(() => {});
    await prisma.recepcionCompra.delete({ where: { id: recepcion.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: orden.id } }).catch(() => {});
  }
});
