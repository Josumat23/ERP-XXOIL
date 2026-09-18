// ---------------------------------------------------------------------------
// ¿La base recién sembrada trae los casos que las pantallas contestan?
//
// Una demo puede estar «cargada» y no mostrar nada: si ningún lote del
// proveedor llegó en dos recepciones, la pantalla de recall funciona pero su
// aviso de alcance ampliado no aparece nunca, y quien estrena el sistema
// concluye que la función no está.
//
// Esto corre dentro de `npm run semillas:desde-cero`, contra la base efímera
// que ese script crea y destruye. No mira `erp_dev`.
// ---------------------------------------------------------------------------
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import { revisarReensayos } from "../src/lib/reensayosConsulta";

const prisma = new PrismaClient({ adapter: crearAdaptador() });
const EMPRESA_ID = "1";

const fallas: string[] = [];
const comprobar = (condicion: boolean, queFalta: string) => {
  console.log(`  ${condicion ? "✔" : "✖"} ${queFalta}`);
  if (!condicion) fallas.push(queFalta);
};

async function main() {
  console.log("\nCasos que la demo tiene que traer:\n");

  // --- Recall por lote del proveedor ---------------------------------------
  const recepciones = await prisma.recepcionCompraDetalle.findMany({
    where: { recepcion: { ordenCompra: { empresaId: EMPRESA_ID } } },
    select: {
      cantidad: true,
      cantidadDisponible: true,
      numeroLoteProveedor: true,
      insumo: { select: { codigo: true, tipo: true } },
      recepcion: { select: { numero: true } },
      _count: { select: { asignacionesLote: true } },
    },
  });

  const materiaPrima = recepciones.filter((r) => r.insumo.tipo === "MATERIA_PRIMA");
  comprobar(
    materiaPrima.length > 0 && materiaPrima.every((r) => Boolean(r.numeroLoteProveedor)),
    "toda recepción de materia prima trae el número de lote del proveedor"
  );

  const porLote = new Map<string, typeof recepciones>();
  for (const r of recepciones) {
    if (!r.numeroLoteProveedor) continue;
    const clave = `${r.insumo.codigo}|${r.numeroLoteProveedor}`;
    porLote.set(clave, [...(porLote.get(clave) ?? []), r]);
  }
  const repartidos = [...porLote.entries()].filter(([, rs]) => rs.length >= 2);
  comprobar(
    repartidos.length > 0,
    "algún lote del proveedor llegó en más de una recepción (el aviso de alcance ampliado)"
  );
  for (const [clave, rs] of repartidos) {
    const recibido = rs.reduce((t, r) => t + r.cantidad.toNumber(), 0);
    const disponible = rs.reduce((t, r) => t + r.cantidadDisponible.toNumber(), 0);
    console.log(
      `      ${clave}: ${rs.map((r) => r.recepcion.numero).join(" + ")} — recibido ${recibido}, sin consumir ${disponible}`
    );
    comprobar(
      rs.some((r) => r._count.asignacionesLote > 0),
      `  ${clave}: alguna de sus entregas se consumió en producción`
    );
    comprobar(
      disponible > 0,
      `  ${clave}: queda material sin consumir (el dato accionable del recall)`
    );
  }

  // --- A quiénes hay que avisar --------------------------------------------
  const clientesSinContacto = await prisma.cliente.count({
    where: { empresaId: EMPRESA_ID, contactos: { none: {} } },
  });
  comprobar(clientesSinContacto === 0, "todos los clientes tienen a quién llamar");

  // --- Del reclamo al lote --------------------------------------------------
  const reclamoConFactura = await prisma.reclamoCliente.findFirst({
    where: { empresaId: EMPRESA_ID, facturaId: { not: null } },
    select: { numero: true, factura: { select: { numero: true } } },
  });
  comprobar(Boolean(reclamoConFactura), "hay un reclamo con factura, para derivar el lote");

  // --- Laboratorio ----------------------------------------------------------
  const instrumentos = await prisma.instrumentoMedicion.count({ where: { empresaId: EMPRESA_ID } });
  comprobar(instrumentos > 0, "hay instrumentos de medición cargados");
  const medicionesConInstrumento = await prisma.resultadoCaracteristicaCalidad.count({
    where: { instrumentoId: { not: null }, controlCalidad: { loteGranel: { empresaId: EMPRESA_ID } } },
  });
  comprobar(medicionesConInstrumento > 0, "algún ensayo declara con qué instrumento se midió");

  const certificables = await prisma.loteGranel.count({
    where: {
      empresaId: EMPRESA_ID,
      controlCalidad: { resultado: "APROBADO", resultadosCaracteristica: { some: {} } },
    },
  });
  comprobar(certificables > 0, "algún lote puede emitir su certificado de análisis");

  // «Qué hay que reensayar» sale de una derivación, no de un campo guardado:
  // afirmar que la demo trae el caso sin ejecutarla sería suponerlo.
  const revision = await revisarReensayos(EMPRESA_ID);
  comprobar(
    revision.items.length > 0,
    "«Qué hay que reensayar» tiene algo que decir (ensayos sin respaldo de calibración)"
  );
  const despachados = revision.items.filter((i) => i.destino === "DESPACHADO").length;
  console.log(
    `      ${revision.items.length} ensayo(s) a revisar, ${despachados} ya en poder del cliente, ` +
      `de ${revision.medicionesEvaluadas} medición(es) evaluadas`
  );
  comprobar(
    despachados > 0,
    "alguno de esos ensayos ya salió al cliente (el caso urgente de la pantalla)"
  );

  if (fallas.length > 0) {
    console.error(`\n✖ La demo no trae ${fallas.length} caso(s):`);
    for (const f of fallas) console.error(`   - ${f}`);
    console.error(
      "\nUna demo sin el caso deja la función invisible: quien la estrena concluye que no está."
    );
    process.exit(1);
  }
  console.log("\n✔ La demo trae todos los casos.");
}

main().finally(() => prisma.$disconnect());
