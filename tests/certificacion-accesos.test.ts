import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  avanceCampana,
  resumirConflictos,
  resumirPermisos,
  validarCertificacion,
} from "@/lib/certificacionAccesos";

// Certificar no es mirar una lista: es que alguien declare por escrito que
// cada acceso sigue siendo correcto, y que quede constancia de quién lo dijo.
// Lo que ya existía era una alerta de inactividad a 90 días, que avisa pero no
// deja esa constancia.

test("el resumen deja fuera lo que solo mira", () => {
  // Enumerar treinta permisos de lectura entierra los tres que importan.
  const resumen = resumirPermisos([
    { modulo: "ventas", puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAprobar: false },
    { modulo: "finanzas", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAprobar: true },
    { modulo: "rrhh", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAprobar: false },
  ]);
  assert.equal(resumen, "finanzas: aprobar · ventas: crear/editar");
  assert.ok(!resumen.includes("rrhh"), "el módulo de solo lectura no aporta a la revisión");
});

test("un grupo que solo mira se dice, no se deja en blanco", () => {
  assert.equal(
    resumirPermisos([
      { modulo: "ventas", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAprobar: false },
    ]),
    "Solo lectura"
  );
  assert.equal(resumirPermisos([]), "Solo lectura");
});

test("un conflicto de segregación se pone delante de quien revisa", () => {
  // La asignación ya los bloquea al guardar el grupo. Si igual aparece uno, es
  // justamente lo que una certificación tiene que mostrar.
  assert.equal(
    resumirConflictos([
      { modulo: "ventas", puedeCrear: true, puedeEditar: false, puedeAprobar: false },
    ]),
    null
  );
  const conflicto = resumirConflictos([
    { modulo: "finanzas", puedeCrear: true, puedeEditar: false, puedeAprobar: true },
  ]);
  assert.ok(conflicto);
  assert.match(conflicto, /Finanzas/);
});

test("nadie certifica su propio acceso", () => {
  // La mitad no ambigua de la segregación, la misma que ya rige en pedidos,
  // pagos, compras y vacaciones: un control que el controlado se firma solo no
  // es un control.
  const base = {
    estadoCampana: "ABIERTA",
    decision: "CONFIRMADO",
    motivo: "",
    usuarioRevisadoId: "u1",
    revisorId: "u2",
  };
  assert.equal(validarCertificacion(base), null);
  assert.equal(validarCertificacion({ ...base, revisorId: "u1" }), "PROPIO_ACCESO");
});

test("confirmar no necesita explicación; revocar sí", () => {
  const base = {
    estadoCampana: "ABIERTA",
    motivo: "",
    usuarioRevisadoId: "u1",
    revisorId: "u2",
  };
  assert.equal(validarCertificacion({ ...base, decision: "CONFIRMADO" }), null);
  // Revocar le quita el acceso a alguien: esa decisión tiene que poder releerse.
  assert.equal(validarCertificacion({ ...base, decision: "REVOCADO" }), "SIN_MOTIVO");
  assert.equal(
    validarCertificacion({ ...base, decision: "REVOCADO", motivo: "Cambió de área" }),
    null
  );
  assert.equal(
    validarCertificacion({ ...base, decision: "REVOCADO", motivo: "x".repeat(501) }),
    "MOTIVO_LARGO"
  );
});

test("una campaña cerrada no admite decisiones nuevas", () => {
  for (const estado of ["COMPLETADA", "CANCELADA"]) {
    assert.equal(
      validarCertificacion({
        estadoCampana: estado,
        decision: "CONFIRMADO",
        motivo: "",
        usuarioRevisadoId: "u1",
        revisorId: "u2",
      }),
      "CAMPANA_CERRADA",
      `estado ${estado}`
    );
  }
  // Y una decisión que no es ninguna de las dos tampoco pasa.
  assert.equal(
    validarCertificacion({
      estadoCampana: "ABIERTA",
      decision: "QUIZAS",
      motivo: "",
      usuarioRevisadoId: "u1",
      revisorId: "u2",
    }),
    "DECISION_INVALIDA"
  );
});

