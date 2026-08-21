import type { Tx } from "@/lib/inventario";
import { postearPlanilla, postearGratificacion, postearCts, postearLiquidacion } from "@/lib/contabilidad";
import { saldoVacaciones } from "@/lib/vacaciones";

// ---------------------------------------------------------------------------
// Motor de cálculo de planilla (HCM — Fase 1: solo período mensual regular).
// Ver docs/gobernanza/04-hcm-nomina-investigacion-normativa.md para las
// fuentes normativas y las simplificaciones asumidas — en particular, la
// retención de 5ta categoría usa el método simplificado (proyección anual /
// 12) y NO reproduce la reproración exacta de SUNAT mes a mes. Antes de usar
// esto para pagar sueldos reales, un especialista en planillas debe validar
// los montos contra su propia herramienta.
// ---------------------------------------------------------------------------

export function esPorcentajePlanillaValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

export async function obtenerParametroVigente(tx: Tx, fecha: Date) {
  return tx.parametroPlanilla.findFirst({
    where: { vigenteDesde: { lte: fecha } },
    orderBy: { vigenteDesde: "desc" },
  });
}

export async function obtenerTasaAfpVigente(
  tx: Tx,
  afp: "INTEGRA" | "PRIMA" | "HABITAT" | "PROFUTURO",
  fecha: Date
) {
  return tx.tasaAfp.findFirst({
    where: { afp, vigenteDesde: { lte: fecha } },
    orderBy: { vigenteDesde: "desc" },
  });
}

// Tramos de renta de 5ta categoría (estructura de ley, estable desde 2015 —
// lo único que cambia por norma es el valor de la UIT, que sí es parámetro).
function calcularImpuestoAnual(rentaNetaAnual: number, uit: number): number {
  const tramos = [
    { hasta: 5 * uit, tasa: 0.08 },
    { hasta: 20 * uit, tasa: 0.14 },
    { hasta: 35 * uit, tasa: 0.17 },
    { hasta: 45 * uit, tasa: 0.2 },
    { hasta: Infinity, tasa: 0.3 },
  ];
  let impuesto = 0;
  let desde = 0;
  for (const t of tramos) {
    if (rentaNetaAnual <= desde) break;
    const baseTramo = Math.min(rentaNetaAnual, t.hasta) - desde;
    impuesto += baseTramo * t.tasa;
    desde = t.hasta;
  }
  return impuesto;
}

// Método simplificado: proyecta 14 remuneraciones (12 sueldos + 2
// gratificaciones) sobre la remuneración mensual actual, resta 7 UIT
// exoneradas, aplica los tramos, y divide entre 12. El método real de SUNAT
// reproyecta cada mes con lo efectivamente ganado a la fecha — se documenta
// como simplificación explícita, no como equivalencia exacta.
export function calcularRetencion5taMensual(remuneracionMensual: number, uit: number): number {
  const proyeccionAnual = remuneracionMensual * 14;
  const rentaNeta = Math.max(0, proyeccionAnual - 7 * uit);
  if (rentaNeta === 0) return 0;
  const impuestoAnual = calcularImpuestoAnual(rentaNeta, uit);
  return Math.round((impuestoAnual / 12) * 100) / 100;
}

export type LineaCalculoPlanilla = {
  empleadoId: string;
  empleadoNombre: string;
  centroCostoId: string | null;
  sueldoBasico: number;
  asignacionFamiliar: number;
  remuneracionComputable: number;
  descuentoPension: number;
  detallePension: string;
  essaludPatronal: number;
  retencion5ta: number;
  neto: number;
};

export type ResultadoCalculoPlanilla =
  | { ok: true; lineas: LineaCalculoPlanilla[] }
  | { ok: false; error: string };

