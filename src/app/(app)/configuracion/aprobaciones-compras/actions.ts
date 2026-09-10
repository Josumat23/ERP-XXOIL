"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { validarNivelesCompra } from "@/lib/aprobacionesCompra";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
export type EstadoNivel = { error?: string };

export async function crearNivelCompra(_estado: EstadoNivel, formData: FormData): Promise<EstadoNivel> {
  const auth = await requerirRol([]); if ("error" in auth) return auth;
  if (auth.usuario.rol !== "ADMIN" || !(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return { error: "No tiene permiso para configurar niveles." };
  const empresaId = await obtenerEmpresaActivaId();
  const nivel = { orden: Number(formData.get("orden")), nombre: String(formData.get("nombre") ?? "").trim(), montoDesdePen: Number(formData.get("montoDesdePen")), rolAprobador: String(formData.get("rolAprobador")) as "GERENCIA" | "ADMIN" };
  if (!validarNivelesCompra([nivel])) return { error: "Complete un nivel válido." };
  try { await prisma.nivelAprobacionCompra.create({ data: { ...nivel, empresaId } }); }
  catch { return { error: "El orden ya existe o el nivel no pudo guardarse." }; }
  revalidatePath("/configuracion/aprobaciones-compras"); return {};
}

export async function desactivarNivelCompra(id: string): Promise<void> {
  const auth = await requerirRol([]); if ("error" in auth || auth.usuario.rol !== "ADMIN") return;
  if (!(await puedeRealizar(auth.usuario, "configuracion", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.nivelAprobacionCompra.updateMany({ where: { id, empresaId }, data: { activo: false } });
  revalidatePath("/configuracion/aprobaciones-compras");
}
