// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Datos de prueba del laboratorio y del catálogo técnico.
//
// `seed-demo.ts` siembra el flujo comercial completo —compras, producción,
// ventas, cobros, contabilidad— pero no toca nada de calidad: ni una
// especificación, ni un competidor, ni un instrumento, ni un plan de
// inspección. Seis ciclos de trabajo quedaban invisibles no porque faltaran
// datos del negocio, sino porque el sembrador se había quedado atrás.
//
// ---------------------------------------------------------------------------
// Dos decisiones sobre QUÉ se siembra
//
// 1. Las especificaciones son las que le corresponden a una fábrica de GRASAS
//    —NLGI, API GC-LB, DIN 51825, ISO 6743-9—. Las que había cargadas a mano
//    (API CK-4, ACEA E9, MB 228.31) son de aceite de motor y no aplican a
//    ninguno de los dos productos del catálogo. Se dejan: son datos de prueba
//    válidos y borrarlos no aporta nada.
//
// 2. Los competidores son MARCAS INVENTADAS, no reales. Un sembrador viaja con
//    el repositorio y termina en demos y capturas; afirmar ahí que el producto
//    de una empresa real cumple tal norma es poner en circulación una
//    declaración sobre un tercero que nadie verificó. Las marcas ficticias
//    prueban exactamente igual.
//
// ---------------------------------------------------------------------------
// La data cuenta una historia, no es relleno
//
// Cada pantalla construida tiene que mostrar algo: una homologación vencida y
// otra por vencer, una equivalencia degradada por esa homologación vencida, un
// instrumento vencido, otro por vencer y otro fuera de tolerancia. Sembrar
// todo «en verde» dejaría las alertas sin nada que decir y nadie sabría si
// funcionan.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: crearAdaptador() });

const EMPRESA_ID = "1";
const USUARIO = { usuarioId: "seed", usuarioNombre: "Datos de prueba" };

const dia = 24 * 60 * 60 * 1000;
const enDias = (n: number) => new Date(Date.now() + n * dia);

