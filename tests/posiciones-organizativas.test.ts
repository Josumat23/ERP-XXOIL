import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  cadenaDeMandoPosicion,
  creariaCicloPosicion,
  esPeriodoAsignacionValido,
  haySolapamientoDeOcupacion,
  ocupantesEnFecha,
  periodoCubreFecha,
  periodosSeSolapan,
  posicionesDeEmpleadoEnFecha,
  posicionesVacantesEnFecha,
} from "@/lib/posicionesOrganizativas";

const f = (texto: string) => new Date(`${texto}T00:00:00`);

test("una ocupación cubre desde su inicio y hasta el día anterior a su cierre", () => {
  const periodo = { vigenteDesde: f("2026-01-01"), vigenteHasta: f("2026-04-01") };
  assert.equal(periodoCubreFecha(periodo, f("2025-12-31")), false);
  assert.equal(periodoCubreFecha(periodo, f("2026-01-01")), true);
  assert.equal(periodoCubreFecha(periodo, f("2026-03-31")), true);
  // vigenteHasta es exclusivo: el día en que termina una ocupación es el
  // primer día de la siguiente, así no hay dos ocupantes ese día.
  assert.equal(periodoCubreFecha(periodo, f("2026-04-01")), false);

  const abierto = { vigenteDesde: f("2026-01-01"), vigenteHasta: null };
  assert.equal(periodoCubreFecha(abierto, f("2099-01-01")), true);
});

test("el solapamiento de períodos contempla las ocupaciones abiertas", () => {
  const enero = { vigenteDesde: f("2026-01-01"), vigenteHasta: f("2026-02-01") };
  const febrero = { vigenteDesde: f("2026-02-01"), vigenteHasta: f("2026-03-01") };
  // Consecutivos, no solapados: el fin de uno es el inicio del otro.
  assert.equal(periodosSeSolapan(enero, febrero), false);
  assert.equal(periodosSeSolapan(enero, { vigenteDesde: f("2026-01-15"), vigenteHasta: null }), true);
  assert.equal(periodosSeSolapan({ vigenteDesde: f("2026-01-01"), vigenteHasta: null }, febrero), true);
});

test("un período solo es válido si termina después de empezar", () => {
  assert.equal(esPeriodoAsignacionValido(f("2026-01-01"), null), true);
  assert.equal(esPeriodoAsignacionValido(f("2026-01-01"), f("2026-01-02")), true);
  assert.equal(esPeriodoAsignacionValido(f("2026-01-02"), f("2026-01-01")), false);
  // Mismo día: la ocupación no duraría nada.
  assert.equal(esPeriodoAsignacionValido(f("2026-01-01"), f("2026-01-01")), false);
  assert.equal(esPeriodoAsignacionValido(new Date("no-es-fecha"), null), false);
});

test("la misma persona no puede ocupar la misma posición dos veces a la vez", () => {
  const existentes = [
    {
      id: "a1",
      posicionId: "p1",
      empleadoId: "e1",
      vigenteDesde: f("2026-01-01"),
      vigenteHasta: f("2026-06-01"),
    },
  ];
  const solapada = {
    posicionId: "p1",
    empleadoId: "e1",
    vigenteDesde: f("2026-03-01"),
    vigenteHasta: null,
  };
  assert.equal(haySolapamientoDeOcupacion(solapada, existentes), true);
  // Editar la propia asignación no cuenta como conflicto consigo misma.
  assert.equal(haySolapamientoDeOcupacion(solapada, existentes, "a1"), false);
  // Otra persona en la misma posición no se bloquea: cuántos ocupantes admite
  // una posición es política de la empresa, no integridad de datos.
  assert.equal(
    haySolapamientoDeOcupacion({ ...solapada, empleadoId: "e2" }, existentes),
    false
  );
  // La misma persona en otra posición tampoco.
  assert.equal(
    haySolapamientoDeOcupacion({ ...solapada, posicionId: "p2" }, existentes),
    false
  );
});

test("las consultas por fecha reconstruyen quién ocupaba qué", () => {
  const asignaciones = [
    {
      id: "a1",
      posicionId: "jefe",
      empleadoId: "ana",
      vigenteDesde: f("2025-01-01"),
      vigenteHasta: f("2026-01-01"),
    },
    {
      id: "a2",
      posicionId: "jefe",
      empleadoId: "beto",
      vigenteDesde: f("2026-01-01"),
      vigenteHasta: null,
    },
    {
      id: "a3",
      posicionId: "analista",
      empleadoId: "ana",
      vigenteDesde: f("2026-01-01"),
      vigenteHasta: null,
    },
  ];

  assert.deepEqual(ocupantesEnFecha("jefe", f("2025-06-01"), asignaciones), ["ana"]);
  assert.deepEqual(ocupantesEnFecha("jefe", f("2026-06-01"), asignaciones), ["beto"]);
  assert.deepEqual(ocupantesEnFecha("jefe", f("2024-06-01"), asignaciones), []);
  assert.deepEqual(posicionesDeEmpleadoEnFecha("ana", f("2026-06-01"), asignaciones), ["analista"]);
  assert.deepEqual(
    posicionesVacantesEnFecha(["jefe", "analista", "vacia"], f("2026-06-01"), asignaciones),
    ["vacia"]
  );
});