// Calcula (sin persistir) la planilla mensual para los empleados activos en
// régimen general (excluye Locación de Servicios, que se retiene por 4ta
// categoría — fuera de alcance de esta fase). Si algún empleado activo no
// tiene sistemaPension configurado, se excluye del cálculo con advertencia
// en vez de asumir un valor por defecto sobre dinero real.
export async function calcularPlanillaMensual(
  tx: Tx,
  fecha: Date
): Promise<ResultadoCalculoPlanilla & { advertencias?: string[] }> {
  const parametro = await obtenerParametroVigente(tx, fecha);
  if (!parametro) {
    return { ok: false, error: "No hay parámetros de planilla (RMV/UIT) configurados para esta fecha." };
  }

  const empleados = await tx.empleado.findMany({
    where: { estado: "ACTIVO", tipoContrato: { not: "LOCACION_SERVICIOS" } },
    orderBy: { codigo: "asc" },
  });

  const lineas: LineaCalculoPlanilla[] = [];
  const advertencias: string[] = [];

  for (const e of empleados) {
    if (!e.sistemaPension) {
      advertencias.push(
        `${e.nombres} ${e.apellidos} (${e.codigo}) no tiene sistema de pensión configurado — excluido de esta corrida.`
      );
      continue;
    }

    const sueldoBasico = e.sueldoBasico.toNumber();
    const asignacionFamiliar = e.asignacionFamiliar ? parametro.rmv.toNumber() * 0.1 : 0;
    const remuneracionComputable = sueldoBasico + asignacionFamiliar;

    let descuentoPension = 0;
    let detallePension = "";
    if (e.sistemaPension === "ONP") {
      const tasa = parametro.tasaOnp.toNumber();
      descuentoPension = Math.round(remuneracionComputable * (tasa / 100) * 100) / 100;
      detallePension = `ONP ${tasa}%`;
    } else {
      if (!e.afp) {
        advertencias.push(
          `${e.nombres} ${e.apellidos} (${e.codigo}) está en AFP pero no tiene AFP elegida — excluido de esta corrida.`
        );
        continue;
      }
      const tasaAfp = await obtenerTasaAfpVigente(tx, e.afp, fecha);
      if (!tasaAfp) {
        advertencias.push(
          `${e.nombres} ${e.apellidos} (${e.codigo}): no hay tasas configuradas para AFP ${e.afp} en esta fecha — excluido de esta corrida.`
        );
        continue;
      }
      const tasaTotal =
        tasaAfp.tasaAporteObligatorio.toNumber() +
        tasaAfp.tasaComision.toNumber() +
        tasaAfp.primaSeguro.toNumber();
      descuentoPension = Math.round(remuneracionComputable * (tasaTotal / 100) * 100) / 100;
      detallePension = `AFP ${e.afp} (aporte ${tasaAfp.tasaAporteObligatorio}% + comisión ${tasaAfp.tasaComision}% + prima ${tasaAfp.primaSeguro}%)`;
    }

    const essaludPatronal =
      Math.round(remuneracionComputable * (parametro.tasaEsSalud.toNumber() / 100) * 100) / 100;
    const retencion5ta = calcularRetencion5taMensual(remuneracionComputable, parametro.uit.toNumber());
    const neto = Math.round((remuneracionComputable - descuentoPension - retencion5ta) * 100) / 100;

    lineas.push({
      empleadoId: e.id,
      empleadoNombre: `${e.nombres} ${e.apellidos}`,
      centroCostoId: e.centroCostoId,
      sueldoBasico,
      asignacionFamiliar,
      remuneracionComputable,
      descuentoPension,
      detallePension,
      essaludPatronal,
      retencion5ta,
      neto,
    });
  }

  return { ok: true, lineas, advertencias: advertencias.length > 0 ? advertencias : undefined };
}

