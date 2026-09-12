"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { validarPolitica } from "@/lib/escalamientoCobranza";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";

export type EstadoPolitica = { error?: string; aviso?: string };

/** Campo opcional: vacío significa que esa regla no corre. */
function leerOpcional(formData: FormData, nombre: string): number | null {
  const crudo = String(formData.get(nombre) ?? "").trim();
  return crudo === "" ? null : Number(crudo);
}

export async function guardarPoliticaCobranza(
  _prevState: EstadoPolitica,
  formData: FormData
): Promise<EstadoPolitica> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  if (auth.usuario.rol !== "ADMIN" || !(await puedeRealizar(auth.usuario, "configuracion", "editar"))) {
    return { error: "No tiene permiso para configurar la política de cobranza." };
  }

  const datos = {
    diasNivel2: Number(formData.get("diasNivel2")),
    diasNivel3: Number(formData.get("diasNivel3")),
    diasSinRespuesta: leerOpcional(formData, "diasSinRespuesta"),
    diasGraciaCompromiso: leerOpcional(formData, "diasGraciaCompromiso"),
  };
  const error = validarPolitica(datos);
  if (error) return { error };

  const empresaId = await obtenerEmpresaActivaId();
  const pausarEnDisputa = formData.get("pausarEnDisputa") === "on";

  await prisma.$transaction(async (tx) => {
    const antes = await tx.politicaCobranza.findUnique({ where: { empresaId } });
    const despues = await tx.politicaCobranza.upsert({
      where: { empresaId },
      create: {
        empresaId,
        ...datos,
        pausarEnDisputa,
        actualizadoPorId: auth.usuario.id,
        actualizadoPorNombre: auth.usuario.nombre,
      },
      update: {
        ...datos,
        pausarEnDisputa,
        actualizadoPorId: auth.usuario.id,
        actualizadoPorNombre: auth.usuario.nombre,
      },
    });
    // La política decide a quién se persigue por una deuda: quién la cambió y
    // cuándo tiene que quedar registrado como en el resto de los maestros.
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "PoliticaCobranza",
      registroId: despues.id,
      accion: antes ? "ACTUALIZAR" : "CREAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/configuracion/cobranza");
  revalidatePath("/finanzas/cobranza");
  return { aviso: "Política guardada. El escalamiento ya se aplica en la pantalla de cobranza." };
}

// Apagar el escalamiento es borrar la política: sin fila, la cobranza vuelve a
// funcionar como antes. Se prefiere eso a un campo `activa`, que dejaría
// umbrales guardados sin efecto y la duda de si están rigiendo o no.
export async function apagarPoliticaCobranza(): Promise<EstadoPolitica> {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  if (auth.usuario.rol !== "ADMIN" || !(await puedeRealizar(auth.usuario, "configuracion", "editar"))) {
    return { error: "No tiene permiso para configurar la política de cobranza." };
  }

  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.politicaCobranza.findUnique({ where: { empresaId } });
    if (!antes) return;
    await tx.politicaCobranza.delete({ where: { empresaId } });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "PoliticaCobranza",
      registroId: antes.id,
      // ELIMINAR y no DESACTIVAR: la fila se borra de verdad.
      accion: "ELIMINAR",
      antes,
      despues: null,
      usuario: auth.usuario,
    });
  });

  revalidatePath("/configuracion/cobranza");
  revalidatePath("/finanzas/cobranza");
  return {};
}
