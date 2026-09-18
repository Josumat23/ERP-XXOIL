// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import { generarPlanillaMensual } from "../src/lib/planilla";

// ---------------------------------------------------------------------------
// Personal, planilla y centros de costo: datos de prueba.
//
// Un barrido de las 178 pantallas del sistema encontró que 15 pantallas de
// detalle no se pueden ni abrir, porque no hay un solo registro que mirar. El
// módulo de RRHH entero era una de ellas: cero empleados, cero posiciones,
// cero planillas. Siete pantallas construidas y ninguna con nada que mostrar.
//
// Quien estrena el sistema no concluye «faltan datos»: concluye que el módulo
// no funciona.
//
// ---------------------------------------------------------------------------
// Sobre los valores legales
//
// La planilla peruana se calcula con RMV, UIT y tasas de AFP. Esos son valores
// LEGALES que fija el Estado y cambian: acá van como DATOS DE PRUEBA para que
// el cálculo corra, NO como una afirmación de cuánto valen hoy. Antes de
// cualquier planilla con dinero real hay que cargarlos en
// «RRHH → Planilla → Parámetros», que es la pantalla que existe para eso.
//
// El sembrador lo imprime al terminar, para que nadie los herede sin verlos.
//
// Las tasas de EsSalud (9 %) y ONP (13 %) no se inventan acá: son los valores
// por omisión que ya trae el esquema.
//
// ---------------------------------------------------------------------------
// Las personas son inventadas
//
// Igual que las marcas de la competencia en `seed-calidad.ts` y los contactos
// en `seed-trazabilidad.ts`. Un sembrador viaja con el repositorio y termina
// en demos y capturas; poner ahí el nombre, el DNI o el sueldo de alguien real
// es publicar el dato de un tercero. Los DNI siguen el formato de ocho dígitos
// pero empiezan por 00, que no se asigna.
//
// ---------------------------------------------------------------------------
// La plantilla cuenta una historia, no es relleno
//
// Cada pantalla tiene que mostrar algo distinto:
//
//   · Un empleado SIN sistema de pensión declarado, que la corrida excluye con
//     una advertencia visible. Es el comportamiento que el propio módulo
//     documenta —«nunca se asume ONP/AFP por defecto en un cálculo con dinero
//     real»— y sin un caso así nadie lo ve nunca.
//   · Uno por locación de servicios, que no entra en planilla por definición.
//   · Uno cesado, para que rotación y headcount no sean una línea plana.
//   · Uno con asignación familiar, que es un concepto que se suma aparte.
//   · Jefaturas declaradas, para que el organigrama tenga forma de árbol.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: crearAdaptador() });

const EMPRESA_ID = "1";
const USUARIO = { usuarioId: "seed", usuarioNombre: "Datos de prueba" };

const dia = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(Date.now() - n * dia);

/** Valores de PRUEBA para que el cálculo corra. No son una afirmación legal. */
const PARAMETROS_DE_PRUEBA = { rmv: 1025, uit: 5350 };

const CENTROS = [
  { codigo: "CC-PLANTA", nombre: "Planta de grasas", tipo: "PRODUCCION" as const },
  { codigo: "CC-ADMIN", nombre: "Administración", tipo: "ADMINISTRACION" as const },
  { codigo: "CC-VENTAS", nombre: "Comercial", tipo: "VENTAS" as const },
];

type Persona = {
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  cargo: string;
  area: string;
  centro: string;
  tipoContrato: "PLAZO_FIJO" | "PLAZO_INDETERMINADO" | "LOCACION_SERVICIOS";
  sueldoBasico: number;
  diasDeAntiguedad: number;
  sistemaPension?: "ONP" | "AFP";
  afp?: "INTEGRA" | "PRIMA" | "HABITAT" | "PROFUTURO";
  asignacionFamiliar?: boolean;
  jefe?: string;
  cesadoHaceDias?: number;
  motivoCese?: string;
  /** Por qué esta persona está en la plantilla de prueba. */
  porQue?: string;
};

