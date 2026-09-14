import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  dentroDeVentana,
  depositoComprometido,
  diaIso,
  horaAMinutos,
  minutosAHora,
  recibeEseDia,
  resumenDias,
  saldoCascos,
  validarVentana,
  type DiasRecepcion,
} from "@/lib/logisticaCliente";

// La ventana horaria y los días de recepción son propiedades del LUGAR, no del
// cliente: una minera recibe en su planta de martes a jueves de 8 a 12 con
// inducción de seguridad, y en su almacén de puerto todos los días.

const todos: DiasRecepcion = {
  recibeLunes: true,
  recibeMartes: true,
  recibeMiercoles: true,
  recibeJueves: true,
  recibeViernes: true,
  recibeSabado: true,
  recibeDomingo: true,
};
const ninguno: DiasRecepcion = {
  recibeLunes: false,
  recibeMartes: false,
  recibeMiercoles: false,
  recibeJueves: false,
  recibeViernes: false,
  recibeSabado: false,
  recibeDomingo: false,
};

test("media ventana no dice nada", () => {
  // «Recibe desde las 8» sin hora de cierre no permite decidir si un camión
  // llega a tiempo.
  assert.equal(validarVentana({ inicio: 480, fin: null, dias: todos }), "VENTANA_INCOMPLETA");
  assert.equal(validarVentana({ inicio: null, fin: 720, dias: todos }), "VENTANA_INCOMPLETA");
  // Ninguna de las dos es válido: recibe a cualquier hora.
  assert.equal(validarVentana({ inicio: null, fin: null, dias: todos }), null);
});

test("inicio igual a fin es ambiguo y se rechaza", () => {
  // ¿Cero minutos o veinticuatro horas? Lo dice quien carga, no el sistema.
  assert.equal(validarVentana({ inicio: 480, fin: 480, dias: todos }), "VENTANA_VACIA");
});

test("una ventana sin ningún día no permitiría entregar nunca", () => {
  assert.equal(validarVentana({ inicio: 480, fin: 720, dias: ninguno }), "SIN_DIAS");
});

test("las horas se validan como horas", () => {
  assert.equal(validarVentana({ inicio: -1, fin: 720, dias: todos }), "HORA_FUERA_DE_RANGO");
  assert.equal(validarVentana({ inicio: 480, fin: 1440, dias: todos }), "HORA_FUERA_DE_RANGO");
  assert.equal(validarVentana({ inicio: 480, fin: 1439, dias: todos }), null);
});

test("una ventana que cruza medianoche es el turno noche de una mina", () => {
  const nocturna = { inicio: 22 * 60, fin: 6 * 60 };
  assert.equal(dentroDeVentana(23 * 60, nocturna), true, "23:00 está dentro");
  assert.equal(dentroDeVentana(2 * 60, nocturna), true, "02:00 está dentro");
  assert.equal(dentroDeVentana(12 * 60, nocturna), false, "mediodía no");
  assert.equal(dentroDeVentana(22 * 60, nocturna), true, "el borde inicial entra");
  assert.equal(dentroDeVentana(6 * 60, nocturna), false, "el borde final no");

  const diurna = { inicio: 8 * 60, fin: 12 * 60 };
  assert.equal(dentroDeVentana(10 * 60, diurna), true);
  assert.equal(dentroDeVentana(7 * 60, diurna), false);
  assert.equal(dentroDeVentana(13 * 60, diurna), false);

  // Sin ventana declarada, cualquier hora sirve.
  assert.equal(dentroDeVentana(3 * 60, { inicio: null, fin: null }), true);
});

test("el domingo es 7, no 0", () => {
  // `Date.getDay()` devuelve 0 para domingo; confundirlo deja el domingo fuera
  // de cualquier comparación ISO.
  assert.equal(diaIso(new Date(2026, 8, 13)), 7, "13/09/2026 es domingo");
  assert.equal(diaIso(new Date(2026, 8, 14)), 1, "14/09/2026 es lunes");
  assert.equal(diaIso(new Date(2026, 8, 19)), 6, "19/09/2026 es sábado");
});

test("recibeEseDia mira el día que corresponde", () => {
  const soloMartesYJueves: DiasRecepcion = { ...ninguno, recibeMartes: true, recibeJueves: true };
  assert.equal(recibeEseDia(soloMartesYJueves, new Date(2026, 8, 15)), true, "martes");
  assert.equal(recibeEseDia(soloMartesYJueves, new Date(2026, 8, 17)), true, "jueves");
  assert.equal(recibeEseDia(soloMartesYJueves, new Date(2026, 8, 16)), false, "miércoles");
  assert.equal(recibeEseDia(soloMartesYJueves, new Date(2026, 8, 13)), false, "domingo");
});

test("las horas van y vuelven sin perderse", () => {
  assert.equal(minutosAHora(510), "08:30");
  assert.equal(minutosAHora(0), "00:00");
  assert.equal(minutosAHora(1439), "23:59");
  assert.equal(minutosAHora(null), "");
  assert.equal(horaAMinutos("08:30"), 510);
  assert.equal(horaAMinutos("8:30"), 510);
  assert.equal(horaAMinutos(""), null);
  assert.ok(Number.isNaN(horaAMinutos("media mañana")));
  assert.ok(Number.isNaN(horaAMinutos("25:00")));
  assert.ok(Number.isNaN(horaAMinutos("08:70")));
});

