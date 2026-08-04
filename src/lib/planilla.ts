import type { Tx } from "@/lib/inventario";
import { postearPlanilla } from "@/lib/contabilidad";

// ---------------------------------------------------------------------------
// Motor de cálculo de planilla (HCM — Fase 1: solo período mensual regular).
// Ver docs/gobernanza/04-hcm-nomina-investigacion-normativa.md para las
// fuentes normativas y las simplificaciones asumidas — en particular, la
// retención de 5ta categoría usa el método simplificado (proyección anual /
// 12) y NO reproduce la reproración exacta de SUNAT mes a mes. Antes de usar
// esto para pagar sueldos reales, un especialista en planillas debe validar
// los montos contra su propia herramienta.
// ---------------------------------------------------------------------------

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
