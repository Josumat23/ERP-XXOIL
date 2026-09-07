import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluarConflictosSoD, REGLAS_CONFLICTO_SOD } from "@/lib/segregacionFunciones";

test("la matriz SoD declara exactamente los cuatro dominios con aprobación crítica", () => {
  assert.deepEqual(REGLAS_CONFLICTO_SOD.map((regla) => regla.modulo), [
    "materiales", "finanzas", "ventas", "rrhh",
  ]);
});

test("SoD bloquea crear o editar junto con aprobar en cada dominio crítico", () => {
  for (const regla of REGLAS_CONFLICTO_SOD) {
    for (const operacion of ["puedeCrear", "puedeEditar"] as const) {
      const conflictos = evaluarConflictosSoD([{
        modulo: regla.modulo,
        puedeCrear: operacion === "puedeCrear",
        puedeEditar: operacion === "puedeEditar",
        puedeAprobar: true,
      }]);
      assert.deepEqual(conflictos.map((conflicto) => conflicto.codigo), [regla.codigo]);
    }
  }
});

test("SoD acepta perfiles separados y no inventa reglas para otros módulos", () => {
  assert.deepEqual(evaluarConflictosSoD([
    { modulo: "ventas", puedeCrear: true, puedeEditar: true, puedeAprobar: false },
    { modulo: "rrhh", puedeCrear: false, puedeEditar: false, puedeAprobar: true },
    { modulo: "produccion", puedeCrear: true, puedeEditar: true, puedeAprobar: true },
    { modulo: "configuracion", puedeCrear: true, puedeEditar: true, puedeAprobar: true },
  ]), []);
});

test("SoD informa todos los conflictos existentes en orden estable", () => {
  const permisos = REGLAS_CONFLICTO_SOD.map((regla) => ({
    modulo: regla.modulo,
    puedeCrear: true,
    puedeEditar: true,
    puedeAprobar: true,
  }));
  assert.deepEqual(
    evaluarConflictosSoD(permisos).map((conflicto) => conflicto.codigo),
    REGLAS_CONFLICTO_SOD.map((regla) => regla.codigo),
  );
});
