import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  contactoPara,
  emailPlausible,
  nombreCompleto,
  propositosSinContacto,
  validarContacto,
} from "@/lib/contactosCliente";

// En un distribuidor, quien aprueba el pedido no es quien recibe la factura ni
// quien atiende al camión. Había UN solo contacto en dos campos sueltos del
// cliente, así que el que quedaba escrito era el último que llamó.

const base = {
  nombres: "Rosa Mamani",
  email: "rosa@ferreteria.pe",
  telefono: null as string | null,
  celular: "953118220",
  paraPedidos: true,
  paraFacturacion: false,
  paraCobranza: false,
  paraDespacho: false,
  principal: true,
  activo: true,
};

test("marcar un contacto para algo exige por dónde avisarle", () => {
  // Sin canal sigue sirviendo como dato —saber quién decide vale— pero
  // marcarlo para un propósito es decir "a este avísenle".
  const sinCanal = { ...base, email: null, telefono: null, celular: null };
  assert.equal(validarContacto(sinCanal), "SIN_CANAL");
  // Sin marcar ningún propósito, un nombre suelto se acepta.
  assert.equal(
    validarContacto({ ...sinCanal, paraPedidos: false, principal: false }),
    null
  );
  // Y basta cualquiera de los tres canales.
  assert.equal(validarContacto({ ...sinCanal, telefono: "054-281900" }), null);
  assert.equal(validarContacto({ ...sinCanal, celular: "953118220" }), null);
  assert.equal(validarContacto({ ...sinCanal, email: "a@b.pe" }), null);
});

test("un contacto inactivo no puede ser el principal", () => {
  assert.equal(validarContacto({ ...base, activo: false }), "PRINCIPAL_INACTIVO");
  assert.equal(validarContacto({ ...base, activo: false, principal: false }), null);
});

test("el nombre es obligatorio y acotado", () => {
  assert.equal(validarContacto({ ...base, nombres: "   " }), "SIN_NOMBRE");
  assert.equal(validarContacto({ ...base, nombres: "x".repeat(121) }), "NOMBRE_LARGO");
});

test("el correo se comprueba sin fingir que se verifica", () => {
  // Deliberadamente simple: una expresión "completa" rechaza direcciones
  // válidas y da una falsa sensación de verificación.
  assert.equal(emailPlausible("rosa@ferreteria.pe"), true);
  assert.equal(emailPlausible("rosa.mamani+ventas@sub.dominio.com.pe"), true);
  assert.equal(emailPlausible("rosa"), false);
  assert.equal(emailPlausible("rosa@"), false);
  assert.equal(emailPlausible("@ferreteria.pe"), false);
  assert.equal(emailPlausible("rosa@ferreteria"), false);
  assert.equal(emailPlausible("rosa@ferreteria."), false);
  assert.equal(emailPlausible("ro sa@ferreteria.pe"), false);
  assert.equal(emailPlausible("a@b@c.pe"), false);
  assert.equal(validarContacto({ ...base, email: "rosa@sin-punto" }), "EMAIL_INVALIDO");
});

const contacto = (id: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id,
  activo: true,
  esPrincipal: null as boolean | null,
  paraPedidos: false,
  paraFacturacion: false,
  paraCobranza: false,
  paraDespacho: false,
  ...extra,
});

test("para cada propósito se busca a quien esté designado", () => {
  const lista = [
    contacto("gerente", { esPrincipal: true }),
    contacto("compras", { paraPedidos: true }),
    contacto("tesoreria", { paraCobranza: true, paraFacturacion: true }),
  ];
  assert.equal(contactoPara(lista, "PEDIDOS"), "compras");
  assert.equal(contactoPara(lista, "COBRANZA"), "tesoreria");
  assert.equal(contactoPara(lista, "FACTURACION"), "tesoreria");
  // Nadie marcado para despacho: cae en el principal, que es lo que hace una
  // persona cuando no encuentra a quién más llamar.
  assert.equal(contactoPara(lista, "DESPACHO"), "gerente");
});

test("entre varios designados gana el principal", () => {
  const lista = [
    contacto("a", { paraCobranza: true }),
    contacto("b", { paraCobranza: true, esPrincipal: true }),
  ];
  assert.equal(contactoPara(lista, "COBRANZA"), "b");
});