export async function generarPlanillaMensual(
  tx: Tx,
  params: { anio: number; mes: number; usuarioId: string; usuarioNombre: string }
): Promise<{ ok: true; periodoId: string; advertencias?: string[] } | { ok: false; error: string }> {
  const existente = await tx.planillaPeriodo.findUnique({
    where: { empresaId_anio_mes_tipo: { empresaId: "1", anio: params.anio, mes: params.mes, tipo: "MENSUAL" } },
  });
  if (existente) {
    return { ok: false, error: `Ya existe una planilla mensual para ${params.mes}/${params.anio}.` };
  }

  const fecha = new Date(params.anio, params.mes - 1, 1);
  const resultado = await calcularPlanillaMensual(tx, fecha);
  if (!resultado.ok) return resultado;
  if (resultado.lineas.length === 0) {
    return { ok: false, error: "No hay empleados elegibles para esta corrida (revise sistema de pensión configurado)." };
  }

  const periodo = await tx.planillaPeriodo.create({
    data: {
      anio: params.anio,
      mes: params.mes,
      tipo: "MENSUAL",
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
    },
  });

  const asiento = await postearPlanilla(
    tx,
    {
      periodo: `${params.anio}-${String(params.mes).padStart(2, "0")}`,
      fecha,
      lineas: resultado.lineas.map((l) => ({
        empleado: l.empleadoNombre,
        centroCostoId: l.centroCostoId,
        remuneracionComputable: l.remuneracionComputable,
        essaludPatronal: l.essaludPatronal,
        descuentoPension: l.descuentoPension,
        retencion5ta: l.retencion5ta,
        neto: l.neto,
      })),
    },
    { usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre }
  );

  await tx.planillaDetalle.createMany({
    data: resultado.lineas.map((l) => ({
      planillaPeriodoId: periodo.id,
      empleadoId: l.empleadoId,
      sueldoBasico: l.sueldoBasico,
      asignacionFamiliar: l.asignacionFamiliar,
      remuneracionComputable: l.remuneracionComputable,
      descuentoPension: l.descuentoPension,
      detallePension: l.detallePension,
      essaludPatronal: l.essaludPatronal,
      retencion5ta: l.retencion5ta,
      neto: l.neto,
      asientoNumero: asiento.ok ? asiento.numero : null,
    })),
  });

  return { ok: true, periodoId: periodo.id, advertencias: resultado.advertencias };
}

// ---------------------------------------------------------------------------
// Gratificación (julio/diciembre) y CTS (mayo/noviembre) — inafectas a
// ONP/AFP/EsSalud y a renta de 5ta categoría hasta 2 UIT (no se implementa el
// tope de 2 UIT: para los sueldos de este tamaño de empresa no se alcanza,
// pero si un sueldo alto lo superara, el exceso debería tributar y hoy no se
// calcula — ver docs/gobernanza/04-hcm-*.md).
//
// Método simplificado para "meses computados": cuenta meses calendario
// tocados dentro del rango efectivo (ingreso/cese acotan el rango), sin
// prorratear por día. La norma exige mes calendario completo trabajado; un
// ingreso a mitad de mes puede, en la práctica, no computar ese mes — este
// motor sí lo cuenta, sobreestimando levemente en ese caso borde.
// ---------------------------------------------------------------------------

function mesesTrabajadosEnRango(inicioRango: Date, finRango: Date, desde: Date, hasta: Date): number {
  const inicioEfectivo = desde > inicioRango ? desde : inicioRango;
  const finEfectivo = hasta < finRango ? hasta : finRango;
  if (finEfectivo < inicioEfectivo) return 0;
  const meses =
    (finEfectivo.getFullYear() - inicioEfectivo.getFullYear()) * 12 +
    (finEfectivo.getMonth() - inicioEfectivo.getMonth()) +
    1;
  return Math.max(0, meses);
}

function rangoGratificacion(anio: number, mitad: "JULIO" | "DICIEMBRE"): { inicio: Date; fin: Date } {
  return mitad === "JULIO"
    ? { inicio: new Date(anio, 0, 1), fin: new Date(anio, 5, 30) }
    : { inicio: new Date(anio, 6, 1), fin: new Date(anio, 11, 31) };
}