test("una campaña sin líneas nunca está completa", () => {
  // Si `completa` fuera cierto con cero líneas, una campaña vacía se cerraría
  // sola y diría haber certificado todo.
  assert.equal(avanceCampana([]).completa, false);
  assert.deepEqual(avanceCampana([{ decision: "CONFIRMADO" }, { decision: "REVOCADO" }]), {
    total: 2,
    pendientes: 0,
    confirmados: 1,
    revocados: 1,
    completa: true,
  });
  assert.equal(avanceCampana([{ decision: "PENDIENTE" }]).completa, false);
});

test("un usuario se certifica una sola vez por campaña", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-ca-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const usuario = await prisma.usuario.create({
    data: {
      empresaId,
      nombre: "Revisado",
      usuario: `rev-${sufijo}`,
      passwordHash: "x",
      rol: "VENTAS",
    },
  });
  const campana = await prisma.campanaCertificacionAccesos.create({
    data: {
      empresaId,
      numero: `CA-${sufijo}`,
      abiertaPorId: "u",
      abiertaPorNombre: "u",
      lineas: {
        create: [
          {
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre,
            usuarioLogin: usuario.usuario,
            rol: "VENTAS",
            permisosResumen: "Solo lectura",
          },
        ],
      },
    },
  });
  await assert.rejects(
    prisma.certificacionAcceso.create({
      data: {
        campanaId: campana.id,
        usuarioId: usuario.id,
        usuarioNombre: "Repetido",
        usuarioLogin: "repetido",
        rol: "VENTAS",
        permisosResumen: "Solo lectura",
      },
    })
  );

  // Un usuario con certificaciones no se borra: es la constancia de que
  // alguien revisó su acceso.
  await assert.rejects(prisma.usuario.delete({ where: { id: usuario.id } }));

  // Borrar la campaña sí se lleva sus líneas.
  await prisma.campanaCertificacionAccesos.delete({ where: { id: campana.id } });
  assert.equal(await prisma.certificacionAcceso.count({ where: { campanaId: campana.id } }), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("la campaña congela lo revisado en vez de leerlo vivo", async () => {
  // Certificar contra datos vivos no certifica nada: el revisor aprobaría algo
  // que cambia debajo suyo.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema
    .slice(
      esquema.indexOf("model CertificacionAcceso {"),
      esquema.indexOf("enum TipoUnidadManipulacion")
    )
    .replace(/^\s*\/\/.*$/gm, "");
  for (const campo of ["usuarioNombre", "usuarioLogin", "rol", "grupoNombre", "permisosResumen"]) {
    assert.match(modelo, new RegExp(`\\b${campo}\\b`), `falta la copia de ${campo}`);
  }
});

test("revocar aplica de verdad y queda auditado", async () => {
  // Una certificación donde marcar "revocar" no hace nada es teatro: el acceso
  // seguiría abierto y el papel diría que se quitó.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/certificacion-accesos/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function certificarAcceso"),
    acciones.indexOf("export async function completarCampana")
  );
  assert.ok(bloque.length > 0, "no se encontró la acción");
  assert.match(bloque, /decision === "REVOCADO"/);
  assert.match(bloque, /data: \{ activo: false \}/);
  assert.match(bloque, /accion: "DESACTIVAR"/);
  // El id llega del navegador y el cierre es optimista.
  assert.match(bloque, /findFirst\(\{\s*where: \{ id: lineaId, campana: \{ empresaId \} \}/);
  assert.match(bloque, /cerrada\.count !== 1/);
});

test("no se cierra una campaña con accesos sin revisar", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/certificacion-accesos/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function completarCampana"),
    acciones.indexOf("export async function cancelarCampana")
  );
  assert.match(bloque, /!avance\.completa/);
  assert.match(bloque, /a medias no certifica nada/);
});
