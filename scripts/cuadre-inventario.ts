// ---------------------------------------------------------------------------
// ¿Siguen cuadrando los tres niveles del inventario?
//
// La cantidad de un ítem vive en tres lugares a la vez —el agregado del
// maestro, el saldo por almacén y el reparto por zona— y `registrarMovimiento`
// los mantiene sincronizados en una sola transacción, con cerrojo optimista en
// cada nivel. Está bien hecho. Lo que no existía era la pregunta al revés:
// **comprobar el estado completo de la base un martes cualquiera.**
//
// Las pruebas verifican valores después de operaciones concretas. Eso no
// detecta el descuadre que ya ocurrió —por una transacción a medias, por una
// escritura directa a la base, por una fila de `SaldoAlmacen` duplicada que la
// clave única no impide— porque para detectarlo hay que mirar los datos que hay,
// no los que una prueba acaba de crear.
//
// Las invariantes y el detalle de cada una están en `src/lib/cuadreInventario.ts`
// y en `docs/cuadre-inventario.md`. Las comprueba `tests/cuadre-inventario.test.ts`
// sembrando un descuadre por invariante, que es lo que hace que un «todo cuadra»
// signifique algo.
//
// ES DE SOLO LECTURA. No escribe, no corrige, no crea bases: por eso —a
// diferencia de `fugas:entre-empresas` o del runner de pruebas, que sí
// escriben y por eso se fijan su propia base— este apunta a la base
// CONFIGURADA, que es justamente la que interesa auditar.
//
//   npm run cuadre:inventario
//   npm run cuadre:inventario -- --base=erp_demo     (otra base)
// ---------------------------------------------------------------------------
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  compararValorContraCuenta,
  cuadrarInventario,
  type Descuadre,
  type GrupoDeValor,
  type ItemConAgregado,
  type SaldoDeAlmacen,
  type SaldoDeZona,
  type TipoItem,
  type UltimoMovimiento,
} from "../src/lib/cuadreInventario";
import { construirValorizacionInventario } from "../src/lib/valorizacionInventario";

const basePedida = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);

const plantilla = process.env.DATABASE_URL;
if (!plantilla) {
  console.error(
    "Falta DATABASE_URL. Es la conexión del PostgreSQL que se audita. Ver docs/postgresql.md."
  );
  process.exit(1);
}
// Solo se cambia el NOMBRE de la base; máquina, puerto y credenciales salen de
// la plantilla, igual que en el resto de los scripts del proyecto.
function conBase(plantilla: string, nombre: string) {
  const u = new URL(plantilla);
  u.pathname = `/${nombre}`;
  return u.toString();
}

const url = basePedida ? conBase(plantilla, basePedida) : plantilla;
const prisma = new PrismaClient({ adapter: crearAdaptador(url) });

const n = (d: { toNumber(): number }) => d.toNumber();
const fmt = (valor: number) =>
  valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const ETIQUETAS: Record<Descuadre["invariante"], string> = {
  SALDO_DUPLICADO: "fila de SaldoAlmacen duplicada",
  MAESTRO_VS_ALMACENES: "el agregado del maestro no es la suma de sus almacenes",
  KARDEX_VS_ALMACEN: "el saldo del almacén no coincide con el último movimiento",
  ZONAS_SOBRE_ALMACEN: "lo repartido en zonas supera el saldo del almacén",
};