function rangoCts(anio: number, mitad: "MAYO" | "NOVIEMBRE"): { inicio: Date; fin: Date } {
  return mitad === "MAYO"
    ? { inicio: new Date(anio - 1, 10, 1), fin: new Date(anio, 3, 30) }
    : { inicio: new Date(anio, 4, 1), fin: new Date(anio, 9, 31) };
}

async function ultimaSextaGratificacion(tx: Tx, empleadoId: string, antesDe: Date): Promise<number> {
  const ultima = await tx.planillaDetalle.findFirst({
    where: {
      empleadoId,
      planillaPeriodo: { tipo: { in: ["GRATIFICACION_JULIO", "GRATIFICACION_DICIEMBRE"] } },
      creadoEn: { lt: antesDe },
    },
    orderBy: { creadoEn: "desc" },
  });
  return ultima ? ultima.remuneracionComputable.toNumber() / 6 : 0;
}

export async function generarGratificacion(
  tx: Tx,
  params: { anio: number; mitad: "JULIO" | "DICIEMBRE"; usuarioId: string; usuarioNombre: string }
): Promise<{ ok: true; periodoId: string } | { ok: false; error: string }> {
  const tipo = params.mitad === "JULIO" ? "GRATIFICACION_JULIO" : "GRATIFICACION_DICIEMBRE";
  const mes = params.mitad === "JULIO" ? 7 : 12;

  const existente = await tx.planillaPeriodo.findUnique({
    where: { empresaId_anio_mes_tipo: { empresaId: "1", anio: params.anio, mes, tipo } },
  });
  if (existente) return { ok: false, error: `Ya existe una gratificación de ${params.mitad.toLowerCase()} ${params.anio}.` };

  const parametro = await obtenerParametroVigente(tx, new Date(params.anio, mes - 1, 1));
  if (!parametro) return { ok: false, error: "No hay parámetros de planilla configurados." };

  const { inicio, fin } = rangoGratificacion(params.anio, params.mitad);
  const empleados = await tx.empleado.findMany({
    where: { estado: "ACTIVO", tipoContrato: { not: "LOCACION_SERVICIOS" }, fechaIngreso: { lte: fin } },
    orderBy: { codigo: "asc" },
  });

  const lineas = empleados
    .map((e) => {
      const desde = e.fechaIngreso > inicio ? e.fechaIngreso : inicio;
      const meses = Math.min(6, mesesTrabajadosEnRango(inicio, fin, desde, fin));
      if (meses <= 0) return null;
      const asignacionFamiliar = e.asignacionFamiliar ? parametro.rmv.toNumber() * 0.1 : 0;
      const remuneracionComputable = e.sueldoBasico.toNumber() + asignacionFamiliar;
      const montoBase = Math.round(((remuneracionComputable * meses) / 6) * 100) / 100;
      const bono = Math.round(montoBase * (parametro.tasaEsSalud.toNumber() / 100) * 100) / 100;
      return {
        empleadoId: e.id,
        empleadoNombre: `${e.nombres} ${e.apellidos}`,
        centroCostoId: e.centroCostoId,
        sueldoBasico: e.sueldoBasico.toNumber(),
        asignacionFamiliar,
        montoBase,
        meses,
        bono,
        neto: Math.round((montoBase + bono) * 100) / 100,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (lineas.length === 0) return { ok: false, error: "No hay empleados elegibles para esta corrida." };

  const periodo = await tx.planillaPeriodo.create({
    data: { anio: params.anio, mes, tipo, usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre },
  });

  const asiento = await postearGratificacion(
    tx,
    {
      periodo: `${params.mitad === "JULIO" ? "julio" : "diciembre"} ${params.anio}`,
      fecha: fin,
      lineas: lineas.map((l) => ({ empleado: l.empleadoNombre, centroCostoId: l.centroCostoId, montoBase: l.montoBase, bono: l.bono })),
    },
    { usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre }
  );

  await tx.planillaDetalle.createMany({
    data: lineas.map((l) => ({
      planillaPeriodoId: periodo.id,
      empleadoId: l.empleadoId,
      sueldoBasico: l.sueldoBasico,
      asignacionFamiliar: l.asignacionFamiliar,
      remuneracionComputable: l.montoBase,
      mesesComputados: l.meses,
      bonificacionExtraordinaria: l.bono,
      neto: l.neto,
      asientoNumero: asiento.ok ? asiento.numero : null,
    })),
  });

  return { ok: true, periodoId: periodo.id };
}

export async function generarCts(
  tx: Tx,
  params: { anio: number; mitad: "MAYO" | "NOVIEMBRE"; usuarioId: string; usuarioNombre: string }
): Promise<{ ok: true; periodoId: string } | { ok: false; error: string }> {
  const tipo = params.mitad === "MAYO" ? "CTS_MAYO" : "CTS_NOVIEMBRE";
  const mes = params.mitad === "MAYO" ? 5 : 11;

  const existente = await tx.planillaPeriodo.findUnique({
    where: { empresaId_anio_mes_tipo: { empresaId: "1", anio: params.anio, mes, tipo } },
  });
  if (existente) return { ok: false, error: `Ya existe una CTS de ${params.mitad.toLowerCase()} ${params.anio}.` };

  const { inicio, fin } = rangoCts(params.anio, params.mitad);
  const parametro = await obtenerParametroVigente(tx, fin);
  if (!parametro) return { ok: false, error: "No hay parámetros de planilla configurados." };

  const empleados = await tx.empleado.findMany({
    where: { estado: "ACTIVO", tipoContrato: { not: "LOCACION_SERVICIOS" }, fechaIngreso: { lte: fin } },
    orderBy: { codigo: "asc" },
  });

  const lineas = [];
  for (const e of empleados) {
    const desde = e.fechaIngreso > inicio ? e.fechaIngreso : inicio;
    const meses = Math.min(6, mesesTrabajadosEnRango(inicio, fin, desde, fin));
    if (meses <= 0) continue;
    const asignacionFamiliar = e.asignacionFamiliar ? parametro.rmv.toNumber() * 0.1 : 0;
    const remuneracionComputable = e.sueldoBasico.toNumber() + asignacionFamiliar;
    const sextaGratificacion = await ultimaSextaGratificacion(tx, e.id, fin);
    const monto = Math.round(((remuneracionComputable + sextaGratificacion) / 12) * meses * 100) / 100;
    lineas.push({
      empleadoId: e.id,
      empleadoNombre: `${e.nombres} ${e.apellidos}`,
      centroCostoId: e.centroCostoId,
      sueldoBasico: e.sueldoBasico.toNumber(),
      asignacionFamiliar,
      meses,
      monto,
    });
  }

  if (lineas.length === 0) return { ok: false, error: "No hay empleados elegibles para esta corrida." };

  const periodo = await tx.planillaPeriodo.create({
    data: { anio: params.anio, mes, tipo, usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre },
  });

  const asiento = await postearCts(
    tx,
    {
      periodo: `${params.mitad === "MAYO" ? "mayo" : "noviembre"} ${params.anio}`,
      fecha: fin,
      lineas: lineas.map((l) => ({ empleado: l.empleadoNombre, centroCostoId: l.centroCostoId, monto: l.monto })),
    },
    { usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre }
  );

  await tx.planillaDetalle.createMany({
    data: lineas.map((l) => ({
      planillaPeriodoId: periodo.id,
      empleadoId: l.empleadoId,
      sueldoBasico: l.sueldoBasico,
      asignacionFamiliar: l.asignacionFamiliar,
      remuneracionComputable: l.monto,
      mesesComputados: l.meses,
      neto: l.monto,
      asientoNumero: asiento.ok ? asiento.numero : null,
    })),
  });

  return { ok: true, periodoId: periodo.id };
}

// Liquidación de desvinculación: se genera junto con el cese del empleado.
export async function generarLiquidacion(
  tx: Tx,
  params: { empleadoId: string; fechaCese: Date; diasVacacionesAprobados: number; usuarioId: string; usuarioNombre: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = await tx.empleado.findUnique({ where: { id: params.empleadoId } });
  if (!e) return { ok: false, error: "El empleado no existe." };

  const parametro = await obtenerParametroVigente(tx, params.fechaCese);
  if (!parametro) return { ok: false, error: "No hay parámetros de planilla configurados." };

  const asignacionFamiliar = e.asignacionFamiliar ? parametro.rmv.toNumber() * 0.1 : 0;
  const remuneracionComputable = e.sueldoBasico.toNumber() + asignacionFamiliar;

  // CTS truncada: desde el último depósito CTS registrado (o el ingreso, si
  // no hay ninguno) hasta la fecha de cese.
  const ultimoCts = await tx.planillaDetalle.findFirst({
    where: { empleadoId: e.id, planillaPeriodo: { tipo: { in: ["CTS_MAYO", "CTS_NOVIEMBRE"] } } },
    orderBy: { creadoEn: "desc" },
  });
  const inicioCts = ultimoCts ? ultimoCts.creadoEn : e.fechaIngreso;
  const mesesCts = mesesTrabajadosEnRango(inicioCts, params.fechaCese, inicioCts, params.fechaCese);
  const sextaGratificacion = await ultimaSextaGratificacion(tx, e.id, params.fechaCese);
  const ctsTruncada =
    mesesCts > 0
      ? Math.round(((remuneracionComputable + sextaGratificacion) / 12) * mesesCts * 100) / 100
      : 0;

  // Gratificación truncada: desde el inicio del semestre en curso (o el
  // ingreso, si es posterior) hasta la fecha de cese.
  const mitadSemestre: "JULIO" | "DICIEMBRE" = params.fechaCese.getMonth() < 6 ? "JULIO" : "DICIEMBRE";
  const { inicio: inicioSemestre } = rangoGratificacion(params.fechaCese.getFullYear(), mitadSemestre);
  const desdeGrati = e.fechaIngreso > inicioSemestre ? e.fechaIngreso : inicioSemestre;
  const mesesGrati = Math.min(6, mesesTrabajadosEnRango(inicioSemestre, params.fechaCese, desdeGrati, params.fechaCese));
  const gratificacionTruncada =
    mesesGrati > 0 ? Math.round(((remuneracionComputable * mesesGrati) / 6) * 100) / 100 : 0;
  const bono = Math.round(gratificacionTruncada * (parametro.tasaEsSalud.toNumber() / 100) * 100) / 100;

  // Vacaciones truncadas + no gozadas (saldoVacaciones ya es un cálculo
  // continuo desde el ingreso, cubre ambos conceptos en un solo número).
  const diasVacacionesPendientes = Math.max(
    0,
    Math.round(saldoVacaciones(e.fechaIngreso, params.diasVacacionesAprobados, params.fechaCese) * 100) / 100
  );
  const montoVacaciones = Math.round(diasVacacionesPendientes * (e.sueldoBasico.toNumber() / 30) * 100) / 100;

  const total =
    Math.round((ctsTruncada + gratificacionTruncada + bono + montoVacaciones) * 100) / 100;

  const asiento = await postearLiquidacion(
    tx,
    {
      empleado: `${e.nombres} ${e.apellidos}`,
      centroCostoId: e.centroCostoId,
      ctsTruncada,
      gratificacionTruncada,
      bono,
      montoVacaciones,
      fecha: params.fechaCese,
    },
    { usuarioId: params.usuarioId, usuarioNombre: params.usuarioNombre }
  );

  await tx.liquidacionDesvinculacion.create({
    data: {
      empleadoId: e.id,
      fechaCese: params.fechaCese,
      ctsTruncada,
      gratificacionTruncada,
      bonificacionExtraordinaria: bono,
      diasVacacionesPendientes,
      montoVacaciones,
      total,
      asientoNumero: asiento.ok ? asiento.numero : null,
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
    },
  });

  return { ok: true };
}
