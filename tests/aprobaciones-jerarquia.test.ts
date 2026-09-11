import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cadenaDeMando,
  evaluarJerarquiaAprobacion,
  type AlcanceAprobacion,
  type RelacionMando,
} from "@/lib/aprobacionesJerarquia";

// operario → supervisor → jefe → gerente
const ORGANIGRAMA: RelacionMando[] = [
  { id: "operario", jefeDirectoId: "supervisor" },
  { id: "supervisor", jefeDirectoId: "jefe" },
  { id: "jefe", jefeDirectoId: "gerente" },
  { id: "gerente", jefeDirectoId: null },
  { id: "contable", jefeDirectoId: "gerente" },
];

const TODOS_PUEDEN = new Set(["supervisor", "jefe", "gerente", "contable"]);

function evaluar(
  alcance: AlcanceAprobacion,
  aprobadorId: string | null,
  aprobadoresPosibles: ReadonlySet<string> = TODOS_PUEDEN,
) {
  return evaluarJerarquiaAprobacion({
    alcance,
    solicitanteId: "operario",
    aprobadorId,
    relaciones: ORGANIGRAMA,
    aprobadoresPosibles,
  });
}

test("la cadena de mando va del jefe directo hacia arriba", () => {
  assert.deepEqual(cadenaDeMando("operario", ORGANIGRAMA), ["supervisor", "jefe", "gerente"]);
  assert.deepEqual(cadenaDeMando("gerente", ORGANIGRAMA), []);
  assert.deepEqual(cadenaDeMando("inexistente", ORGANIGRAMA), []);

  // Un ciclo heredado no debe colgar la aprobación.
  const conCiclo: RelacionMando[] = [
    { id: "a", jefeDirectoId: "b" },
    { id: "b", jefeDirectoId: "a" },
  ];
  assert.deepEqual(cadenaDeMando("a", conCiclo), ["b"]);
});

test("sin jerarquía basta el permiso", () => {
  assert.equal(evaluar("SIN_JERARQUIA", "contable"), null);
  assert.equal(evaluar("SIN_JERARQUIA", null), null);
});

test("con jefe directo, solo el jefe directo resuelve", () => {
  assert.equal(evaluar("JEFE_DIRECTO", "supervisor"), null);
  // El jefe del jefe no alcanza con este alcance.
  assert.equal(evaluar("JEFE_DIRECTO", "jefe"), "NO_ES_JEFE_DIRECTO");
  assert.equal(evaluar("JEFE_DIRECTO", "contable"), "NO_ES_JEFE_DIRECTO");
  // Quien no tiene ficha de empleado no está en ninguna cadena.
  assert.equal(evaluar("JEFE_DIRECTO", null), "NO_ES_JEFE_DIRECTO");
});

test("con cadena de mando, cualquier superior resuelve", () => {
  assert.equal(evaluar("CADENA_MANDO", "supervisor"), null);
  assert.equal(evaluar("CADENA_MANDO", "jefe"), null);
  assert.equal(evaluar("CADENA_MANDO", "gerente"), null);
  // Un par que cuelga del mismo gerente no es superior del operario.
  assert.equal(evaluar("CADENA_MANDO", "contable"), "FUERA_DE_CADENA");
  assert.equal(evaluar("CADENA_MANDO", null), "FUERA_DE_CADENA");
});

test("el respaldo de RR. HH. evita dejar solicitudes sin quien las apruebe", () => {
  // Nadie de la cadena tiene cuenta activa: cualquiera con permiso resuelve.
  const soloContable = new Set(["contable"]);
  assert.equal(evaluar("CADENA_MANDO", "contable", soloContable), null);
  assert.equal(evaluar("JEFE_DIRECTO", "contable", soloContable), null);
  assert.equal(evaluar("CADENA_MANDO", null, soloContable), null);

  // Basta con que UNO de la cadena pueda, para que la regla se aplique.
  const soloGerente = new Set(["gerente", "contable"]);
  assert.equal(evaluar("CADENA_MANDO", "contable", soloGerente), "FUERA_DE_CADENA");
  assert.equal(evaluar("CADENA_MANDO", "gerente", soloGerente), null);

  // Con JEFE_DIRECTO el respaldo mira solo al jefe directo: si el supervisor
  // no puede, no sirve que sí pueda el gerente.
  assert.equal(evaluar("JEFE_DIRECTO", "contable", soloGerente), null);
});

test("un solicitante sin jefe nunca queda bloqueado", () => {
  const sinJefe = evaluarJerarquiaAprobacion({
    alcance: "CADENA_MANDO",
    solicitanteId: "gerente",
    aprobadorId: "contable",
    relaciones: ORGANIGRAMA,
    aprobadoresPosibles: TODOS_PUEDEN,
  });
  assert.equal(sinJefe, null);
});

test("las vacaciones aplican la regla configurada", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/rrhh/empleados/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /evaluarJerarquiaAprobacion\(/);
  // La segregación previa se conserva: quien pide no resuelve.
  assert.match(acciones, /puedeResolverSolicitud\(/);
  // Y la regla sale de la configuración, no está clavada en el código.
  assert.match(acciones, /alcanceAprobacionJerarquia/);
});
