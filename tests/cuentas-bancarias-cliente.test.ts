import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { enmascarar, serializarCambiosMaestro } from "@/lib/auditoriaMaestros";
import {
  cciValido,
  cuentaParaAbonar,
  numeroParcial,
  validarCuenta,
} from "@/lib/cuentasBancariasCliente";

// Es el dato más delicado del maestro: un número de cuenta cambiado por quien
// no debía tocarlo es una transferencia que se va a otro lado.

const base = {
  banco: "BCP",
  tipoCuenta: "CORRIENTE",
  numeroCuenta: "193-1234567-0-89",
  cci: null as string | null,
  moneda: "PEN",
  principal: true,
  activa: true,
};

test("el CCI peruano tiene exactamente 20 dígitos", () => {
  assert.equal(cciValido("00219300123456708912"), true);
  assert.equal(cciValido("002-193-001234567089-12"), true, "los separadores no cuentan");
  assert.equal(cciValido("0021930012345670891"), false, "19 dígitos");
  assert.equal(cciValido("002193001234567089123"), false, "21 dígitos");
  assert.equal(cciValido(""), false);
});

test("el número de cuenta no se valida más de lo que se puede", () => {
  // Cada banco usa su propio largo y formato: inventar uno haría rechazar
  // cuentas buenas. Lo único común es que no lleva letras.
  assert.equal(validarCuenta(base), null);
  assert.equal(validarCuenta({ ...base, numeroCuenta: "19312345670" }), null);
  assert.equal(
    validarCuenta({ ...base, numeroCuenta: "cuenta del gerente" }),
    "NUMERO_INVALIDO"
  );
  assert.equal(validarCuenta({ ...base, numeroCuenta: "123" }), "NUMERO_INVALIDO");
  assert.equal(validarCuenta({ ...base, numeroCuenta: "   " }), "SIN_NUMERO");
});

test("el banco, el tipo y la moneda son obligatorios y acotados", () => {
  assert.equal(validarCuenta({ ...base, banco: "  " }), "SIN_BANCO");
  assert.equal(validarCuenta({ ...base, tipoCuenta: "PLAZO_FIJO" }), "TIPO_INVALIDO");
  assert.equal(validarCuenta({ ...base, moneda: "EUR" }), "MONEDA_INVALIDA");
  assert.equal(validarCuenta({ ...base, moneda: "USD" }), null);
});

test("un CCI mal escrito se rechaza, pero no tenerlo se acepta", () => {
  assert.equal(validarCuenta({ ...base, cci: "123" }), "CCI_INVALIDO");
  assert.equal(validarCuenta({ ...base, cci: "00219300123456708912" }), null);
  assert.equal(validarCuenta({ ...base, cci: null }), null);
  assert.equal(validarCuenta({ ...base, cci: "   " }), null, "vacío es no tenerlo");
});

test("una cuenta inactiva no puede ser la principal", () => {
  assert.equal(validarCuenta({ ...base, activa: false }), "PRINCIPAL_INACTIVA");
  assert.equal(validarCuenta({ ...base, activa: false, principal: false }), null);
});

test("no se elige cuenta cuando hay ambigüedad", () => {
  // Elegir a cuál de tres cuentas se transfiere plata no es una decisión que
  // corresponda automatizar.
  const dos = [
    { id: "a", activa: true, esPrincipal: null, moneda: "PEN" },
    { id: "b", activa: true, esPrincipal: null, moneda: "PEN" },
  ];
  assert.equal(cuentaParaAbonar(dos, "PEN"), null);
  assert.equal(cuentaParaAbonar([dos[0]], "PEN"), "a");
  assert.equal(
    cuentaParaAbonar([...dos, { id: "c", activa: true, esPrincipal: true, moneda: "PEN" }], "PEN"),
    "c"
  );
});

test("la moneda separa las cuentas", () => {
  const cuentas = [
    { id: "soles", activa: true, esPrincipal: true, moneda: "PEN" },
    { id: "dolares", activa: true, esPrincipal: null, moneda: "USD" },
  ];
  assert.equal(cuentaParaAbonar(cuentas, "PEN"), "soles");
  assert.equal(cuentaParaAbonar(cuentas, "USD"), "dolares", "la única en esa moneda");
  // Una principal en soles no sirve para abonar dólares.
  assert.equal(cuentaParaAbonar([cuentas[0]], "USD"), null);
});

