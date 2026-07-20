"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { siguienteNumeroHojaRuta } from "@/lib/correlativos";

export type EstadoFormulario = { error?: string };

type Visita = { clienteId: string; objetivo: string };

export async function crearHojaRuta(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "crear"))) {
    return { error: "Su grupo de seguridad no permite crear registros en Ventas." };
  }

  const vendedorId = String(formData.get("vendedorId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  let visitas: Visita[];
  try {
    visitas = JSON.parse(String(formData.get("visitas") ?? "[]"));
  } catch {
    return { error: "El detalle de visitas es inválido." };
  }

  if (!vendedorId) return { error: "Seleccione el vendedor." };
  if (!fecha) return { error: "Indique la fecha de la ruta." };
  visitas = visitas.filter((v) => v.clienteId);
  if (visitas.length === 0) return { error: "Agregue al menos un cliente a visitar." };

  let hojaId = "";
  await prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroHojaRuta(tx);
    const hoja = await tx.hojaRuta.create({
      data: {
        numero,
        vendedorId,
        // "T00:00:00" fuerza interpretación en hora local (evita el corrimiento de un día)
        fecha: new Date(`${fecha}T00:00:00`),
        notas,
        usuarioId: auth.usuario.id,
        usuarioNombre: auth.usuario.nombre,
        visitas: {
          create: visitas.map((v, idx) => ({
            clienteId: v.clienteId,
            orden: idx + 1,
            objetivo: v.objetivo.trim() || null,
          })),
        },
      },
    });
    hojaId = hoja.id;
  });

  revalidatePath("/comercial/hojas-ruta");
  redirect(`/comercial/hojas-ruta/${hojaId}`);
}

// Cierra la ruta registrando el resultado de cada visita (auditable).
export async function cerrarHojaRuta(
  hojaId: string,
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "ventas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Ventas." };
  }

  const hoja = await prisma.hojaRuta.findUnique({
    where: { id: hojaId },
    include: { visitas: true },
  });
  if (!hoja) return { error: "La hoja de ruta no existe." };
  if (hoja.estado === "COMPLETADA") return { error: "La ruta ya fue cerrada." };

  await prisma.$transaction(async (tx) => {
    for (const visita of hoja.visitas) {
      const resultado = String(formData.get(`resultado_${visita.id}`) ?? "").trim() || null;
      await tx.hojaRutaVisita.update({ where: { id: visita.id }, data: { resultado } });
    }
    await tx.hojaRuta.update({ where: { id: hojaId }, data: { estado: "COMPLETADA" } });
  });

  revalidatePath("/comercial/hojas-ruta");
  revalidatePath(`/comercial/hojas-ruta/${hojaId}`);
  return {};
}
