"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

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
  const vigenteDesde = vigenteDesdeRaw ? new Date(vigenteDesdeRaw) : null;

  if (!Number.isFinite(rmv) || rmv <= 0) return { error: "La RMV debe ser un número válido." };
  if (!Number.isFinite(uit) || uit <= 0) return { error: "La UIT debe ser un número válido." };
  if (!vigenteDesde || Number.isNaN(vigenteDesde.getTime())) {
    return { error: "La fecha de vigencia es obligatoria." };
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

  const afp = String(formData.get("afp") ?? "") as $Enums.Afp;
  const tipoComision = String(formData.get("tipoComision") ?? "FLUJO") as $Enums.TipoComisionAfp;
  const tasaAporteObligatorio = Number(formData.get("tasaAporteObligatorio") ?? 10);
  const tasaComision = Number(formData.get("tasaComision") ?? 0);
  const primaSeguro = Number(formData.get("primaSeguro") ?? 0);
  const vigenteDesdeRaw = String(formData.get("vigenteDesde") ?? "");
  const vigenteDesde = vigenteDesdeRaw ? new Date(vigenteDesdeRaw) : null;

  if (!["INTEGRA", "PRIMA", "HABITAT", "PROFUTURO"].includes(afp)) {
    return { error: "Seleccione la AFP." };
  }
  if (!Number.isFinite(tasaComision) || tasaComision < 0) {
    return { error: "La comisión debe ser un número válido." };
  }
  if (!Number.isFinite(primaSeguro) || primaSeguro < 0) {
    return { error: "La prima de seguro debe ser un número válido." };
  }
  if (!vigenteDesde || Number.isNaN(vigenteDesde.getTime())) {
    return { error: "La fecha de vigencia es obligatoria." };
  }

  await prisma.tasaAfp.create({
    data: { afp, tipoComision, tasaAporteObligatorio, tasaComision, primaSeguro, vigenteDesde },
  });

  revalidatePath("/rrhh/planilla/parametros");
  return { ok: true };
}
