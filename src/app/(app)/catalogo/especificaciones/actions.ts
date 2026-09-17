"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, OrganismoEspecificacion } from "@/generated/prisma/client";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { esValorEnum } from "@/lib/enums";
import { etiquetaEspecificacion } from "@/lib/especificaciones";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function crearEspecificacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "materiales", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Materiales." };
  }

  const organismoCrudo = String(formData.get("organismo") ?? "");
  if (!esValorEnum(Object.values(OrganismoEspecificacion), organismoCrudo)) {
    return { error: "Seleccione el organismo que emite la especificación." };
  }
  const organismo = organismoCrudo;
  const codigo = String(formData.get("codigo") ?? "").trim();
  const emisor = String(formData.get("emisor") ?? "").trim() || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  if (!codigo) return { error: "El código es obligatorio (por ejemplo CK-4, A3/B4, 228.31)." };

  // Un código OEM no se lee solo: «228.31» no dice nada sin «Mercedes-Benz», y
  // el certificado lo imprimiría igual de mudo.
  if (organismo === "OEM" && !emisor) {
    return { error: "Para una especificación OEM indique quién la emite (por ejemplo Mercedes-Benz, Volvo, Cummins)." };
  }

  const empresaId = await obtenerEmpresaActivaId();
  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.especificacionTecnica.create({
        data: { empresaId, organismo, codigo, emisor, descripcion },
      });
      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "EspecificacionTecnica",
        registroId: registro.id,
        accion: "CREAR",
        despues: registro,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Ya existe ${etiquetaEspecificacion({ organismo, codigo, emisor })} en el catálogo.` };
    }
    throw e;
  }

  revalidatePath("/catalogo/especificaciones");
  return { ok: true };
}

export async function alternarActivoEspecificacion(id: string, activo: boolean) {
  const auth = await requerirRol(["ALMACEN"]);
  if ("error" in auth) return;
  if (!(await puedeRealizar(auth.usuario, "materiales", "editar"))) return;
  const empresaId = await obtenerEmpresaActivaId();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.especificacionTecnica.findFirstOrThrow({ where: { id, empresaId } });
    const despues = await tx.especificacionTecnica.update({
      where: { id, empresaId },
      data: { activo },
    });
    await registrarAuditoriaMaestro(tx, {
      empresaId,
      entidad: "EspecificacionTecnica",
      registroId: id,
      accion: activo ? "ACTIVAR" : "DESACTIVAR",
      antes,
      despues,
      usuario: auth.usuario,
    });
  });
  revalidatePath("/catalogo/especificaciones");
}