test("un contacto inactivo no se propone para nada", () => {
  const lista = [contacto("baja", { paraPedidos: true, activo: false })];
  assert.equal(contactoPara(lista, "PEDIDOS"), null);
  // Y sin ningún contacto activo se devuelve null: es información que falta,
  // no un hueco que haya que tapar eligiendo a cualquiera.
  assert.equal(contactoPara([], "PEDIDOS"), null);
});

test("se avisa qué propósitos no atiende nadie", () => {
  assert.deepEqual(propositosSinContacto([]), [
    "PEDIDOS",
    "FACTURACION",
    "COBRANZA",
    "DESPACHO",
  ]);
  // El principal no cuenta como comodín: la pregunta es si hay alguien
  // designado, y contestarla con "bueno, está el principal" es lo que se
  // quiere dejar de hacer.
  assert.deepEqual(propositosSinContacto([contacto("g", { esPrincipal: true })]), [
    "PEDIDOS",
    "FACTURACION",
    "COBRANZA",
    "DESPACHO",
  ]);
  const cubiertos = [
    contacto("a", { paraPedidos: true, paraDespacho: true }),
    contacto("b", { paraFacturacion: true, paraCobranza: true }),
  ];
  assert.deepEqual(propositosSinContacto(cubiertos), []);
});

test("el nombre completo no deja dobles espacios", () => {
  assert.equal(nombreCompleto({ nombres: "Rosa", apellidos: "Mamani" }), "Rosa Mamani");
  assert.equal(nombreCompleto({ nombres: "Rosa", apellidos: null }), "Rosa");
});

test("la base impide dos contactos principales", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-con-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Distribuidora" },
  });

  await prisma.contactoCliente.create({
    data: { empresaId, clienteId: cliente.id, nombres: "Gerente", esPrincipal: true },
  });
  await assert.rejects(
    prisma.contactoCliente.create({
      data: { empresaId, clienteId: cliente.id, nombres: "Otro gerente", esPrincipal: true },
    }),
    "dos principales deben chocar en la base"
  );

  // Varios secundarios conviven: los NULL no chocan entre sí.
  for (const nombre of ["Compras", "Tesorería", "Almacén"]) {
    await prisma.contactoCliente.create({
      data: { empresaId, clienteId: cliente.id, nombres: nombre },
    });
  }
  assert.equal(await prisma.contactoCliente.count({ where: { clienteId: cliente.id } }), 4);

  // Borrar el cliente se lleva sus contactos.
  await prisma.cliente.delete({ where: { id: cliente.id } });
  assert.equal(await prisma.contactoCliente.count({ where: { clienteId: cliente.id } }), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("la migración conserva el contacto que cada cliente ya tenía", async () => {
  const sql = await readFile(
    resolve(process.cwd(), "prisma/migraciones-sqlite-historico/20260914160000_customer_contacts/migration.sql"),
    "utf8"
  );
  assert.match(sql, /INSERT INTO "contactos_cliente"/);
  assert.match(sql, /FROM "clientes"/);
  assert.match(sql, /WHERE "contactoNombre" IS NOT NULL/);
});

test("esPrincipal nunca se guarda como false", async () => {
  // El índice único depende de que los no principales queden en NULL: un
  // `false` chocaría con el siguiente `false` y solo se podría tener un
  // secundario por cliente.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model ContactoCliente {"),
    esquema.indexOf("enum TipoDireccionCliente")
  );
  assert.match(modelo, /esPrincipal Boolean\?/);
  assert.doesNotMatch(modelo, /esPrincipal Boolean\s+@default/);
  assert.match(modelo, /@@unique\(\[clienteId, esPrincipal\]\)/);
});

test("las acciones de contactos acotan a la compañía activa", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/[id]/contactosActions.ts"),
    "utf8"
  );
  assert.match(acciones, /findFirst\(\{ where: \{ id: clienteId, empresaId \} \}\)/);
  assert.match(acciones, /where: \{ id: contactoId, empresaId, cliente: \{ empresaId \} \}/);
  // Desactivar, no borrar: el histórico dice a quién se le avisó.
  assert.match(acciones, /data: \{ activo: false, esPrincipal: null \}/);
  assert.doesNotMatch(acciones, /contactoCliente\.delete/);
  // Y el no principal se guarda como null, nunca false.
  assert.match(acciones, /esPrincipal: principal \? true : null/);
  assert.doesNotMatch(acciones, /esPrincipal: false/);
});
