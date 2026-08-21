"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Afp, TipoComisionAfp } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { esValorEnum } from "@/lib/enums";
import { puedeRealizar } from "@/lib/permisos";
import { esPorcentajePlanillaValido } from "@/lib/planilla";
import { crearFechaCalendarioLocal } from "@/lib/fechas";

export type EstadoFormulario = { error?: string; ok?: boolean };

const ROLES_RRHH = ["GERENCIA"] as const;

export async function crearParametroPlanilla(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "crear"))) {
    return { error: "No tiene permiso para crear registros de planilla." };
  }

  const rmv = Number(formData.get("rmv") ?? 0);
  const uit = Number(formData.get("uit") ?? 0);
  const tasaEsSalud = Number(formData.get("tasaEsSalud") ?? 9);
  const tasaOnp = Number(formData.get("tasaOnp") ?? 13);
  const vigenteDesdeRaw = String(formData.get("vigenteDesde") ?? "");
  const vigenteDesde = crearFechaCalendarioLocal(vigenteDesdeRaw);

  if (!Number.isFinite(rmv) || rmv <= 0) return { error: "La RMV debe ser un número válido." };
  if (!Number.isFinite(uit) || uit <= 0) return { error: "La UIT debe ser un número válido." };
  if (!esPorcentajePlanillaValido(tasaEsSalud)) {
    return { error: "La tasa de EsSalud debe estar entre 0 y 100%." };
  }
  if (!esPorcentajePlanillaValido(tasaOnp)) {
    return { error: "La tasa de ONP debe estar entre 0 y 100%." };
  }
  if (!vigenteDesde) {
    return { error: "Ingrese una fecha de vigencia válida." };
  }

  await prisma.parametroPlanilla.create({
    data: {
      rmv,
      uit,
      tasaEsSalud,
      tasaOnp,
      vigenteDesde,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath("/rrhh/planilla/parametros");
  return { ok: true };
}

export async function crearTasaAfp(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([...ROLES_RRHH]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "rrhh", "crear"))) {
    return { error: "No tiene permiso para crear registros de planilla." };
  }

  const afp = String(formData.get("afp") ?? "");
  const tipoComision = String(formData.get("tipoComision") ?? "FLUJO");
  const tasaAporteObligatorio = Number(formData.get("tasaAporteObligatorio") ?? 10);
  const tasaComision = Number(formData.get("tasaComision") ?? 0);
  const primaSeguro = Number(formData.get("primaSeguro") ?? 0);
  const vigenteDesdeRaw = String(formData.get("vigenteDesde") ?? "");
  const vigenteDesde = crearFechaCalendarioLocal(vigenteDesdeRaw);

  if (!esValorEnum(Object.values(Afp), afp)) {
    return { error: "Seleccione la AFP." };
  }
  if (!esValorEnum(Object.values(TipoComisionAfp), tipoComision)) {
    return { error: "Seleccione el tipo de comisión." };
  }
  if (!esPorcentajePlanillaValido(tasaAporteObligatorio)) {
    return { error: "El aporte obligatorio debe estar entre 0 y 100%." };
  }
  if (!esPorcentajePlanillaValido(tasaComision)) {
    return { error: "La comisión debe estar entre 0 y 100%." };
  }
  if (!esPorcentajePlanillaValido(primaSeguro)) {
    return { error: "La prima de seguro debe estar entre 0 y 100%." };
  }
  if (!vigenteDesde) {
    return { error: "Ingrese una fecha de vigencia válida." };
  }

  await prisma.tasaAfp.create({
    data: { afp, tipoComision, tasaAporteObligatorio, tasaComision, primaSeguro, vigenteDesde },
  });

  revalidatePath("/rrhh/planilla/parametros");
  return { ok: true };
}