test("la jerarquía de posiciones rechaza ciclos y expone la cadena de mando", () => {
  const posiciones = [
    { id: "gerencia", reportaAId: null },
    { id: "jefatura", reportaAId: "gerencia" },
    { id: "analista", reportaAId: "jefatura" },
  ];
  assert.deepEqual(cadenaDeMandoPosicion("analista", posiciones), ["jefatura", "gerencia"]);
  assert.deepEqual(cadenaDeMandoPosicion("gerencia", posiciones), []);
  assert.equal(creariaCicloPosicion("gerencia", "analista", posiciones), true);
  assert.equal(creariaCicloPosicion("gerencia", "gerencia", posiciones), true);
  assert.equal(creariaCicloPosicion("analista", null, posiciones), false);

  // Una fila corrupta con ciclo no debe colgar a quien recorra la cadena.
  const corrupto = [
    { id: "a", reportaAId: "b" },
    { id: "b", reportaAId: "a" },
  ];
  assert.deepEqual(cadenaDeMandoPosicion("a", corrupto), ["b"]);
});

test("una posición conserva el historial completo de sus ocupantes", async () => {
  const sufijo = Date.now().toString(36);
  const empresaId = `empresa-posicion-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const [ana, beto] = await Promise.all([
      prisma.empleado.create({
        data: {
          empresaId,
          codigo: `EMP-A-${sufijo}`,
          nombres: "Ana",
          apellidos: "Quispe",
          fechaIngreso: f("2024-01-01"),
          cargo: "Jefa",
          area: "Producción",
          tipoContrato: "PLAZO_INDETERMINADO",
        },
      }),
      prisma.empleado.create({
        data: {
          empresaId,
          codigo: `EMP-B-${sufijo}`,
          nombres: "Beto",
          apellidos: "Ramos",
          fechaIngreso: f("2025-01-01"),
          cargo: "Jefe",
          area: "Producción",
          tipoContrato: "PLAZO_INDETERMINADO",
        },
      }),
    ]);

    const gerencia = await prisma.posicionOrganizativa.create({
      data: {
        empresaId,
        codigo: "GER",
        titulo: "Gerencia de Operaciones",
        area: "Operaciones",
        usuarioId: "prueba",
        usuarioNombre: "Prueba",
      },
    });
    const jefatura = await prisma.posicionOrganizativa.create({
      data: {
        empresaId,
        codigo: "JEF-PROD",
        titulo: "Jefatura de Producción",
        area: "Producción",
        reportaAId: gerencia.id,
        usuarioId: "prueba",
        usuarioNombre: "Prueba",
      },
    });

    // Ana ocupa la jefatura durante 2025; Beto la toma en 2026.
    await prisma.asignacionPosicion.createMany({
      data: [
        {
          empresaId,
          posicionId: jefatura.id,
          empleadoId: ana.id,
          vigenteDesde: f("2025-01-01"),
          vigenteHasta: f("2026-01-01"),
          usuarioId: "prueba",
          usuarioNombre: "Prueba",
        },
        {
          empresaId,
          posicionId: jefatura.id,
          empleadoId: beto.id,
          vigenteDesde: f("2026-01-01"),
          usuarioId: "prueba",
          usuarioNombre: "Prueba",
        },
      ],
    });

    const periodos = await prisma.asignacionPosicion.findMany({
      where: { empresaId },
      select: {
        id: true,
        posicionId: true,
        empleadoId: true,
        vigenteDesde: true,
        vigenteHasta: true,
      },
    });

    // La pregunta que el campo de texto libre `cargo` nunca pudo responder.
    assert.deepEqual(ocupantesEnFecha(jefatura.id, f("2025-06-01"), periodos), [ana.id]);
    assert.deepEqual(ocupantesEnFecha(jefatura.id, f("2026-06-01"), periodos), [beto.id]);
    assert.deepEqual(
      posicionesVacantesEnFecha([gerencia.id, jefatura.id], f("2026-06-01"), periodos),
      [gerencia.id]
    );

    // Rotar el ocupante no borra al anterior.
    assert.equal(await prisma.asignacionPosicion.count({ where: { posicionId: jefatura.id } }), 2);

    // Una posición con historial no se borra en silencio.
    await assert.rejects(
      prisma.posicionOrganizativa.delete({ where: { id: jefatura.id } }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
    );

    // Ni la posición ni la asignación pueden colgar de una compañía inexistente.
    await assert.rejects(
      prisma.posicionOrganizativa.create({
        data: {
          empresaId: `inexistente-${sufijo}`,
          codigo: "X",
          titulo: "X",
          area: "X",
          usuarioId: "prueba",
          usuarioNombre: "Prueba",
        },
      }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2003"
    );
  } finally {
    await prisma.asignacionPosicion.deleteMany({ where: { empresaId } });
    for (const codigo of ["JEF-PROD", "GER"]) {
      await prisma.posicionOrganizativa.deleteMany({ where: { empresaId, codigo } });
    }
    await prisma.empleado.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("las aprobaciones de RR. HH. aplican la misma segregación que el resto", async () => {
  // pedidos, pagos y órdenes de compra ya usaban puedeResolverSolicitud, y los
  // cambios salariales bloqueaban al solicitante con una comprobación propia.
  // Las vacaciones eran la excepción: quien pedía podía aprobarse.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/rrhh/empleados/actions.ts"),
    "utf8"
  );
  const aprobar = acciones.slice(acciones.indexOf("export async function aprobarVacaciones"));
  const rechazar = acciones.slice(acciones.indexOf("export async function rechazarVacaciones"));
  assert.match(aprobar.slice(0, 1500), /puedeResolverSolicitud\(/);
  assert.match(rechazar.slice(0, 1500), /puedeResolverSolicitud\(/);
  // Los cambios salariales conservan su propia comprobación equivalente.
  assert.match(acciones, /cambio\.usuarioId === auth\.usuario\.id/);
});