const PERSONAS: Persona[] = [
  {
    codigo: "EMP-00001",
    nombres: "Ricardo",
    apellidos: "Salinas Moreno",
    dni: "00110022",
    cargo: "Gerente general",
    area: "Gerencia",
    centro: "CC-ADMIN",
    tipoContrato: "PLAZO_INDETERMINADO",
    sueldoBasico: 9500,
    diasDeAntiguedad: 2200,
    sistemaPension: "AFP",
    afp: "INTEGRA",
  },
  {
    codigo: "EMP-00002",
    nombres: "Lucía",
    apellidos: "Ferrer Campos",
    dni: "00110033",
    cargo: "Jefa de planta",
    area: "Producción",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_INDETERMINADO",
    sueldoBasico: 6200,
    diasDeAntiguedad: 1400,
    sistemaPension: "AFP",
    afp: "PRIMA",
    jefe: "EMP-00001",
  },
  {
    codigo: "EMP-00003",
    nombres: "Hernán",
    apellidos: "Ticona Apaza",
    dni: "00110044",
    cargo: "Operario de mezcla",
    area: "Producción",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_INDETERMINADO",
    sueldoBasico: 2100,
    diasDeAntiguedad: 900,
    sistemaPension: "ONP",
    asignacionFamiliar: true,
    jefe: "EMP-00002",
    porQue: "asignación familiar: se suma aparte del básico",
  },
  {
    codigo: "EMP-00004",
    nombres: "Marisol",
    apellidos: "Huamán Zegarra",
    dni: "00110055",
    cargo: "Analista de laboratorio",
    area: "Calidad",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_INDETERMINADO",
    sueldoBasico: 3400,
    diasDeAntiguedad: 700,
    sistemaPension: "AFP",
    afp: "HABITAT",
    jefe: "EMP-00002",
  },
  {
    codigo: "EMP-00005",
    nombres: "Diego",
    apellidos: "Arrieta Bustos",
    dni: "00110066",
    cargo: "Operario de envasado",
    area: "Producción",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_FIJO",
    sueldoBasico: 1900,
    diasDeAntiguedad: 240,
    sistemaPension: "ONP",
    jefe: "EMP-00002",
  },
  {
    codigo: "EMP-00006",
    nombres: "Patricia",
    apellidos: "Cárdenas Loayza",
    dni: "00110077",
    cargo: "Jefa comercial",
    area: "Ventas",
    centro: "CC-VENTAS",
    tipoContrato: "PLAZO_INDETERMINADO",
    sueldoBasico: 5800,
    diasDeAntiguedad: 1100,
    sistemaPension: "AFP",
    afp: "PROFUTURO",
    jefe: "EMP-00001",
  },
  {
    codigo: "EMP-00007",
    nombres: "Álvaro",
    apellidos: "Pizarro Rondón",
    dni: "00110088",
    cargo: "Almacenero",
    area: "Logística",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_FIJO",
    sueldoBasico: 2000,
    diasDeAntiguedad: 420,
    jefe: "EMP-00002",
    porQue: "SIN sistema de pensión: la corrida lo excluye con una advertencia",
  },
  {
    codigo: "EMP-00008",
    nombres: "Silvia",
    apellidos: "Reátegui Vela",
    dni: "00110099",
    cargo: "Contadora externa",
    area: "Administración",
    centro: "CC-ADMIN",
    tipoContrato: "LOCACION_SERVICIOS",
    sueldoBasico: 4200,
    diasDeAntiguedad: 600,
    jefe: "EMP-00001",
    porQue: "locación de servicios: no entra en planilla por definición",
  },
  {
    codigo: "EMP-00009",
    nombres: "Jorge",
    apellidos: "Mendoza Ríos",
    dni: "00110111",
    cargo: "Operario de mezcla",
    area: "Producción",
    centro: "CC-PLANTA",
    tipoContrato: "PLAZO_FIJO",
    sueldoBasico: 1900,
    diasDeAntiguedad: 800,
    sistemaPension: "ONP",
    jefe: "EMP-00002",
    cesadoHaceDias: 70,
    motivoCese: "Fin de contrato a plazo fijo",
    porQue: "cesado: rotación y headcount dejan de ser una línea plana",
  },
];

