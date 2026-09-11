import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { postearAsiento } from "@/lib/contabilidad";

// `postearAsiento()` es best-effort a propósito: cuando no puede postear, la
// operación comercial NO se revierte. Lo que faltaba era el rastro — el
// `{ ok: false }` se descartaba en casi todos los llamadores y la transacción
// quedaba sin asiento en silencio. Ahora cada fallo deja una IncidenciaContable.

async function conEmpresa<T>(
  etiqueta: string,
  cuerpo: (empresaId: string) => Promise<T>
): Promise<T> {
  const empresaId = `empresa-${etiqueta}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  try {
    return await cuerpo(empresaId);
  } finally {
    await prisma.incidenciaContable.deleteMany({ where: { empresaId } });
    await prisma.asientoDetalle.deleteMany({ where: { asiento: { empresaId } } });
    await prisma.asientoContable.deleteMany({ where: { empresaId } });
    await prisma.controlContable.deleteMany({ where: { empresaId } });
    await prisma.cuentaContable.deleteMany({ where: { planCuentas: { empresaId } } });
    await prisma.libro.deleteMany({ where: { empresaId } });
    await prisma.planCuentas.deleteMany({ where: { empresaId } });
    await prisma.periodoFiscal.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
}

const ACTOR = { usuarioId: "u-prueba", usuarioNombre: "Contador de prueba" };

test("un control contable sin configurar deja incidencia, no silencio", async () => {
  await conEmpresa("incidencia-control", async (empresaId) => {
    const resultado = await prisma.$transaction((tx) =>
      postearAsiento(tx, {
        empresaId,
        origen: "VENTA",
        glosa: "Factura F001-00000123",
        referencia: "F001-00000123",
        lineas: [
          { clave: "CUENTAS_POR_COBRAR", debe: 118 },
          { clave: "VENTAS", haber: 118 },
        ],
        ...ACTOR,
      })
    );

    // El contrato con el llamador no cambia: sigue devolviendo ok:false.
    assert.equal(resultado.ok, false);
    assert.match(resultado.motivo ?? "", /Controles contables sin configurar/);

    const incidencias = await prisma.incidenciaContable.findMany({ where: { empresaId } });
    assert.equal(incidencias.length, 1);
    const [incidencia] = incidencias;
    assert.equal(incidencia.origen, "VENTA");
    assert.equal(incidencia.glosa, "Factura F001-00000123");
    assert.equal(incidencia.referencia, "F001-00000123");
    assert.equal(incidencia.usuarioNombre, "Contador de prueba");
    assert.equal(incidencia.resueltoEn, null);
    // El motivo dice exactamente qué falta, para que se pueda arreglar.
    assert.match(incidencia.motivo, /CUENTAS_POR_COBRAR|VENTAS/);
  });
});

test("un período cerrado deja incidencia con su motivo", async () => {
  await conEmpresa("incidencia-periodo", async (empresaId) => {
    const fecha = new Date(2025, 2, 15);
    await prisma.periodoFiscal.create({
      data: { empresaId, anio: 2025, mes: 3, estado: "CERRADO" },
    });

    const resultado = await prisma.$transaction((tx) =>
      postearAsiento(tx, {
        empresaId,
        origen: "COBRO",
        glosa: "Cobro de F001-00000999",
        fecha,
        lineas: [
          { clave: "CAJA_BANCOS", debe: 100 },
          { clave: "CUENTAS_POR_COBRAR", haber: 100 },
        ],
        ...ACTOR,
      })
    );

    assert.equal(resultado.ok, false);
    const incidencias = await prisma.incidenciaContable.findMany({ where: { empresaId } });
    assert.equal(incidencias.length, 1);
    assert.match(incidencias[0].motivo, /Período fiscal 3\/2025 cerrado/);
    assert.equal(incidencias[0].origen, "COBRO");
    // La fecha de la incidencia es la del asiento que no se pudo postear, no
    // la de hoy: es la que ubica el problema en el período correcto.
    assert.equal(incidencias[0].fecha.getFullYear(), 2025);
  });
});

test("un asiento descuadrado deja incidencia", async () => {
  await conEmpresa("incidencia-descuadre", async (empresaId) => {
    const plan = await prisma.planCuentas.create({
      data: { empresaId, codigo: "PCGE-PRUEBA", nombre: "Plan prueba" },
    });
    for (const [clave, codigo] of [
      ["CAJA_BANCOS", "TEST-101"],
      ["VENTAS", "TEST-701"],
    ] as const) {
      const cuenta = await prisma.cuentaContable.create({
        data: { planCuentasId: plan.id, codigo, nombre: codigo, tipo: "ACTIVO" },
      });
      await prisma.controlContable.create({ data: { empresaId, clave, cuentaId: cuenta.id } });
    }

    const resultado = await prisma.$transaction((tx) =>
      postearAsiento(tx, {
        empresaId,
        origen: "MANUAL",
        glosa: "Asiento que no cuadra",
        lineas: [
          { clave: "CAJA_BANCOS", debe: 100 },
          { clave: "VENTAS", haber: 70 },
        ],
        ...ACTOR,
      })
    );

    assert.equal(resultado.ok, false);
    const incidencias = await prisma.incidenciaContable.findMany({ where: { empresaId } });
    assert.equal(incidencias.length, 1);
    assert.match(incidencias[0].motivo, /descuadrado/);
  });
});

test("un asiento que sí postea no deja incidencia", async () => {
  await conEmpresa("incidencia-ok", async (empresaId) => {
    const plan = await prisma.planCuentas.create({
      data: { empresaId, codigo: "PCGE-PRUEBA", nombre: "Plan prueba" },
    });
    for (const [clave, codigo] of [
      ["CAJA_BANCOS", "TEST-101"],
      ["VENTAS", "TEST-701"],
    ] as const) {
      const cuenta = await prisma.cuentaContable.create({
        data: { planCuentasId: plan.id, codigo, nombre: codigo, tipo: "ACTIVO" },
      });
      await prisma.controlContable.create({ data: { empresaId, clave, cuentaId: cuenta.id } });
    }

    const resultado = await prisma.$transaction((tx) =>
      postearAsiento(tx, {
        empresaId,
        origen: "MANUAL",
        glosa: "Asiento correcto",
        lineas: [
          { clave: "CAJA_BANCOS", debe: 100 },
          { clave: "VENTAS", haber: 100 },
        ],
        ...ACTOR,
      })
    );

    assert.equal(resultado.ok, true);
    assert.equal(await prisma.incidenciaContable.count({ where: { empresaId } }), 0);
    assert.equal(await prisma.asientoContable.count({ where: { empresaId } }), 1);
  });
});

test("si la operación se revierte, su incidencia se revierte con ella", async () => {
  // La incidencia se escribe dentro de la transacción de la operación. Si la
  // operación falla y hace rollback, no debe quedar el aviso de un asiento que
  // nunca hizo falta.
  await conEmpresa("incidencia-rollback", async (empresaId) => {
    await assert.rejects(() =>
      prisma.$transaction(async (tx) => {
        await postearAsiento(tx, {
          empresaId,
          origen: "VENTA",
          glosa: "Venta que se revierte",
          lineas: [
            { clave: "CUENTAS_POR_COBRAR", debe: 50 },
            { clave: "VENTAS", haber: 50 },
          ],
          ...ACTOR,
        });
        throw new Error("la operación falla después de intentar postear");
      })
    );

    assert.equal(await prisma.incidenciaContable.count({ where: { empresaId } }), 0);
  });
});

test("las incidencias quedan acotadas a su compañía", async () => {
  await conEmpresa("incidencia-empresa-a", async (empresaA) => {
    await conEmpresa("incidencia-empresa-b", async (empresaB) => {
      for (const empresaId of [empresaA, empresaB]) {
        await prisma.$transaction((tx) =>
          postearAsiento(tx, {
            empresaId,
            origen: "COMPRA",
            glosa: `Compra de ${empresaId}`,
            lineas: [
              { clave: "INVENTARIO_INSUMOS", debe: 10 },
              { clave: "CUENTAS_POR_PAGAR", haber: 10 },
            ],
            ...ACTOR,
          })
        );
      }

      const deA = await prisma.incidenciaContable.findMany({ where: { empresaId: empresaA } });
      assert.equal(deA.length, 1);
      assert.equal(deA[0].glosa, `Compra de ${empresaA}`);
    });
  });
});

test("resolver deja constancia y no borra la incidencia", async () => {
  await conEmpresa("incidencia-resolver", async (empresaId) => {
    await prisma.$transaction((tx) =>
      postearAsiento(tx, {
        empresaId,
        origen: "PLANILLA",
        glosa: "Planilla marzo",
        lineas: [
          { clave: "SUELDOS_POR_PAGAR", haber: 1000 },
          { clave: "GASTO_PERSONAL", debe: 1000 },
        ],
        ...ACTOR,
      })
    );

    const [incidencia] = await prisma.incidenciaContable.findMany({ where: { empresaId } });

    const resuelta = await prisma.incidenciaContable.updateMany({
      where: { id: incidencia.id, empresaId, resueltoEn: null },
      data: {
        resueltoEn: new Date(),
        resueltoPorId: "u-contador",
        resueltoPorNombre: "Contadora",
        notaResolucion: "Asiento manual AS-00042",
      },
    });
    assert.equal(resuelta.count, 1);

    // Resolver dos veces no vuelve a contar: la condición resueltoEn: null es
    // lo que impide que dos personas la cierren a la vez.
    const segunda = await prisma.incidenciaContable.updateMany({
      where: { id: incidencia.id, empresaId, resueltoEn: null },
      data: { resueltoEn: new Date() },
    });
    assert.equal(segunda.count, 0);

    // La fila sigue ahí: el rastro del hueco no se borra.
    const final = await prisma.incidenciaContable.findUnique({ where: { id: incidencia.id } });
    assert.ok(final);
    assert.equal(final.notaResolucion, "Asiento manual AS-00042");
    assert.equal(final.motivo, incidencia.motivo);
  });
});

// --- Guardia estructural ----------------------------------------------------

test("todo camino de fallo de postearAsiento deja incidencia", async () => {
  // Si alguien agrega una salida `return { ok: false }` nueva sin pasar por
  // `sinAsiento()`, vuelve a existir un fallo contable silencioso. Es
  // exactamente la clase de defecto que este ciclo cerró, y ningún gate de
  // tipos o lint lo detecta.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/contabilidad.ts"), "utf8");
  const cuerpo = fuente.slice(
    fuente.indexOf("export async function postearAsiento"),
    fuente.indexOf("type Auditoria =")
  );
  assert.ok(cuerpo.length > 0, "no se encontró el cuerpo de postearAsiento");

  const salidasCrudas = [...cuerpo.matchAll(/return\s*\{[^}]*ok:\s*false(?!\s+as const)/g)];
  assert.deepEqual(
    salidasCrudas.map((m) => m[0]),
    [],
    "Cada salida ok:false de postearAsiento debe pasar por sinAsiento(), que deja la IncidenciaContable"
  );
  assert.ok(cuerpo.includes("incidenciaContable.create"), "sinAsiento() debe registrar la incidencia");
});

test("la pantalla de incidencias filtra por compañía activa", async () => {
  const pagina = await readFile(
    resolve(process.cwd(), "src/app/(app)/finanzas/incidencias-contables/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /obtenerEmpresaActivaId\(\)/);
  assert.match(pagina, /empresaId,/);

  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/finanzas/incidencias-contables/actions.ts"),
    "utf8"
  );
  // El id llega del navegador: la escritura tiene que condicionarse a la
  // compañía activa, no confiar en él.
  assert.match(acciones, /requerirRolEmpresaActiva/);
  assert.match(acciones, /updateMany/);
  assert.match(acciones, /empresaId: auth\.usuario\.empresaId/);
});