test("una cuenta inactiva no se propone", () => {
  assert.equal(
    cuentaParaAbonar([{ id: "a", activa: false, esPrincipal: true, moneda: "PEN" }], "PEN"),
    null
  );
});

// --- El número no queda entero donde no corresponde -------------------------

test("la bitácora guarda el número enmascarado, no completo", () => {
  // Quien puede leer la auditoría no es necesariamente quien puede ver una
  // cuenta bancaria. Pero borrarlo del todo dejaría un registro inútil:
  // "alguien cambió la cuenta", sin decir cuál.
  const json = serializarCambiosMaestro({
    banco: "BCP",
    numeroCuenta: "19312345670089",
    cci: "00219300123456708912",
    titular: "visible",
  });
  assert.ok(json);
  assert.ok(!json.includes("19312345670089"), "el número completo no debe quedar en la bitácora");
  assert.ok(!json.includes("00219300123456708912"), "el CCI completo tampoco");
  assert.match(json, /0089/, "pero sí el final, para saber qué cuenta era");
  assert.match(json, /8912/);
  assert.match(json, /"banco":"BCP"/, "lo que no es sensible se ve entero");
  assert.match(json, /"titular":"visible"/);
});

test("enmascarar no filtra nada cuando el valor es corto", () => {
  assert.equal(enmascarar("1234"), "••••");
  assert.equal(enmascarar("12"), "••••");
  // Deja los ÚLTIMOS cuatro, que son los que identifican la cuenta.
  assert.equal(enmascarar("123456"), "••3456");
});

test("el número parcial que se muestra en pantalla deja solo el final", () => {
  assert.equal(numeroParcial("19312345670089"), "••••0089");
  assert.equal(numeroParcial("123"), "••••");
});

test("la base impide dos cuentas principales del mismo cliente", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-cta-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente con cuentas" },
  });

  await prisma.cuentaBancariaCliente.create({
    data: {
      empresaId,
      clienteId: cliente.id,
      banco: "BCP",
      numeroCuenta: "19312345670",
      esPrincipal: true,
    },
  });
  await assert.rejects(
    prisma.cuentaBancariaCliente.create({
      data: {
        empresaId,
        clienteId: cliente.id,
        banco: "BBVA",
        numeroCuenta: "00112345678",
        esPrincipal: true,
      },
    })
  );

  // Varias secundarias conviven.
  for (const banco of ["BBVA", "Interbank", "Scotiabank"]) {
    await prisma.cuentaBancariaCliente.create({
      data: { empresaId, clienteId: cliente.id, banco, numeroCuenta: "00112345678" },
    });
  }
  assert.equal(
    await prisma.cuentaBancariaCliente.count({ where: { clienteId: cliente.id } }),
    4
  );

  // Borrar el cliente se lleva sus cuentas.
  await prisma.cliente.delete({ where: { id: cliente.id } });
  assert.equal(
    await prisma.cuentaBancariaCliente.count({ where: { clienteId: cliente.id } }),
    0
  );
});

// --- Guardias estructurales -------------------------------------------------

test("las cuentas las administra Finanzas, no Ventas", async () => {
  // El resto de la ficha la edita Ventas. Acá no: es el punto del bloque.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/[id]/cuentasActions.ts"),
    "utf8"
  );
  assert.match(acciones, /puedeRealizar\(auth\.usuario, "finanzas", "editar"\)/);
  assert.ok(!/"ventas"/.test(acciones), "no debe autorizarse con el permiso de Ventas");
  // Y acotadas a la compañía activa, como todo lo demás.
  assert.match(acciones, /where: \{ id: cuentaId, empresaId, cliente: \{ empresaId \} \}/);
  // Desactivar, no borrar: hay cobros que apuntan a la cuenta usada.
  assert.match(acciones, /data: \{ activa: false, esPrincipal: null \}/);
  assert.doesNotMatch(acciones, /cuentaBancariaCliente\.delete/);
});

test("el enmascarado cubre número y CCI", async () => {
  const fuente = await readFile(resolve(process.cwd(), "src/lib/auditoriaMaestros.ts"), "utf8");
  assert.match(fuente, /CAMPOS_ENMASCARADOS = new Set\(\["numeroCuenta", "cci"\]\)/);
  // Y los secretos siguen borrándose del todo, no enmascarados.
  assert.match(fuente, /CAMPOS_SENSIBLES\.has\(clave\)\) return "\[PROTEGIDO\]"/);
});
