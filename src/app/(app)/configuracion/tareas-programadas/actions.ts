"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { ejecutarTareaIndividual, type ClaveTarea } from "@/lib/tareasProgramadas";

export async function ejecutarTareaAhora(clave: ClaveTarea) {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;

  await ejecutarTareaIndividual(clave);
  revalidatePath("/configuracion/tareas-programadas");
}
