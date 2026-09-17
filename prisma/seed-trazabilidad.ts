// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// El número de lote del proveedor en las recepciones de prueba.
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
