"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type $Enums } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { esClaveControlValida } from "@/lib/reglasAsignacionCosto";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoFormulario = { error?: string };

const TIPOS_VALIDOS: $Enums.TipoCuenta[] = [
  "ACTIVO",
  "PASIVO",
  "PATRIMONIO",
  "INGRESO",
  "GASTO",
];

async function planMaestro(empresaId: string) {
  const existente = await prisma.planCuentas.findFirst({ where: { empresaId, esMaestro: true } });
  if (existente) return existente;
  return prisma.planCuentas.create({
    data: { empresaId, codigo: "PCGE", nombre: "Plan Contable General Empresarial", esMaestro: true },
  });
}

export async function crearCuentaContable(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  const codigo = String(formData.get("codigo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as $Enums.TipoCuenta;

  if (!/^\d{2,8}$/.test(codigo)) {
    return { error: "El código debe ser numérico (2 a 8 dígitos, estilo PCGE)." };
  }
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!TIPOS_VALIDOS.includes(tipo)) return { error: "Seleccione el tipo de cuenta." };

  const plan = await planMaestro(empresaId);

  try {
    await prisma.cuentaContable.create({
      data: { planCuentasId: plan.id, codigo, nombre, tipo },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe la cuenta ${codigo} en el plan.` };
    }
    throw e;
  }

  revalidatePath("/finanzas/plan-cuentas");
  return {};
}

export async function alternarActivoCuenta(id: string, activo: boolean) {
  const auth = await requerirRol([]);
  if ("error" in auth) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.cuentaContable.findFirst({ where: { id, planCuentas: { empresaId } } });
    if (!antes) return;
    const despues = await tx.cuentaContable.update({ where: { id }, data: { activo } });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "CuentaContable", registroId: id, accion: activo ? "ACTIVAR" : "DESACTIVAR", antes, despues, usuario: auth.usuario });
  });
  revalidatePath("/finanzas/plan-cuentas");
}

export async function asignarControlContable(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  const clave = String(formData.get("clave") ?? "");
  const cuentaId = String(formData.get("cuentaId") ?? "");

  if (!esClaveControlValida(clave)) return { error: "Seleccione una clave contable válida." };
  if (!cuentaId) return { error: "Seleccione la cuenta contable." };

  const cuentaAsignable = await prisma.cuentaContable.findFirst({
    where: {
      id: cuentaId,
      activo: true,
      planCuentas: { empresaId, esMaestro: true },
    },
    select: { id: true },
  });
  if (!cuentaAsignable) {
    return { error: "Seleccione una cuenta activa del plan contable maestro." };
  }

  await prisma.$transaction(async (tx) => {
    const antes = await tx.controlContable.findUnique({
      where: { empresaId_clave: { empresaId, clave } },
    });
    const despues = await tx.controlContable.upsert({
      where: { empresaId_clave: { empresaId, clave } },
      update: { cuentaId },
      create: { empresaId, clave, cuentaId },
    });
    await registrarAuditoriaMaestro(tx, { empresaId, entidad: "ControlContable", registroId: despues.id, accion: antes ? "ACTUALIZAR" : "CREAR", antes, despues, usuario: auth.usuario });
  });

  revalidatePath("/finanzas/plan-cuentas");
  return {};
}
