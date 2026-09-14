import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  motivoNoOperable,
  tipoPersonaSegunRuc,
  validarIdentidad,
} from "@/lib/identidadCliente";

// El maestro distinguía "activo sí/no" y el negocio pidió tres estados. Y no
// sabía si un cliente era una persona o una empresa, dato del que dependen el
// comprobante que se le emite y qué documento puede tener.

test("el prefijo del RUC dice qué es el contribuyente, pero solo cuando es inequívoco", () => {
  // SUNAT estructura el RUC con dos dígitos iniciales: 10 persona natural,
  // 20 persona jurídica.
  assert.equal(tipoPersonaSegunRuc("10123456789"), "NATURAL");
  assert.equal(tipoPersonaSegunRuc("20123456789"), "JURIDICA");
  // Otros prefijos existen con historia y excepciones: clasificarlos por
  // cuenta propia sería inventar una regla tributaria.
  assert.equal(tipoPersonaSegunRuc("15123456789"), null);
  assert.equal(tipoPersonaSegunRuc("17123456789"), null);
  // Y lo que no es un RUC no se juzga.
  assert.equal(tipoPersonaSegunRuc("2012345678"), null, "10 dígitos no es un RUC");
  assert.equal(tipoPersonaSegunRuc("201234567890"), null, "12 dígitos tampoco");
  assert.equal(tipoPersonaSegunRuc(null), null);
  assert.equal(tipoPersonaSegunRuc("20-123456789"), null);
});

const base = {
  tipoPersona: "JURIDICA" as string | null,
  tipoDocumentoFiscal: "RUC",
  documento: "20123456789" as string | null,
  estado: "ACTIVO",
  motivoEstado: "",
};

test("una empresa no se identifica con DNI, carné ni pasaporte", () => {
  for (const doc of ["DNI", "CARNET_EXTRANJERIA", "PASAPORTE", "CI"]) {
    assert.equal(
      validarIdentidad({ ...base, tipoDocumentoFiscal: doc, documento: "12345678" }),
      "EMPRESA_CON_DOCUMENTO_DE_PERSONA",
      doc
    );
    // La misma combinación es correcta para una persona natural.
    assert.equal(
      validarIdentidad({
        ...base,
        tipoPersona: "NATURAL",
        tipoDocumentoFiscal: doc,
        documento: "12345678",
      }),
      null,
      doc
    );
  }
});

test("el RUC y el tipo de persona no pueden contradecirse", () => {
  // Un RUC que empieza en 10 es de persona natural: declarar la empresa es un
  // error de carga que después emite el comprobante equivocado.
  assert.equal(
    validarIdentidad({ ...base, documento: "10123456789" }),
    "TIPO_PERSONA_CONTRADICE_RUC"
  );
  assert.equal(
    validarIdentidad({ ...base, tipoPersona: "NATURAL", documento: "20123456789" }),
    "TIPO_PERSONA_CONTRADICE_RUC"
  );
  // Coherentes, pasan.
  assert.equal(validarIdentidad({ ...base, documento: "20123456789" }), null);
  assert.equal(
    validarIdentidad({ ...base, tipoPersona: "NATURAL", documento: "10123456789" }),
    null
  );
  // Un prefijo que no se juzga no bloquea la carga.
  assert.equal(validarIdentidad({ ...base, documento: "15123456789" }), null);
  // Y sin tipo de persona declarado no hay contradicción posible.
  assert.equal(validarIdentidad({ ...base, tipoPersona: null, documento: "10123456789" }), null);
});

test("bloquear o desactivar exige motivo; reactivar no", () => {
  // Es lo que va a leer quien lo reactive.
  assert.equal(validarIdentidad({ ...base, estado: "BLOQUEADO" }), "BLOQUEO_SIN_MOTIVO");
  assert.equal(validarIdentidad({ ...base, estado: "INACTIVO" }), "BLOQUEO_SIN_MOTIVO");
  assert.equal(
    validarIdentidad({ ...base, estado: "BLOQUEADO", motivoEstado: "Falta ficha RUC" }),
    null
  );
  assert.equal(validarIdentidad({ ...base, estado: "ACTIVO", motivoEstado: "" }), null);
  assert.equal(
    validarIdentidad({ ...base, estado: "BLOQUEADO", motivoEstado: "x".repeat(501) }),
    "MOTIVO_LARGO"
  );
});

test("el estado del maestro y el bloqueo de cobranza son dos controles, no uno", () => {
  // Fundirlos haría que regularizar una deuda desbloquee a un cliente que
  // legal había frenado.
  assert.equal(motivoNoOperable({ estado: "ACTIVO", bloqueadoCobranza: false }), null);
  assert.equal(motivoNoOperable({ estado: "ACTIVO", bloqueadoCobranza: true }), "COBRANZA");
  assert.equal(motivoNoOperable({ estado: "BLOQUEADO", bloqueadoCobranza: false }), "BLOQUEADO");
  assert.equal(motivoNoOperable({ estado: "INACTIVO", bloqueadoCobranza: false }), "INACTIVO");
  // Con los dos problemas manda el más grande, no el último que se evaluó.
  assert.equal(motivoNoOperable({ estado: "INACTIVO", bloqueadoCobranza: true }), "INACTIVO");
  assert.equal(motivoNoOperable({ estado: "BLOQUEADO", bloqueadoCobranza: true }), "BLOQUEADO");
});

// --- Guardias estructurales -------------------------------------------------

test("la migración traduce el booleano y no lo deja perder", async () => {
  // La redefinición de tabla borra la vieja en el mismo paso: si la traducción
  // no va dentro del INSERT, todos quedarían ACTIVO, incluidos los dados de
  // baja.
  const sql = await readFile(
    resolve(
      process.cwd(),
      "prisma/migrations/20260914180000_customer_identification/migration.sql"
    ),
    "utf8"
  );
  assert.match(sql, /CASE WHEN "activo" = 1 THEN 'ACTIVO' ELSE 'INACTIVO' END/);
  // Y deduce el tipo de persona solo donde el prefijo es inequívoco.
  assert.match(sql, /"ruc" LIKE '10%'[\s\S]*'NATURAL'/);
  assert.match(sql, /"ruc" LIKE '20%'[\s\S]*'JURIDICA'/);
  assert.match(sql, /ELSE NULL/);
});

test("el pedido comprueba los dos controles juntos", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /motivoNoOperable\(cliente\)/);
  // Y ya no filtra por el booleano viejo, que dejaría pasar un BLOQUEADO.
  assert.doesNotMatch(acciones, /cliente\.findFirst\(\{ where: \{ id: clienteId, empresaId, activo/);
});

test("ninguna consulta de cliente quedó filtrando por el campo viejo", async () => {
  // `activo` ya no existe en Cliente: una consulta olvidada no compilaría,
  // pero una escrita como string en un filtro dinámico sí pasaría.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(modelo.length > 500, "el corte del modelo quedó vacío: la guardia no miraría nada");
  assert.doesNotMatch(modelo, /^\s*activo\s+Boolean/m, "Cliente no debe volver a tener `activo`");
  assert.match(modelo, /estado\s+EstadoCliente\s+@default\(ACTIVO\)/);
  // El bloqueo de cobranza sigue existiendo y es otra cosa.
  assert.match(modelo, /bloqueadoCobranza\s+Boolean/);
});
