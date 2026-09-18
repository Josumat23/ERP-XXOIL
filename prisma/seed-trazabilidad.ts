// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import { siguienteNumeroReclamo } from "../src/lib/correlativos";

// ---------------------------------------------------------------------------
// Los datos que hacen usable la trazabilidad / recall.
//
// Dos cosas que el sistema sabe registrar y que los sembradores no llenaban, y
// sin las cuales la pantalla se podía abrir pero no estrenar: el número de lote
// del proveedor en las recepciones, y a quién llamar en cada cliente.
//
// ---------------------------------------------------------------------------
// 1. El número de lote del proveedor en las recepciones de prueba.
//
// La pantalla de trazabilidad / recall contesta «¿a quién le llegó este
// material?» entrando por el lote del PROVEEDOR, que es el dato con el que
// llama quien reporta el problema: «el L-2026-014 salió con la viscosidad
// fuera». Las recepciones que siembra `seed-demo.ts` no traen ese número
// —el campo es opcional y nadie lo llenaba—, así que la pantalla se podía
// abrir pero no se podía estrenar: no había con qué buscar.
//
// Este sembrador solo COMPLETA ese dato. No crea recepciones, no mueve stock,
// no toca costos ni contabilidad: escribe un campo informativo que estaba en
// null. Es la corrección más barata posible y deja la cadena entera visible.
//
// ---------------------------------------------------------------------------
// Por qué dos recepciones comparten lote
//
// Un lote del proveedor casi nunca llega en una sola descarga: se compra por
// cisterna o por tanda y entra en varias recepciones. Ese es justamente el
// caso que la pantalla tiene que saber contestar, porque consultar una sola
// devuelve la mitad de lo fabricado con cara de respuesta completa.
//
// Por eso, cuando un material tiene dos o más recepciones, las dos primeras
// quedan bajo el mismo número de lote. Si alguna de las dos ya traía uno, se
// respeta el suyo y la otra se alinea; no se pisa un dato cargado a mano.
//
// Si ningún material se recibió más de una vez, no se inventa una recepción
// para que el caso exista: se avisa y listo.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: crearAdaptador() });

const EMPRESA_ID = "1";

/** `MP-ACEITE-BASE` → `ACEITE-BASE-2026-001`. Determinista, para que una segunda corrida no cambie nada. */
function numeroDeLote(codigoInsumo: string, anio: number, indice: number): string {
  const corto = codigoInsumo.replace(/^(MP|ENV|ETQ)-/, "");
  return `${corto}-${anio}-${String(indice).padStart(3, "0")}`;
}