async function auditarEmpresa(empresaId: string, nombreEmpresa: string) {
  const [insumos, presentaciones, almacenes] = await Promise.all([
    prisma.insumo.findMany({
      where: { empresaId },
      select: { id: true, codigo: true, nombre: true, stock: true, costoUnitario: true },
    }),
    prisma.presentacion.findMany({
      where: { empresaId },
      select: { id: true, sku: true, stock: true, costoPromedio: true },
    }),
    prisma.almacen.findMany({ where: { empresaId }, select: { id: true, nombre: true } }),
  ]);

  const items: ItemConAgregado[] = [
    ...insumos.map((i) => ({
      tipoItem: "INSUMO" as TipoItem,
      itemId: i.id,
      codigo: i.codigo,
      nombre: i.nombre,
      stockAgregado: n(i.stock),
    })),
    ...presentaciones.map((p) => ({
      tipoItem: "PRESENTACION" as TipoItem,
      itemId: p.id,
      codigo: p.sku,
      nombre: p.sku,
      stockAgregado: n(p.stock),
    })),
  ];

  const idsAlmacen = almacenes.map((a) => a.id);
  const nombreAlmacen = new Map(almacenes.map((a) => [a.id, a.nombre]));

  // Los saldos se leen por los almacenes de la empresa, no por el empresaId del
  // ítem: así una fila de saldo de un ítem de OTRA compañía colgada de un
  // almacén de esta aparece igual, en vez de quedar fuera del alcance.
  const [saldos, zonas, movimientos] = await Promise.all([
    prisma.saldoAlmacen.findMany({
      where: { almacenId: { in: idsAlmacen } },
      select: {
        almacenId: true,
        tipoItem: true,
        insumoId: true,
        presentacionId: true,
        cantidad: true,
      },
    }),
    prisma.saldoZona.findMany({
      where: { zona: { almacenId: { in: idsAlmacen } } },
      select: {
        zonaAlmacenId: true,
        itemId: true,
        tipoItem: true,
        cantidad: true,
        zona: { select: { almacenId: true } },
      },
    }),
    // Mismo orden que `/inventario/valorizacion`, para que el «último
    // movimiento» signifique lo mismo en los dos lados.
    prisma.movimientoKardex.findMany({
      where: { empresaId },
      select: {
        almacenId: true,
        tipoItem: true,
        insumoId: true,
        presentacionId: true,
        saldoNuevo: true,
        costoUnitario: true,
      },
      orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
    }),
  ]);

  const idDe = (fila: { tipoItem: TipoItem; insumoId: string | null; presentacionId: string | null }) =>
    fila.tipoItem === "INSUMO" ? fila.insumoId : fila.presentacionId;

  const saldosPlanos: SaldoDeAlmacen[] = saldos.flatMap((s) => {
    const itemId = idDe(s);
    return itemId
      ? [{ almacenId: s.almacenId, tipoItem: s.tipoItem, itemId, cantidad: n(s.cantidad) }]
      : [];
  });

  const zonasPlanas: SaldoDeZona[] = zonas.map((z) => ({
    almacenId: z.zona.almacenId,
    zonaAlmacenId: z.zonaAlmacenId,
    tipoItem: z.tipoItem,
    itemId: z.itemId,
    cantidad: n(z.cantidad),
  }));

  // El primero de cada (almacén, ítem) en una lista descendente es el último.
  const vistos = new Set<string>();
  const ultimos: UltimoMovimiento[] = [];
  const paraValorizar: Parameters<typeof construirValorizacionInventario>[0] = [];
  for (const m of movimientos) {
    const itemId = idDe(m);
    if (!itemId) continue;
    const clave = `${m.almacenId}:${m.tipoItem}:${itemId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    ultimos.push({
      almacenId: m.almacenId,
      tipoItem: m.tipoItem,
      itemId,
      saldoNuevo: n(m.saldoNuevo),
    });
    paraValorizar.push({
      almacenId: m.almacenId,
      itemId,
      tipoItem: m.tipoItem,
      saldoNuevo: n(m.saldoNuevo),
      costoUnitario: n(m.costoUnitario),
    });
  }

  const descuadres = cuadrarInventario({ items, saldos: saldosPlanos, zonas: zonasPlanas, ultimos });

  console.log(
    `\n── ${nombreEmpresa} ──  ${items.length} ítem(s), ${almacenes.length} almacén(es), ` +
      `${saldosPlanos.length} saldo(s), ${zonasPlanas.length} reparto(s) de zona, ${movimientos.length} movimiento(s)`
  );

  if (descuadres.length === 0) {
    console.log("  ✔ Cantidad: las cuatro invariantes cuadran.");
  } else {
    console.error(`  ✖ Cantidad: ${descuadres.length} descuadre(s).`);
    for (const d of descuadres) {
      const donde = d.almacenId ? ` @ ${nombreAlmacen.get(d.almacenId) ?? d.almacenId}` : "";
      console.error(
        `     [${ETIQUETAS[d.invariante]}] ${d.codigo} — ${d.nombre}${donde}\n` +
          `       esperado ${fmt(d.esperado)} · encontrado ${fmt(d.encontrado)} · diferencia ${fmt(d.diferencia)}` +
          (d.detalle ? `\n       ${d.detalle}` : "")
      );
    }
  }

  await informarValor(empresaId, paraValorizar);
  return descuadres.length;
}

/**
 * El valor contra la cuenta contable se INFORMA, no se aprueba.
 *
 * `postearAsiento()` es best-effort a propósito (`docs/incidencias-contables.md`)
 * y los movimientos previos al costo congelado valen cero
 * (`docs/valorizacion-inventario.md`). Con esas dos cosas documentadas, un
 * veredicto en rojo permanente no serviría de nada; la diferencia sí, al lado
 * de las causas que ya se conocen.
 */
async function informarValor(
  empresaId: string,
  paraValorizar: Parameters<typeof construirValorizacionInventario>[0]
) {
  const CLAVES: Record<string, TipoItem> = {
    INVENTARIO_INSUMOS: "INSUMO",
    INVENTARIO_PT: "PRESENTACION",
  };
  const [controles, incidencias] = await Promise.all([
    prisma.controlContable.findMany({
      where: { empresaId, clave: { in: Object.keys(CLAVES) } },
      select: { clave: true, cuentaId: true, cuenta: { select: { codigo: true } } },
    }),
    prisma.incidenciaContable.count({ where: { empresaId } }),
  ]);

  if (controles.length === 0) {
    console.log("  — Valor: sin controles contables de inventario configurados; nada que comparar.");
    return;
  }

  const grupos: GrupoDeValor[] = [];
  for (const control of controles) {
    const tipo = CLAVES[control.clave];
    const valorizacion = construirValorizacionInventario(
      paraValorizar.filter((m) => m.tipoItem === tipo)
    );
    const movimientosCuenta = await prisma.asientoDetalle.aggregate({
      where: { cuentaId: control.cuentaId, asiento: { empresaId } },
      _sum: { debe: true, haber: true },
    });
    const debe = movimientosCuenta._sum.debe ? n(movimientosCuenta._sum.debe) : 0;
    const haber = movimientosCuenta._sum.haber ? n(movimientosCuenta._sum.haber) : 0;
    grupos.push({
      claveControl: control.clave,
      cuentaCodigo: control.cuenta.codigo,
      valorInventario: valorizacion.valorTotal,
      saldoCuenta: debe - haber,
      itemsSinCosto: valorizacion.filasSinCosto,
      incidencias,
    });
  }

  for (const c of compararValorContraCuenta(grupos)) {
    console.log(
      `  ${c.diferencia === 0 ? "✔" : "·"} Valor ${c.claveControl} (cuenta ${c.cuentaCodigo}): ` +
        `inventario ${fmt(c.valorInventario)} vs cuenta ${fmt(c.saldoCuenta)} ` +
        `→ diferencia ${fmt(c.diferencia)}`
    );
    if (c.signoInesperado) {
      console.log(
        "       ! la cuenta de inventario es de activo y su saldo es NEGATIVO: " +
          "eso no lo explica un desfase de posteo."
      );
    }
    for (const causa of c.causasCandidatas) console.log(`       candidata: ${causa}`);
    if (c.diferencia !== 0) {
      console.log(
        "       las candidatas no dicen CUÁNTO aportan. La diferencia sigue sin explicar " +
          "hasta que alguien las valúe."
      );
    }
  }
}

async function main() {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, razonSocial: true },
    orderBy: { razonSocial: "asc" },
  });
  console.log(
    `Cuadre de inventario — ${empresas.length} compañía(s). Solo lectura: no escribe nada.`
  );

  let total = 0;
  for (const empresa of empresas) total += await auditarEmpresa(empresa.id, empresa.razonSocial);

  if (total === 0) {
    console.log("\n✔ Ninguna compañía tiene descuadres de cantidad.");
    return;
  }
  console.error(
    `\n✖ ${total} descuadre(s) de cantidad en total.\n` +
      "  Un descuadre de cantidad es un defecto, no una holgura: los tres niveles los\n" +
      "  escribe la misma transacción. Empiece por las filas duplicadas si hay, que\n" +
      "  son causa de las demás."
  );
  process.exit(1);
}

main().finally(() => prisma.$disconnect());