async function main() {
  const empresa = await prisma.empresa.findUnique({ where: { id: EMPRESA_ID } });
  if (!empresa) {
    console.error(`No existe la compañía ${EMPRESA_ID}. Corra primero \`npm run seed:demo\`.`);
    process.exit(1);
  }

  const yaHay = await prisma.empleado.count({ where: { empresaId: EMPRESA_ID } });
  if (yaHay > 0) {
    console.log(`Ya hay ${yaHay} empleado(s) cargado(s): no se toca nada.`);
    return;
  }

  // --- Centros de costo ----------------------------------------------------
  // El costo del personal tiene que pesar en el centro correcto; sin ellos la
  // planilla se contabiliza sin destino y la pantalla de centros está vacía.
  const porCentro = new Map<string, string>();
  for (const c of CENTROS) {
    const fila = await prisma.centroCosto.upsert({
      where: { empresaId_codigo: { empresaId: EMPRESA_ID, codigo: c.codigo } },
      update: { nombre: c.nombre },
      create: { empresaId: EMPRESA_ID, ...c },
    });
    porCentro.set(c.codigo, fila.id);
  }
  console.log(`Centros de costo: ${CENTROS.length}.`);

  // --- Parámetros de planilla (valores de PRUEBA) --------------------------
  const parametro = await prisma.parametroPlanilla.findFirst({
    where: { empresaId: EMPRESA_ID },
  });
  if (!parametro) {
    await prisma.parametroPlanilla.create({
      data: {
        empresaId: EMPRESA_ID,
        rmv: PARAMETROS_DE_PRUEBA.rmv,
        uit: PARAMETROS_DE_PRUEBA.uit,
        vigenteDesde: haceDias(400),
        ...USUARIO,
      },
    });
  }

  // Tasas de AFP: también valores de prueba, una por administradora.
  const TASAS = [
    { afp: "INTEGRA" as const, tasaComision: 1.55, primaSeguro: 1.74 },
    { afp: "PRIMA" as const, tasaComision: 1.6, primaSeguro: 1.74 },
    { afp: "HABITAT" as const, tasaComision: 1.47, primaSeguro: 1.74 },
    { afp: "PROFUTURO" as const, tasaComision: 1.69, primaSeguro: 1.74 },
  ];
  for (const t of TASAS) {
    const existe = await prisma.tasaAfp.findFirst({ where: { afp: t.afp } });
    if (existe) continue;
    await prisma.tasaAfp.create({ data: { ...t, vigenteDesde: haceDias(400) } });
  }

  // --- Las personas --------------------------------------------------------
  const porCodigo = new Map<string, string>();
  for (const p of PERSONAS) {
    const fila = await prisma.empleado.create({
      data: {
        empresaId: EMPRESA_ID,
        codigo: p.codigo,
        nombres: p.nombres,
        apellidos: p.apellidos,
        dni: p.dni,
        fechaIngreso: haceDias(p.diasDeAntiguedad),
        cargo: p.cargo,
        area: p.area,
        tipoContrato: p.tipoContrato,
        sueldoBasico: p.sueldoBasico,
        centroCostoId: porCentro.get(p.centro) ?? null,
        sistemaPension: p.sistemaPension ?? null,
        afp: p.afp ?? null,
        asignacionFamiliar: p.asignacionFamiliar ?? false,
        estado: p.cesadoHaceDias ? "CESADO" : "ACTIVO",
        fechaCese: p.cesadoHaceDias ? haceDias(p.cesadoHaceDias) : null,
        motivoCese: p.motivoCese ?? null,
        correo: `${p.nombres.toLowerCase()}.${p.apellidos.split(" ")[0].toLowerCase()}@xxoil.ejemplo.pe`,
      },
    });
    porCodigo.set(p.codigo, fila.id);
    if (p.porQue) console.log(`  ${p.codigo} ${p.nombres} ${p.apellidos} — ${p.porQue}`);
  }
  // Las jefaturas, en una segunda pasada: un jefe puede estar más abajo en la
  // lista que quien le reporta.
  for (const p of PERSONAS) {
    if (!p.jefe) continue;
    await prisma.empleado.update({
      where: { id: porCodigo.get(p.codigo)! },
      data: { jefeDirectoId: porCodigo.get(p.jefe) ?? null },
    });
  }
  console.log(`Empleados: ${PERSONAS.length} (1 cesado, 1 sin pensión declarada, 1 por locación).`);

  // --- Posiciones organizativas -------------------------------------------
  // El organigrama sale de las POSICIONES, no de las personas: una posición
  // puede quedar vacante y seguir existiendo, que es justamente para lo que
  // sirve tenerlas aparte.
  const posicionPorCodigo = new Map<string, string>();
  const POSICIONES = [
    { codigo: "POS-001", titulo: "Gerencia general", area: "Gerencia", centro: "CC-ADMIN", reportaA: null, ocupa: "EMP-00001" },
    { codigo: "POS-002", titulo: "Jefatura de planta", area: "Producción", centro: "CC-PLANTA", reportaA: "POS-001", ocupa: "EMP-00002" },
    { codigo: "POS-003", titulo: "Jefatura comercial", area: "Ventas", centro: "CC-VENTAS", reportaA: "POS-001", ocupa: "EMP-00006" },
    { codigo: "POS-004", titulo: "Analista de laboratorio", area: "Calidad", centro: "CC-PLANTA", reportaA: "POS-002", ocupa: "EMP-00004" },
    { codigo: "POS-005", titulo: "Operario de planta", area: "Producción", centro: "CC-PLANTA", reportaA: "POS-002", ocupa: "EMP-00003" },
    // Vacante a propósito: el puesto del operario que cesó sigue existiendo.
    { codigo: "POS-006", titulo: "Supervisión de turno noche", area: "Producción", centro: "CC-PLANTA", reportaA: "POS-002", ocupa: null },
  ];
  for (const p of POSICIONES) {
    const fila = await prisma.posicionOrganizativa.create({
      data: {
        empresaId: EMPRESA_ID,
        codigo: p.codigo,
        titulo: p.titulo,
        area: p.area,
        centroCostoId: porCentro.get(p.centro) ?? null,
        ...USUARIO,
      },
    });
    posicionPorCodigo.set(p.codigo, fila.id);
  }
  for (const p of POSICIONES) {
    if (p.reportaA) {
      await prisma.posicionOrganizativa.update({
        where: { id: posicionPorCodigo.get(p.codigo)! },
        data: { reportaAId: posicionPorCodigo.get(p.reportaA) ?? null },
      });
    }
    if (p.ocupa) {
      await prisma.asignacionPosicion.create({
        data: {
          empresaId: EMPRESA_ID,
          posicionId: posicionPorCodigo.get(p.codigo)!,
          empleadoId: porCodigo.get(p.ocupa)!,
          vigenteDesde: haceDias(300),
          ...USUARIO,
        },
      });
    }
  }
  console.log(`Posiciones organizativas: ${POSICIONES.length} (1 vacante).`);

  // --- Vacaciones ----------------------------------------------------------
  await prisma.solicitudVacaciones.create({
    data: {
      empleadoId: porCodigo.get("EMP-00004")!,
      fechaInicio: haceDias(120),
      fechaFin: haceDias(113),
      diasSolicitados: 7,
      estado: "APROBADA",
      aprobadaPor: "Ricardo Salinas Moreno",
      aprobadaEn: haceDias(130),
      ...USUARIO,
    },
  });
  await prisma.solicitudVacaciones.create({
    data: {
      empleadoId: porCodigo.get("EMP-00003")!,
      fechaInicio: haceDias(-20),
      fechaFin: haceDias(-6),
      diasSolicitados: 15,
      estado: "PENDIENTE",
      ...USUARIO,
    },
  });
  console.log("Vacaciones: 1 aprobada y 1 pendiente de aprobar.");

  await sembrarPlanilla();
}