async function main() {
  const empresa = await prisma.empresa.findUnique({ where: { id: EMPRESA_ID } });
  if (!empresa) {
    console.error(`No existe la compañía ${EMPRESA_ID}. Corra primero \`npm run seed:demo\`.`);
    process.exit(1);
  }

  // Solo materia prima: es la que entra en un lote de fabricación y la que se
  // rastrea hacia el cliente. Envases y etiquetas se consumen al envasar y no
  // cuelgan de `AsignacionLoteInsumo`.
  const detalles = await prisma.recepcionCompraDetalle.findMany({
    where: {
      recepcion: { ordenCompra: { empresaId: EMPRESA_ID } },
      insumo: { tipo: "MATERIA_PRIMA" },
    },
    select: {
      id: true,
      numeroLoteProveedor: true,
      insumoId: true,
      insumo: { select: { codigo: true, nombre: true } },
      recepcion: { select: { numero: true, fecha: true } },
    },
    orderBy: [{ recepcion: { fecha: "asc" } }, { recepcion: { numero: "asc" } }],
  });

  if (detalles.length === 0) {
    console.log("No hay recepciones de materia prima. Corra primero `npm run seed:demo`.");
    return;
  }

  const porInsumo = new Map<string, typeof detalles>();
  for (const d of detalles) {
    const grupo = porInsumo.get(d.insumoId) ?? [];
    grupo.push(d);
    porInsumo.set(d.insumoId, grupo);
  }

  let escritos = 0;
  let compartidos = 0;
  for (const grupo of porInsumo.values()) {
    const codigo = grupo[0].insumo.codigo;
    const anio = grupo[0].recepcion.fecha.getFullYear();

    // Las dos primeras descargas del material van bajo el mismo lote.
    const compartidas = grupo.length >= 2 ? grupo.slice(0, 2) : [];
    const loteCompartido =
      compartidas.find((d) => d.numeroLoteProveedor)?.numeroLoteProveedor ??
      numeroDeLote(codigo, anio, 1);

    for (const [i, d] of grupo.entries()) {
      const esperado = compartidas.includes(d)
        ? loteCompartido
        : (d.numeroLoteProveedor ?? numeroDeLote(codigo, anio, i + 1));
      if (d.numeroLoteProveedor === esperado) continue;
      await prisma.recepcionCompraDetalle.update({
        where: { id: d.id },
        data: { numeroLoteProveedor: esperado },
      });
      escritos += 1;
      console.log(`${d.recepcion.numero} · ${codigo} → lote del proveedor ${esperado}`);
    }

    if (compartidas.length === 2) {
      compartidos += 1;
      console.log(
        `  ${codigo}: ${compartidas.map((d) => d.recepcion.numero).join(" y ")} son el mismo lote ${loteCompartido}.`
      );
    }
  }

  console.log(`\nNúmeros de lote del proveedor escritos: ${escritos}.`);
  if (compartidos === 0) {
    console.log(
      "Ningún material se recibió más de una vez, así que no hay lote repartido en varias\n" +
        "recepciones. La pantalla de recall funciona igual; el aviso de «alcance ampliado»\n" +
        "solo aparecerá cuando exista ese caso."
    );
  } else {
    console.log(
      "Trazabilidad / recall ya tiene con qué buscar: elija un material recibido y, si su\n" +
        "lote llegó en más de una recepción, la pantalla ofrece ampliar el alcance a todas."
    );
  }

  await sembrarContactosDeDespacho();
  await sembrarReclamoDeEjemplo();
}

// ---------------------------------------------------------------------------
// 2. A quién llamar en cada cliente.
//
// «A quiénes hay que avisar» muestra el contacto de DESPACHO —quien atiende la
// mercadería— y, si nadie está designado, cae en los datos de la empresa. Los
// clientes sembrados no tienen ni un contacto cargado, así que la pantalla solo
// podía mostrar el camino de respaldo.
//
// Las personas son INVENTADAS, igual que las marcas de la competencia en
// `seed-calidad.ts`: un sembrador viaja con el repositorio y termina en demos y
// capturas, y poner ahí el nombre y el celular de alguien real es publicar el
// dato de un tercero. Los números arrancan en 9 como los celulares peruanos y
// no corresponden a ninguna línea asignada.
//
// Se siembra uno solo por cliente y solo si el cliente no tiene ninguno: el que
// alguien cargó a mano no se toca.
// ---------------------------------------------------------------------------
const CONTACTOS_DE_PRUEBA = [
  { nombres: "Rosa", apellidos: "Quispe Mamani", cargo: "Jefa de almacén", celular: "900000101" },
  { nombres: "Julio", apellidos: "Paredes Chávez", cargo: "Encargado de recepción", celular: "900000102" },
  { nombres: "Elena", apellidos: "Vargas Ríos", cargo: "Supervisora de despacho", celular: "900000103" },
  { nombres: "Marco", apellidos: "Salazar Nuñez", cargo: "Jefe de logística", celular: "900000104" },
  { nombres: "Pilar", apellidos: "Ccahuana Soto", cargo: "Administradora", celular: "900000105" },
];