test("el resumen de días agrupa el caso completo", () => {
  assert.equal(resumenDias(todos), "Todos los días");
  assert.equal(resumenDias(ninguno), "Ningún día");
  assert.equal(
    resumenDias({ ...ninguno, recibeMartes: true, recibeJueves: true }),
    "Mar, Jue"
  );
});

// --- Cascos retornables -----------------------------------------------------

test("el saldo de cascos se calcula, no se guarda", () => {
  const saldos = saldoCascos([
    { insumoId: "tambor", tipo: "ENTREGADO", cantidad: 10 },
    { insumoId: "tambor", tipo: "DEVUELTO", cantidad: 4 },
    { insumoId: "cilindro", tipo: "ENTREGADO", cantidad: 3 },
  ]);
  assert.deepEqual(saldos, [
    { insumoId: "tambor", pendientes: 6 },
    { insumoId: "cilindro", pendientes: 3 },
  ]);
});

test("un envase enteramente devuelto desaparece del saldo", () => {
  const saldos = saldoCascos([
    { insumoId: "tambor", tipo: "ENTREGADO", cantidad: 5 },
    { insumoId: "tambor", tipo: "DEVUELTO", cantidad: 5 },
  ]);
  assert.deepEqual(saldos, []);
});

test("un saldo negativo se muestra, no se esconde", () => {
  // Más devoluciones que entregas es un error de carga que hay que ver.
  const saldos = saldoCascos([
    { insumoId: "tambor", tipo: "ENTREGADO", cantidad: 2 },
    { insumoId: "tambor", tipo: "DEVUELTO", cantidad: 5 },
  ]);
  assert.deepEqual(saldos, [{ insumoId: "tambor", pendientes: -3 }]);
});

test("el depósito comprometido no cobra por saldos negativos", () => {
  const saldos = [
    { insumoId: "tambor", pendientes: 6 },
    { insumoId: "cilindro", pendientes: -2 },
  ];
  // 6 tambores × 120 = 720. El cilindro en negativo no resta plata: es un
  // error de carga, no un crédito a favor del cliente.
  assert.equal(depositoComprometido(saldos, { tambor: 120, cilindro: 80 }), 720);
  // Un envase sin depósito configurado aporta cero, no rompe.
  assert.equal(depositoComprometido(saldos, {}), 0);
});

// --- Guardias estructurales -------------------------------------------------

test("la ventana y los días viven en la dirección, no en el cliente", async () => {
  // Una misma minera recibe distinto en su planta y en su almacén de puerto:
  // ponerlos en el cliente obligaría a elegir uno de los dos.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const direccion = esquema.slice(
    esquema.indexOf("model DireccionCliente {"),
    esquema.indexOf("model ContactoCliente {")
  );
  assert.ok(direccion.length > 500, "el corte quedó vacío: la guardia no miraría nada");
  for (const campo of [
    "ventanaInicioMin",
    "ventanaFinMin",
    "recibeLunes",
    "recibeDomingo",
    "requisitosEntrega",
    "restriccionesVehiculares",
  ]) {
    assert.ok(direccion.includes(campo), `falta ${campo} en DireccionCliente`);
  }

  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(cliente.length > 500);
  // Y lo que sí es del cliente: desde dónde y con quién se despacha.
  for (const campo of ["almacenDespachoId", "transportistaPreferidoId", "frecuenciaReparto"]) {
    assert.ok(cliente.includes(campo), `falta ${campo} en Cliente`);
  }
  // La ventana NO está duplicada en el cliente.
  assert.ok(!cliente.includes("ventanaInicioMin"), "la ventana no debe duplicarse en el cliente");
});

test("el saldo de cascos no se guarda en el maestro", async () => {
  // El negocio lo pidió expresamente: saldos, facturas y pagos se calculan
  // desde los movimientos. Un número guardado se desincroniza.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(!/cascosPendientes|saldoCascos\s+Int/.test(cliente));
});

test("una hora que no es hora se rechaza, no se guarda como NaN", () => {
  // El formulario manda texto: «media mañana» llega como NaN, que no es mayor
  // ni menor que nada y pasaría una comparación de rango sin que nadie lo vea.
  assert.equal(
    validarVentana({ inicio: horaAMinutos("media mañana"), fin: 720, dias: todos }),
    "HORA_FUERA_DE_RANGO"
  );
  assert.equal(
    validarVentana({ inicio: 480, fin: horaAMinutos("25:00"), dias: todos }),
    "HORA_FUERA_DE_RANGO"
  );
});

test("la acción valida la ventana solo en las direcciones de entrega", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/clientes/[id]/direccionesActions.ts"),
    "utf8"
  );
  assert.match(acciones, /if \(datos\.tipo === "ENTREGA"\)/);
  assert.match(acciones, /validarVentana\(/);
  // Y la hora se convierte con el ayudante, no parseando a mano.
  assert.match(acciones, /horaAMinutos\(String\(formData\.get\("ventanaInicio"\)/);
});