// ---------------------------------------------------------------------------
// La planilla NO se escribe a mano.
//
// El módulo tiene su propio motor —`generarPlanillaMensual`— que calcula
// aportes, descuentos, quinta categoría y contabiliza el asiento. Escribir los
// importes acá sería una segunda implementación del cálculo, y la que quedara
// vieja sería la del sembrador: los números de la demo dirían una cosa y la
// pantalla otra.
//
// Se corre el mes pasado, que es el que ya está cerrado.
// ---------------------------------------------------------------------------
async function sembrarPlanilla() {
  const hoy = new Date();
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const resultado = await prisma.$transaction((tx) =>
    generarPlanillaMensual(tx, {
      anio: mesPasado.getFullYear(),
      mes: mesPasado.getMonth() + 1,
      empresaId: EMPRESA_ID,
      ...USUARIO,
    })
  );

  if (!resultado.ok) {
    console.log(`Planilla mensual no generada: ${resultado.error}`);
    return;
  }
  console.log(
    `Planilla mensual ${mesPasado.getMonth() + 1}/${mesPasado.getFullYear()} generada, con su asiento contable.`
  );
  for (const aviso of resultado.advertencias ?? []) console.log(`  aviso: ${aviso}`);
}

main()
  .then(() => {
    console.log(
      "\nRRHH cargado. Las siete pantallas del módulo ya tienen qué mostrar.\n" +
        "\nATENCIÓN — los parámetros de planilla son DATOS DE PRUEBA:\n" +
        `  RMV ${PARAMETROS_DE_PRUEBA.rmv}, UIT ${PARAMETROS_DE_PRUEBA.uit} y las tasas de AFP\n` +
        "  están puestos para que el cálculo corra, NO son una afirmación de\n" +
        "  cuánto valen hoy. Antes de cualquier planilla con dinero real,\n" +
        "  cárguelos en «RRHH → Planilla → Parámetros»."
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
