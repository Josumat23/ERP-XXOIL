"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { puedeRealizar } from "@/lib/permisos";
import { requerirRolEmpresaActiva as requerirRol } from "@/lib/empresas";

export type EstadoFormulario = { error?: string; ok?: boolean };

/**
 * Marca una incidencia como atendida. No la borra: el rastro de que hubo un
 * hueco en la contabilidad tiene que quedar, con quién lo cerró y qué hizo.
 *
 * Resolver es un acto de contador: quien lo hace declara que ya posteó el
 * asiento a mano o que configuró lo que faltaba. El sistema no puede
 * verificarlo —el asiento manual no lleva vínculo con la incidencia— así que
 * la nota de resolución es obligatoria.
 */
export async function resolverIncidencia(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const id = String(formData.get("id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  if (!id) return { error: "Falta la incidencia." };
  if (!nota) {
    return { error: "Explique qué se hizo: asiento manual, control configurado, período reabierto…" };
  }
  if (nota.length > 500) return { error: "La nota no puede superar los 500 caracteres." };

  // El id viene del navegador: la incidencia tiene que ser de la compañía
  // activa y seguir abierta. `updateMany` condicionado resuelve ambas cosas en
  // una sola escritura, y el count distingue "no es suya" de "ya la cerró otro".
  const resultado = await prisma.incidenciaContable.updateMany({
    where: { id, empresaId: auth.usuario.empresaId, resueltoEn: null },
    data: {
      resueltoEn: new Date(),
      resueltoPorId: auth.usuario.id,
      resueltoPorNombre: auth.usuario.nombre,
      notaResolucion: nota,
    },
  });
  if (resultado.count !== 1) {
    return { error: "La incidencia no existe, no es de esta compañía o ya fue resuelta." };
  }

  revalidatePath("/finanzas/incidencias-contables");
  revalidatePath("/");
  return { ok: true };
}
