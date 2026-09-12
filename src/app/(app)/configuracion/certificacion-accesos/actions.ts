"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroCampanaCertificacion } from "@/lib/correlativos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import { registrarAuditoriaMaestro } from "@/lib/auditoriaMaestros";
import {
  avanceCampana,
  MENSAJE_ERROR_CERTIFICACION,
  resumirConflictos,
  resumirPermisos,
  validarCertificacion,
} from "@/lib/certificacionAccesos";

export type EstadoFormulario = { error?: string };

async function autorizar() {
  const auth = await requerirRol([]);
  if ("error" in auth) return auth;
  if (auth.usuario.rol !== "ADMIN" || !(await puedeRealizar(auth.usuario, "configuracion", "editar"))) {
    return { error: "Solo un administrador con permiso de configuración certifica accesos." } as const;
  }
  return auth;
}

/**
 * Abrir una campaña: se congela quién tiene qué en este momento.
 *
 * El snapshot es el objeto de la revisión. Si mañana cambia el grupo de
 * alguien, lo certificado sigue siendo lo que se miró — y eso es justamente lo
 * que hace que una certificación sirva de constancia.
 */
export async function abrirCampana(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const abierta = await tx.campanaCertificacionAccesos.count({
        where: { empresaId, estado: "ABIERTA" },
      });
      // Dos campañas abiertas a la vez son dos verdades sobre el mismo acceso.
      if (abierta > 0) {
        throw new Error("Ya hay una campaña abierta. Ciérrela antes de abrir otra.");
      }

      const usuarios = await tx.usuario.findMany({
        where: { empresaId, activo: true },
        include: { grupoSeguridad: { include: { permisos: true } } },
        orderBy: { usuario: "asc" },
      });
      if (usuarios.length === 0) throw new Error("No hay usuarios activos que certificar.");

      // La última conexión sale de la sesión más reciente: es el dato que hoy
      // alimenta la alerta de inactividad, y el que el revisor necesita.
      const sesiones = await tx.sesion.findMany({
        where: { usuarioId: { in: usuarios.map((u) => u.id) } },
        orderBy: { creadoEn: "desc" },
      });
      const ultimoAcceso = new Map<string, Date>();
      for (const s of sesiones) {
        if (!ultimoAcceso.has(s.usuarioId)) ultimoAcceso.set(s.usuarioId, s.creadoEn);
      }

      const numero = await siguienteNumeroCampanaCertificacion(tx, empresaId);
      const campana = await tx.campanaCertificacionAccesos.create({
        data: {
          empresaId,
          numero,
          notas: String(formData.get("notas") ?? "").trim() || null,
          abiertaPorId: auth.usuario.id,
          abiertaPorNombre: auth.usuario.nombre,
          lineas: {
            create: usuarios.map((u) => {
              const permisos = u.grupoSeguridad?.permisos ?? [];
              return {
                usuarioId: u.id,
                usuarioNombre: u.nombre,
                usuarioLogin: u.usuario,
                rol: u.rol,
                grupoNombre: u.grupoSeguridad?.nombre ?? null,
                permisosResumen: u.grupoSeguridad
                  ? resumirPermisos(permisos)
                  : "Sin grupo: el rol gobierna solo",
                conflictosSod: resumirConflictos(
                  permisos.map((p) => ({
                    modulo: p.modulo,
                    puedeCrear: p.puedeCrear,
                    puedeEditar: p.puedeEditar,
                    puedeAprobar: p.puedeAprobar,
                  }))
                ),
                ultimoAccesoEn: ultimoAcceso.get(u.id) ?? null,
              };
            }),
          },
        },
      });

      await registrarAuditoriaMaestro(tx, {
        empresaId,
        entidad: "CampanaCertificacionAccesos",
        registroId: campana.id,
        accion: "CREAR",
        despues: campana,
        usuario: auth.usuario,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo abrir la campaña." };
  }

  revalidatePath("/configuracion/certificacion-accesos");
  return {};
}

/**
 * Decidir sobre un acceso.
 *
 * Revocar **aplica**: desactiva la cuenta. Una certificación donde marcar
 * «revocar» no hace nada es teatro — el acceso seguiría abierto y el papel
 * diría que se quitó. Es reversible desde Usuarios, que es donde se vuelve a
 * otorgar bien.
 */
export async function certificarAcceso(
  lineaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const decision = String(formData.get("decision") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      // El id llega del navegador: se relee con su campaña, acotada a la
      // compañía activa.
      const linea = await tx.certificacionAcceso.findFirst({
        where: { id: lineaId, campana: { empresaId } },
        include: { campana: { select: { estado: true } } },
      });
      if (!linea) throw new Error("La línea no pertenece a la compañía activa.");

      const error = validarCertificacion({
        estadoCampana: linea.campana.estado,
        decision,
        motivo,
        usuarioRevisadoId: linea.usuarioId,
        revisorId: auth.usuario.id,
      });
      if (error) throw new Error(MENSAJE_ERROR_CERTIFICACION[error]);

      // Cierre optimista: si otro revisor decidió entremedio, no se pisa.
      const cerrada = await tx.certificacionAcceso.updateMany({
        where: { id: lineaId, decision: "PENDIENTE" },
        data: {
          decision: decision as "CONFIRMADO" | "REVOCADO",
          motivo: motivo.trim() || null,
          revisadoPorId: auth.usuario.id,
          revisadoPorNombre: auth.usuario.nombre,
          revisadoEn: new Date(),
        },
      });
      if (cerrada.count !== 1) throw new Error("Esa línea ya fue revisada por otra persona.");

      if (decision === "REVOCADO") {
        const antes = await tx.usuario.findFirst({
          where: { id: linea.usuarioId, empresaId },
        });
        if (!antes) throw new Error("El usuario no pertenece a la compañía activa.");
        const despues = await tx.usuario.update({
          where: { id: linea.usuarioId },
          data: { activo: false },
        });
        await registrarAuditoriaMaestro(tx, {
          empresaId,
          entidad: "Usuario",
          registroId: linea.usuarioId,
          accion: "DESACTIVAR",
          antes,
          despues,
          usuario: auth.usuario,
        });
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la decisión." };
  }

  revalidatePath("/configuracion/certificacion-accesos");
  revalidatePath("/configuracion/usuarios");
  return {};
}

// Una certificación a medias no certifica nada: se cierra cuando todas las
// líneas tienen decisión. Lo que sí se puede es cancelarla con motivo.
export async function completarCampana(
  campanaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;
  const empresaId = await obtenerEmpresaActivaId();

  try {
    await prisma.$transaction(async (tx) => {
      const campana = await tx.campanaCertificacionAccesos.findFirst({
        where: { id: campanaId, empresaId },
        include: { lineas: { select: { decision: true } } },
      });
      if (!campana || campana.estado !== "ABIERTA") {
        throw new Error("La campaña ya no está abierta.");
      }
      const avance = avanceCampana(campana.lineas);
      if (!avance.completa) {
        throw new Error(
          `Quedan ${avance.pendientes} accesos sin revisar. Una certificación a medias no certifica nada.`
        );
      }

      const cerrada = await tx.campanaCertificacionAccesos.updateMany({
        where: { id: campanaId, empresaId, estado: "ABIERTA" },
        data: {
          estado: "COMPLETADA",
          completadaEn: new Date(),
          completadaPorId: auth.usuario.id,
          completadaPorNombre: auth.usuario.nombre,
          notas: String(formData.get("notas") ?? "").trim() || undefined,
        },
      });
      if (cerrada.count !== 1) throw new Error("La campaña ya fue cerrada por otro usuario.");
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar la campaña." };
  }

  revalidatePath("/configuracion/certificacion-accesos");
  return {};
}

export async function cancelarCampana(
  campanaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await autorizar();
  if ("error" in auth) return auth;

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Indique por qué se cancela la campaña." };
  if (motivo.length > 500) return { error: "El motivo no puede superar 500 caracteres." };

  const empresaId = await obtenerEmpresaActivaId();
  const cerrada = await prisma.campanaCertificacionAccesos.updateMany({
    where: { id: campanaId, empresaId, estado: "ABIERTA" },
    data: { estado: "CANCELADA", motivoCancelacion: motivo },
  });
  if (cerrada.count !== 1) return { error: "La campaña ya no está abierta." };

  revalidatePath("/configuracion/certificacion-accesos");
  return {};
}