async function sembrarContactosDeDespacho() {
  const clientes = await prisma.cliente.findMany({
    where: { empresaId: EMPRESA_ID, contactos: { none: {} } },
    select: { id: true, codigo: true, razonSocial: true },
    orderBy: { codigo: "asc" },
  });

  if (clientes.length === 0) {
    console.log("\nTodos los clientes ya tienen contactos cargados: no se toca ninguno.");
    return;
  }

  let creados = 0;
  for (const [i, cliente] of clientes.entries()) {
    const persona = CONTACTOS_DE_PRUEBA[i % CONTACTOS_DE_PRUEBA.length];
    await prisma.contactoCliente.create({
      data: {
        empresaId: EMPRESA_ID,
        clienteId: cliente.id,
        ...persona,
        email: `${persona.nombres.toLowerCase()}@${cliente.codigo.toLowerCase()}.ejemplo.pe`,
        paraDespacho: true,
        esPrincipal: true,
      },
    });
    creados += 1;
    console.log(`${cliente.codigo} → ${persona.nombres} ${persona.apellidos} (despacho)`);
  }
  console.log(
    `\nContactos de despacho creados: ${creados}. Son personas inventadas, para que\n` +
      "«A quiénes hay que avisar» muestre a quién llamar y no solo el teléfono de la empresa."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// ---------------------------------------------------------------------------
// 3. Un reclamo de cliente atado a una venta real.
//
// «De qué lote salió» deriva el lote desde la factura del reclamo. Sin un
// reclamo cargado, la sección no se puede ver ni probar a mano, y la base
// sembrada no trae ninguno.
//
// Se elige una factura que de verdad llevó unidades asignadas a lotes: un
// reclamo contra una factura sin trazabilidad mostraría el caso vacío, que es
// justamente el que no hace falta sembrar.
//
// Solo se crea si NO hay ningún reclamo: el trabajo de alguien no se toca.
// ---------------------------------------------------------------------------
async function sembrarReclamoDeEjemplo() {
  const yaHay = await prisma.reclamoCliente.count({ where: { empresaId: EMPRESA_ID } });
  if (yaHay > 0) {
    console.log(`\nYa hay ${yaHay} reclamo(s) cargado(s): no se crea ninguno.`);
    return;
  }

  // Una factura vigente con unidades atadas a un lote de envasado.
  const detalle = await prisma.facturaDetalle.findFirst({
    where: {
      factura: { empresaId: EMPRESA_ID, estado: { not: "ANULADA" } },
      asignacionesLote: { some: {} },
    },
    select: {
      factura: { select: { id: true, numero: true, clienteId: true } },
    },
    orderBy: { factura: { fechaEmision: "asc" } },
  });
  if (!detalle) {
    console.log(
      "\nNinguna factura tiene unidades asignadas a un lote: no se siembra el reclamo de\n" +
        "ejemplo. «De qué lote salió» va a mostrar el caso sin trazabilidad, que es correcto."
    );
    return;
  }

  const causa = await prisma.causaCalidad.upsert({
    where: {
      empresaId_nombre: { empresaId: EMPRESA_ID, nombre: "Consistencia fuera de especificación" },
    },
    update: {},
    create: { empresaId: EMPRESA_ID, nombre: "Consistencia fuera de especificación" },
  });

  const numero = await prisma.$transaction((tx) => siguienteNumeroReclamo(tx, EMPRESA_ID));
  const reclamo = await prisma.reclamoCliente.create({
    data: {
      empresaId: EMPRESA_ID,
      numero,
      clienteId: detalle.factura.clienteId,
      facturaId: detalle.factura.id,
      causaId: causa.id,
      descripcion:
        "El cliente reporta que la grasa de esta entrega viene más blanda de lo habitual y " +
        "chorrea en el punto de engrase. Pide revisión del lote.",
      usuarioId: "seed",
      usuarioNombre: "Datos de prueba",
    },
  });
  console.log(
    `\nReclamo de ejemplo ${reclamo.numero} contra la factura ${detalle.factura.numero}: ` +
      "«De qué lote salió» ya tiene de dónde derivar el lote."
  );
}
