import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  efectoReanalisis,
  validarReanalisis,
  vencimientoSugerido,
  type DatosReanalisis,
} from "@/lib/reanalisis";

// ---------------------------------------------------------------------------
// Un lubricante no se echa a perder al llegar su fecha: se vuelve a ensayar y,
// si sigue en especificación, se le da vigencia nueva. El negocio lo confirmó
// el 2026-09-16.
//
// Sin esto el vencimiento es duro y obliga a castigar stock bueno — que es lo
// que hacen los ERP genéricos, donde la caducidad es un dato del lote y no el
// resultado de una decisión de calidad.
//
// Lo que estas pruebas cuidan no es la fecha sino que **el registro no pueda
// decir algo que no pasó**: un ensayo rechazado no extiende nada.
// ---------------------------------------------------------------------------

const HOY = new Date(2026, 8, 16);
const enDias = (n: number) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);

const base: DatosReanalisis = {
  vencimientoActual: enDias(-10), // ya vencido, que es el caso normal
  vencimientoNuevo: enDias(180),
  resultado: "APROBADO",
  unidadesDisponibles: 40,
  hoy: HOY,
};

test("un lote vencido con ensayo aprobado recupera vigencia", () => {
  // El caso que motiva todo el módulo: stock bueno que la fecha dura habría
  // obligado a castigar.
  assert.equal(validarReanalisis(base), null);
});

test("un ensayo RECHAZADO no puede extender la vigencia", () => {
  // LA regla. Si pudiera, el re-análisis sería una forma de blanquear stock
  // vencido con un papel.
  assert.equal(
    validarReanalisis({ ...base, resultado: "RECHAZADO" }),
    "RECHAZADO_NO_EXTIENDE"
  );
});

test("un ensayo RECHAZADO sí puede acortar, que es lo esperable", () => {
  // El laboratorio lo encuentra fuera de especificación y lo deja vencido ya.
  // Prohibirlo obligaría a dejar el lote con una vigencia que nadie cree.
  assert.equal(
    validarReanalisis({
      ...base,
      vencimientoActual: enDias(90),
      vencimientoNuevo: enDias(-1),
      resultado: "RECHAZADO",
    }),
    null
  );
});

test("un producto sin vencimiento no se re-analiza", () => {
  // No hay vigencia que revisar, y el mensaje manda a cargar la vida útil si
  // el producto debería vencer.
  assert.equal(validarReanalisis({ ...base, vencimientoActual: null }), "SIN_VENCIMIENTO");
});

test("un lote sin saldo no se re-analiza", () => {
  // Extender la vigencia de algo que ya salió entero no cambia nada y ensucia
  // el historial con eventos sin efecto.
  assert.equal(validarReanalisis({ ...base, unidadesDisponibles: 0 }), "SIN_SALDO");
});

test("aprobar con un vencimiento ya pasado no deja el lote usable", () => {
  assert.equal(
    validarReanalisis({ ...base, vencimientoNuevo: enDias(-1) }),
    "VENCIMIENTO_EN_EL_PASADO"
  );
  // Hoy mismo sí vale: el lote sirve hoy.
  assert.equal(validarReanalisis({ ...base, vencimientoNuevo: HOY }), null);
});

test("registrar el mismo vencimiento no es un re-análisis", () => {
  assert.equal(
    validarReanalisis({ ...base, vencimientoActual: enDias(90), vencimientoNuevo: enDias(90) }),
    "SIN_CAMBIO"
  );
});

test("el historial dice qué hizo el ensayo, no solo qué fecha quedó", () => {
  // Una lista de fechas obliga a restar mentalmente en cada fila.
  const extendio = efectoReanalisis(new Date(2026, 8, 1), new Date(2027, 2, 1));
  assert.equal(extendio.sentido, "EXTENDIO");
  assert.equal(extendio.dias, 181);
  assert.match(extendio.texto, /Extendió 181 días/);

  const acorto = efectoReanalisis(new Date(2026, 8, 30), new Date(2026, 8, 29));
  assert.equal(acorto.sentido, "ACORTO");
  assert.match(acorto.texto, /Acortó 1 día$/, "singular cuando toca");
});

test("el vencimiento propuesto es una sugerencia, no una regla", () => {
  // Quien ensaya puede dar la vigencia que corresponda: imponerla sería que el
  // sistema decida algo que es del laboratorio.
  const sugerido = vencimientoSugerido(12, new Date(2026, 8, 16));
  assert.deepEqual(sugerido, new Date(2027, 8, 16));
  // Un producto sin vida útil no sugiere nada.
  assert.equal(vencimientoSugerido(null, HOY), null);
  assert.equal(vencimientoSugerido(0, HOY), null);
});

// --- Guardias estructurales -------------------------------------------------

test("el vencimiento anterior se conserva en el evento, no se deduce", async () => {
  // Cuando alguien lee el historial, el envasado ya fue actualizado: sin
  // guardar el anterior en la fila no habría contra qué comparar.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model ReanalisisEnvasado {"),
    esquema.indexOf("}", esquema.indexOf("model ReanalisisEnvasado {"))
  );
  assert.ok(modelo.length > 200, "el corte quedó vacío");
  assert.match(modelo, /vencimientoAnterior\s+DateTime/);
  assert.match(modelo, /vencimientoNuevo\s+DateTime/);
  // Quién, contra qué plan y con qué resultado: sin eso es cambiar una fecha.
  assert.match(modelo, /resultado\s+ResultadoCalidad/);
  assert.match(modelo, /planInspeccionId\s+String\?/);
  assert.match(modelo, /planVersion\s+Int\?/);
  assert.match(modelo, /usuarioId\s+String/);
});

test("la acción existe, valida con la librería y actualiza el envasado", async () => {
  // Una librería que nadie llama no protege nada, y un evento que no cambia el
  // vencimiento no sirve de nada: las dos mitades tienen que estar.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/envasados/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /export async function registrarReanalisis/);
  assert.match(acciones, /validarReanalisis\(/, "la acción no usa la validación compartida");
  assert.match(acciones, /reanalisisEnvasado\.create/, "no se asienta el evento");
  assert.match(acciones, /envasado\.update/, "el vencimiento no se actualiza");
  // El plan se valida contra la compañía activa: no se confía en el id del
  // formulario.
  assert.match(acciones, /planInspeccionCalidad\.findFirst/);
});

test("la pantalla deja registrar el re-análisis y muestra el historial", async () => {
  // Un campo que no se puede llenar desde ninguna pantalla es un campo muerto,
  // y un historial que no se ve no disuade de nada.
  const pagina = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/envasados/[id]/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /ReanalisisFormulario/);
  assert.match(pagina, /efectoReanalisis\(/, "el historial no dice qué hizo cada ensayo");
  assert.match(pagina, /reanalisis:/, "no se trae el historial");

  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/produccion/envasados/[id]/ReanalisisFormulario.tsx"),
    "utf8"
  );
  for (const campo of ["resultado", "vencimientoNuevo", "planInspeccionId", "observaciones"]) {
    assert.match(formulario, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
});
