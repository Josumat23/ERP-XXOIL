// ---------------------------------------------------------------------------
// ¿Alguna pantalla muestra datos de otra compañía?
//
// El aislamiento multiempresa es la preocupación más documentada del proyecto
// —hay más de veinte documentos sobre él— y las pruebas lo verifican consulta
// por consulta. Lo que ninguna verificaba es el resultado: lo que la pantalla
// RENDERIZA con otra compañía activa.
//
// Esto lo comprueba de punta a punta, por HTTP, con DOS compañías AMBAS con
// datos. Con una vacía solo se detecta «la consulta no filtra»; con dos
// pobladas se detecta además «filtra por la compañía equivocada», que es el
// error más silencioso de los dos.
//
// Se compara sobre el TEXTO VISIBLE, no sobre el HTML: la primera versión dio
// un falso positivo con `DM-01`, que no era un dato sino el placeholder del
// campo «Código» en el formulario de alta. Una comprobación que marca lo que
// no es se termina ignorando.
//
// Corre contra la base DEMO y necesita el servidor levantado:
//
//   npm run dev:demo -- --reset      (en otra terminal)
//   npm run fugas:entre-empresas
// ---------------------------------------------------------------------------
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";

// Nunca contra la base de trabajo: el nombre se fija acá.
const url = new URL(process.env.DATABASE_URL ?? "");
url.pathname = "/erp_demo";
process.env.DATABASE_URL = url.toString();

const prisma = new PrismaClient({ adapter: crearAdaptador() });
const BASE = process.env.URL_ERP ?? "http://localhost:3000";

const RUTAS = [
  "/",
  "/comercial/clientes",
  "/comercial/pedidos",
  "/comercial/facturas",
  "/comercial/comisiones",
  "/produccion/lotes",
  "/produccion/lotes/recall",
  "/produccion/calidad",
  "/produccion/calidad/instrumentos",
  "/produccion/calidad/reensayos",
  "/produccion/calidad/reclamos",
  "/produccion/calidad/no-conformidades",
  "/produccion/capacidad",
  "/produccion/centros-trabajo",
  "/produccion/envasados",
  "/inventario/tanques",
  "/inventario/kardex",
  "/inventario/valorizacion",
  "/logistica/ordenes-compra",
  "/logistica/guias-remision",
  "/logistica/inspeccion-compras",
  "/rrhh/empleados",
  "/rrhh/planilla",
  "/rrhh/organigrama",
  "/finanzas/asientos",
  "/finanzas/centros-costo",
  "/finanzas/cuentas-por-cobrar",
  "/reportes",
];

/** Solo lo que una persona ve: sin etiquetas, sin atributos, sin scripts. */
function textoVisible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

/** Nombres y códigos con los que se reconoce a una compañía en pantalla. */
async function marcasDe(empresaId: string): Promise<string[]> {
  const [clientes, lotes, empleados, instrumentos, tanques, proveedores, envasados] =
    await Promise.all([
      prisma.cliente.findMany({ where: { empresaId }, select: { razonSocial: true } }),
      prisma.loteGranel.findMany({ where: { empresaId }, select: { codigo: true } }),
      prisma.empleado.findMany({ where: { empresaId }, select: { apellidos: true } }),
      prisma.instrumentoMedicion.findMany({ where: { empresaId }, select: { codigo: true } }),
      prisma.tanque.findMany({ where: { empresaId }, select: { codigo: true } }),
      prisma.proveedor.findMany({ where: { empresaId }, select: { razonSocial: true } }),
      prisma.envasado.findMany({ where: { empresaId }, select: { codigo: true } }),
    ]);
  return [
    ...clientes.map((x) => x.razonSocial),
    ...lotes.map((x) => x.codigo),
    ...empleados.map((x) => x.apellidos),
    ...instrumentos.map((x) => x.codigo),
    ...tanques.map((x) => x.codigo),
    ...proveedores.map((x) => x.razonSocial),
    ...envasados.map((x) => x.codigo),
  ].filter((m) => m && m.length > 4);
}

async function barrer(
  token: string,
  empresaActiva: string,
  marcasAjenas: string[]
): Promise<{ ruta: string; marcas: string[] }[]> {
  const fugas: { ruta: string; marcas: string[] }[] = [];
  for (const ruta of RUTAS) {
    const r = await fetch(BASE + ruta, {
      headers: { cookie: `erp_sesion=${token}; erp_empresa_activa=${empresaActiva}` },
      redirect: "manual",
    });
    if (r.status !== 200) {
      console.log(`  · ${r.status} ${ruta}`);
      continue;
    }
    const visible = textoVisible(await r.text());
    const encontradas = marcasAjenas.filter((m) => visible.includes(m));
    if (encontradas.length > 0) fugas.push({ ruta, marcas: [...new Set(encontradas)].slice(0, 6) });
    console.log(`  ${encontradas.length === 0 ? "✔" : "✖"} ${ruta}`);
  }
  return fugas;
}

async function main() {
  const empresas = await prisma.empresa.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  if (empresas.length < 2) {
    console.error(
      "\nHacen falta DOS compañías con datos. Levante la demo completa:\n" +
        "  npm run dev:demo -- --reset"
    );
    process.exit(1);
  }
  const [unaId, otraId] = [empresas[0].id, empresas[1].id];

  const admin = await prisma.usuario.findFirstOrThrow({
    where: { empresaId: unaId, rol: "ADMIN", activo: true },
    select: { id: true },
  });
  const token = randomBytes(32).toString("hex");
  await prisma.sesion.create({
    data: { token, usuarioId: admin.id, expiraEn: new Date(Date.now() + 3600000) },
  });

  const marcasUna = await marcasDe(unaId);
  const marcasOtra = await marcasDe(otraId);
  // Lo que ambas usan no es fuga: coincidir en un nombre no prueba nada.
  const comunes = new Set(marcasUna.filter((m) => marcasOtra.includes(m)));
  const exclusivasUna = [...new Set(marcasUna)].filter((m) => !comunes.has(m));
  const exclusivasOtra = [...new Set(marcasOtra)].filter((m) => !comunes.has(m));

  let fugas: { ruta: string; marcas: string[] }[] = [];
  try {
    console.log(
      `\nCon «${otraId}» activa, buscando ${exclusivasUna.length} marca(s) de «${unaId}»:\n`
    );
    fugas = await barrer(token, otraId, exclusivasUna);

    // La dirección inversa también: que la primera no vea a la segunda.
    console.log(
      `\nCon «${unaId}» activa, buscando ${exclusivasOtra.length} marca(s) de «${otraId}»:\n`
    );
    fugas = fugas.concat(await barrer(token, unaId, exclusivasOtra));
  } finally {
    await prisma.sesion.deleteMany({ where: { token } });
  }

  if (fugas.length === 0) {
    console.log("\n✔ Ninguna pantalla mostró datos de la otra compañía, en ninguna dirección.");
    return;
  }
  console.error(`\n✖ ${fugas.length} pantalla(s) con datos de la otra compañía:`);
  for (const f of fugas) console.error(`   ${f.ruta} → ${f.marcas.join(", ")}`);
  process.exit(1);
}

main().finally(() => prisma.$disconnect());