async function main() {
  const empresa = await prisma.empresa.findUnique({ where: { id: EMPRESA_ID } });
  if (!empresa) {
    console.error(`No existe la compañía ${EMPRESA_ID}. Corra primero \`npm run seed:demo\`.`);
    process.exit(1);
  }

  // --- Especificaciones técnicas -------------------------------------------
  //
  // Las que aplican a grasas. `emisor` solo tiene sentido en OEM: «51825» no
  // dice nada sin «DIN».
  const especificaciones = [
    { organismo: "NLGI" as const, codigo: "2", descripcion: "Consistencia NLGI grado 2 (penetración 265-295)" },
    { organismo: "NLGI" as const, codigo: "1", descripcion: "Consistencia NLGI grado 1 (penetración 310-340)" },
    { organismo: "NLGI" as const, codigo: "3", descripcion: "Consistencia NLGI grado 3 (penetración 220-250)" },
    { organismo: "API" as const, codigo: "GC-LB", descripcion: "Grasa para rodamientos de rueda y chasis de servicio severo" },
    { organismo: "ISO" as const, codigo: "L-XBCEA 2", descripcion: "ISO 6743-9: grasa multiproposito, servicio severo" },
    { organismo: "OEM" as const, codigo: "51825 KP2K-30", emisor: "DIN", descripcion: "Grasa de litio EP, grado 2, hasta -30 C" },
    { organismo: "OEM" as const, codigo: "CES 20086", emisor: "Cummins", descripcion: "Homologacion de chasis para flota Cummins" },
    { organismo: "OTRO" as const, codigo: "MINERIA-SUP", descripcion: "Requisito interno de clientes mineros: sin metales pesados" },
  ];

  const porCodigo = new Map<string, string>();
  for (const e of especificaciones) {
    const fila = await prisma.especificacionTecnica.upsert({
      where: {
        empresaId_organismo_codigo: {
          empresaId: EMPRESA_ID,
          organismo: e.organismo,
          codigo: e.codigo,
        },
      },
      update: { descripcion: e.descripcion, emisor: e.emisor ?? null },
      create: { empresaId: EMPRESA_ID, ...e },
    });
    porCodigo.set(`${e.organismo}:${e.codigo}`, fila.id);
  }
  console.log(`Especificaciones técnicas: ${especificaciones.length}.`);

  // --- Qué declara cada producto -------------------------------------------
  const chasis = await prisma.producto.findFirst({ where: { empresaId: EMPRESA_ID, codigo: "GR-CHASIS" } });
  const litio = await prisma.producto.findFirst({ where: { empresaId: EMPRESA_ID, codigo: "GR-LITIO" } });
  if (!chasis || !litio) {
    console.error("Faltan los productos GR-CHASIS y GR-LITIO. Corra primero `npm run seed:demo`.");
    process.exit(1);
  }

  // Una HOMOLOGADA vencida y otra por vencer, a propósito: son las que hacen
  // hablar al semáforo y las que dejan de imprimirse en el certificado.
  const declaraciones = [
    { producto: chasis.id, espec: "NLGI:2", tipo: "CUMPLE" as const },
    { producto: chasis.id, espec: "API:GC-LB", tipo: "CUMPLE" as const },
    { producto: chasis.id, espec: "ISO:L-XBCEA 2", tipo: "CUMPLE" as const },
    {
      producto: chasis.id,
      espec: "OEM:CES 20086",
      tipo: "HOMOLOGADO" as const,
      numeroAprobacion: "CUM-2024-0417",
      vigenteHasta: enDias(-45), // VENCIDA: deja de imprimirse y degrada la equivalencia
    },
    { producto: litio.id, espec: "NLGI:2", tipo: "CUMPLE" as const },
    { producto: litio.id, espec: "OTRO:MINERIA-SUP", tipo: "CUMPLE" as const },
    {
      producto: litio.id,
      espec: "OEM:51825 KP2K-30",
      tipo: "HOMOLOGADO" as const,
      numeroAprobacion: "DIN-2025-1180",
      vigenteHasta: enDias(60), // POR VENCER: el aviso ámbar a 90 días
    },
  ];

  for (const d of declaraciones) {
    const especificacionId = porCodigo.get(d.espec);
    if (!especificacionId) continue;
    await prisma.especificacionProducto.upsert({
      where: { productoId_especificacionId: { productoId: d.producto, especificacionId } },
      update: {
        tipo: d.tipo,
        numeroAprobacion: d.numeroAprobacion ?? null,
        vigenteHasta: d.vigenteHasta ?? null,
      },
      create: {
        empresaId: EMPRESA_ID,
        productoId: d.producto,
        especificacionId,
        tipo: d.tipo,
        numeroAprobacion: d.numeroAprobacion ?? null,
        vigenteHasta: d.vigenteHasta ?? null,
        ...USUARIO,
      },
    });
  }
  console.log(`Declaraciones de producto: ${declaraciones.length} (1 vencida, 1 por vencer).`);

  // --- Productos de la competencia -----------------------------------------
  //
  // Marcas inventadas: ver la nota de arriba.
  const competidores = [
    {
      marca: "Vulcano",
      nombre: "MaxGrease EP-2",
      fuente: "Ficha técnica del fabricante, rev. 2026-02",
      especs: ["NLGI:2", "API:GC-LB", "ISO:L-XBCEA 2", "OEM:CES 20086"],
    },
    {
      marca: "Andes Lub",
      nombre: "Chassis Pro 2",
      fuente: "Catálogo comercial 2026",
      especs: ["NLGI:2", "API:GC-LB"],
    },
    {
      marca: "Kordal",
      nombre: "Litio HD",
      fuente: "Ficha técnica del fabricante, rev. 2025-11",
      especs: ["NLGI:2", "OEM:51825 KP2K-30", "OTRO:MINERIA-SUP"],
    },
    {
      marca: "Vulcano",
      nombre: "MaxGrease EP-1",
      fuente: "Ficha técnica del fabricante, rev. 2026-02",
      especs: ["NLGI:1"],
    },
  ];

  const porCompetidor = new Map<string, string>();
  for (const c of competidores) {
    const fila = await prisma.productoCompetencia.upsert({
      where: { empresaId_marca_nombre: { empresaId: EMPRESA_ID, marca: c.marca, nombre: c.nombre } },
      update: { fuente: c.fuente },
      create: { empresaId: EMPRESA_ID, marca: c.marca, nombre: c.nombre, fuente: c.fuente },
    });
    porCompetidor.set(`${c.marca}:${c.nombre}`, fila.id);

    for (const clave of c.especs) {
      const especificacionId = porCodigo.get(clave);
      if (!especificacionId) continue;
      await prisma.especificacionCompetencia.upsert({
        where: {
          productoCompetenciaId_especificacionId: {
            productoCompetenciaId: fila.id,
            especificacionId,
          },
        },
        update: {},
        create: { empresaId: EMPRESA_ID, productoCompetenciaId: fila.id, especificacionId },
      });
    }
  }
  console.log(`Productos de la competencia: ${competidores.length}.`);

  // --- Equivalencias --------------------------------------------------------
  //
  // `cubiertasAlDeclarar` es la foto del momento en que alguien declaró la
  // equivalencia. La de Vulcano se siembra como se declaró —cubriendo las 4—
  // para que HOY aparezca degradada: la homologación Cummins venció y ya no
  // cuenta. Es el caso que la pantalla existe para mostrar.
  const equivalencias = [
    {
      producto: chasis.id,
      competidor: "Vulcano:MaxGrease EP-2",
      cubiertasAlDeclarar: 4,
      totalAlDeclarar: 4,
      justificacion: "Misma consistencia y aplicación; homologación Cummins vigente al declararla.",
    },
    {
      producto: chasis.id,
      competidor: "Andes Lub:Chassis Pro 2",
      cubiertasAlDeclarar: 2,
      totalAlDeclarar: 2,
      justificacion: "Cubre lo que el competidor declara.",
    },
    {
      producto: litio.id,
      competidor: "Kordal:Litio HD",
      cubiertasAlDeclarar: 3,
      totalAlDeclarar: 3,
      justificacion: "Equivalente directo para clientes mineros.",
    },
  ];

  for (const e of equivalencias) {
    const productoCompetenciaId = porCompetidor.get(e.competidor);
    if (!productoCompetenciaId) continue;
    await prisma.equivalenciaProducto.upsert({
      where: {
        productoId_productoCompetenciaId: { productoId: e.producto, productoCompetenciaId },
      },
      update: {},
      create: {
        empresaId: EMPRESA_ID,
        productoId: e.producto,
        productoCompetenciaId,
        cubiertasAlDeclarar: e.cubiertasAlDeclarar,
        totalAlDeclarar: e.totalAlDeclarar,
        justificacion: e.justificacion,
        ...USUARIO,
      },
    });
  }
  console.log(`Equivalencias: ${equivalencias.length} (1 degradada por la homologación vencida).`);

  // --- Instrumentos del laboratorio ----------------------------------------
  //
  // Uno de cada estado que el semáforo distingue. Sembrarlos todos vigentes
  // dejaría las alertas sin nada que decir, y nadie sabría si funcionan.
  const instrumentos = [
    {
      codigo: "DM-01",
      nombre: "Densímetro digital",
      marca: "Anton Paar",
      modelo: "DMA 35",
      frecuencia: 365,
      calibraciones: [{ desde: -300, hasta: 65, resultado: "CONFORME" as const, cert: "CAL-2025-014" }],
    },
    {
      codigo: "VIS-01",
      nombre: "Viscosímetro cinemático",
      marca: "Cannon",
      modelo: "CT-1000",
      frecuencia: 365,
      // POR VENCER: dentro de los 30 días de aviso.
      calibraciones: [{ desde: -345, hasta: 20, resultado: "CONFORME" as const, cert: "CAL-2025-088" }],
    },
    {
      codigo: "PEN-01",
      nombre: "Penetrómetro de grasas",
      marca: "Koehler",
      modelo: "K19500",
      frecuencia: 365,
      // VENCIDA: mide la consistencia NLGI, que es la especificación central.
      calibraciones: [{ desde: -420, hasta: -55, resultado: "CONFORME" as const, cert: "CAL-2024-201" }],
    },
    {
      codigo: "BAL-01",
      nombre: "Balanza analítica",
      marca: "Mettler Toledo",
      modelo: "ME204",
      frecuencia: 180,
      // FUERA DE TOLERANCIA: la verificación más reciente salió mal.
      calibraciones: [
        { desde: -200, hasta: 165, resultado: "CONFORME" as const, cert: "CAL-2025-133" },
        { desde: -10, hasta: 355, resultado: "NO_CONFORME" as const, cert: "VER-2026-208" },
      ],
    },
    {
      codigo: "TER-01",
      nombre: "Termómetro de inmersión",
      marca: "Fluke",
      modelo: "1523",
      frecuencia: 730,
      calibraciones: [{ desde: -120, hasta: 610, resultado: "CONFORME" as const, cert: "CAL-2026-009" }],
    },
  ];

  const porInstrumento = new Map<string, string>();
  for (const i of instrumentos) {
    const fila = await prisma.instrumentoMedicion.upsert({
      where: { empresaId_codigo: { empresaId: EMPRESA_ID, codigo: i.codigo } },
      update: { nombre: i.nombre, marca: i.marca, modelo: i.modelo, frecuenciaCalibracionDias: i.frecuencia },
      create: {
        empresaId: EMPRESA_ID,
        codigo: i.codigo,
        nombre: i.nombre,
        marca: i.marca,
        modelo: i.modelo,
        ubicacion: "Laboratorio",
        frecuenciaCalibracionDias: i.frecuencia,
      },
    });
    porInstrumento.set(i.codigo, fila.id);

    for (const c of i.calibraciones) {
      // El certificado es único de hecho: sirve de clave para no duplicar al
      // resembrar. No hay índice único en la base —el mismo número podría
      // repetirse entre entidades certificadoras— así que se comprueba acá.
      const existe = await prisma.calibracionInstrumento.findFirst({
        where: { instrumentoId: fila.id, numeroCertificado: c.cert },
        select: { id: true },
      });
      if (existe) continue;
      await prisma.calibracionInstrumento.create({
        data: {
          empresaId: EMPRESA_ID,
          instrumentoId: fila.id,
          fecha: enDias(c.desde),
          vigenteHasta: enDias(c.hasta),
          resultado: c.resultado,
          numeroCertificado: c.cert,
          entidad: "Laboratorio acreditado INACAL",
          ...USUARIO,
        },
      });
    }
  }
  console.log(`Instrumentos: ${instrumentos.length} (1 por vencer, 1 vencido, 1 fuera de tolerancia).`);

  // --- Planes de inspección de producto ------------------------------------
  //
  // Con la densidad marcada y el instrumento esperado declarado: son los dos
  // datos que hacen que el ensayo alimente la conversión a litros y la
  // trazabilidad del instrumento.
  const planes = [
    {
      producto: chasis.id,
      nombre: "Liberación de grasa chasis",
      caracteristicas: [
        { nombre: "Densidad a 15 C", unidad: "kg/L", min: 0.86, max: 0.92, metodo: "ASTM D1298", densidad: true, instrumento: "DM-01" },
        { nombre: "Penetración trabajada 60x", unidad: "0.1 mm", min: 265, max: 295, metodo: "ASTM D217", densidad: false, instrumento: "PEN-01" },
        { nombre: "Punto de goteo", unidad: "C", min: 180, max: null, metodo: "ASTM D2265", densidad: false, instrumento: "TER-01" },
      ],
    },
    {
      producto: litio.id,
      nombre: "Liberación de grasa de litio",
      caracteristicas: [
        { nombre: "Densidad a 15 C", unidad: "kg/L", min: 0.87, max: 0.93, metodo: "ASTM D1298", densidad: true, instrumento: "DM-01" },
        { nombre: "Penetración trabajada 60x", unidad: "0.1 mm", min: 265, max: 295, metodo: "ASTM D217", densidad: false, instrumento: "PEN-01" },
      ],
    },
  ];

  for (const p of planes) {
    const vigente = await prisma.planInspeccionCalidad.findFirst({
      where: { empresaId: EMPRESA_ID, productoId: p.producto, activo: true },
      select: { id: true },
    });
    if (vigente) continue; // ya hay uno publicado: no se pisa
    await prisma.planInspeccionCalidad.create({
      data: {
        empresaId: EMPRESA_ID,
        productoId: p.producto,
        version: 1,
        nombre: p.nombre,
        ...USUARIO,
        caracteristicas: {
          create: p.caracteristicas.map((c, indice) => ({
            secuencia: indice + 1,
            nombre: c.nombre,
            unidadMedida: c.unidad,
            limiteInferior: c.min,
            limiteSuperior: c.max,
            metodoEnsayo: c.metodo,
            esDensidad: c.densidad,
            instrumentoId: porInstrumento.get(c.instrumento) ?? null,
          })),
        },
      },
    });
  }
  console.log(`Planes de inspección de producto: ${planes.length}.`);

  // --- Inspección de lo que entra ------------------------------------------
  const aceite = await prisma.insumo.findFirst({
    where: { empresaId: EMPRESA_ID, codigo: "MP-ACEITE-BASE" },
  });
  if (aceite) {
    await prisma.insumo.update({
      where: { id: aceite.id },
      data: { requiereInspeccion: true },
    });
    const planVigente = await prisma.planInspeccionInsumo.findFirst({
      where: { empresaId: EMPRESA_ID, insumoId: aceite.id, activo: true },
      select: { id: true },
    });
    if (!planVigente) {
      await prisma.planInspeccionInsumo.create({
        data: {
          empresaId: EMPRESA_ID,
          insumoId: aceite.id,
          version: 1,
          nombre: "Recepción de aceite base",
          ...USUARIO,
          caracteristicas: {
            create: [
              {
                secuencia: 1,
                nombre: "Viscosidad a 100 C",
                unidadMedida: "cSt",
                limiteInferior: 10.5,
                limiteSuperior: 12.5,
                metodoEnsayo: "ASTM D445",
                instrumentoId: porInstrumento.get("VIS-01") ?? null,
              },
              {
                secuencia: 2,
                nombre: "Densidad a 15 C",
                unidadMedida: "kg/L",
                limiteInferior: 0.86,
                limiteSuperior: 0.9,
                metodoEnsayo: "ASTM D1298",
                instrumentoId: porInstrumento.get("DM-01") ?? null,
              },
            ],
          },
        },
      });
    }
    console.log("Inspección de entrada: aceite base marcado, con su plan.");
  }

  // --- Y el control encendido en ADVIERTE ----------------------------------
  //
  // En producción el nivel nace en NO_APLICA a propósito: el laboratorio no
  // frena nada hasta que la empresa lo decida. Pero este es un sembrador de
  // PRUEBA, y dejarlo apagado escondería justo lo que se acaba de sembrar —un
  // instrumento vencido, otro fuera de tolerancia— detrás de un interruptor
  // que nadie sabe que existe.
  //
  // ADVIERTE y no BLOQUEA: avisa sin frenar, que es lo que se quiere ver.
  await prisma.configuracionEmpresa.update({
    where: { empresaId: EMPRESA_ID },
    data: { nivelControlCalibracion: "ADVIERTE" },
  });
  console.log("Control de calibración: ADVIERTE (solo en datos de prueba; nace en NO_APLICA).");

  console.log(
    "\nCatálogo técnico y laboratorio cargados. El semáforo del panel ya tiene qué decir:\n" +
      "  · una homologación vencida y otra por vencer\n" +
      "  · una equivalencia que hoy cubre menos que al declararla\n" +
      "  · un instrumento vencido, uno por vencer y uno fuera de tolerancia\n" +
      "\nPara volver al comportamiento de producción, ponga el control en\n" +
      "«No aplica» (Producción → Instrumentos de medición)."
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
