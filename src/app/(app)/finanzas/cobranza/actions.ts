"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { diasVencidos } from "@/lib/cobranza";

export async function registrarAvisoCobranza(facturaId: string) {
  const auth = await requerirRol(["VENTAS"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "editar"))) {
    return { error: "Su grupo de seguridad no permite editar registros en Finanzas." };
  }

  const factura = await prisma.factura.findUnique({ where: { id: facturaId } });
  if (!factura) return { error: "La factura no existe." };
  if (factura.saldo.toNumber() <= 1e-9) return { error: "Esta factura ya no tiene saldo pendiente." };

  const dias = diasVencidos(factura.fechaVencimiento);
  const nivel = dias > 30 ? 3 : dias > 15 ? 2 : 1;

  await prisma.avisoCobranza.create({
    data: {
      clienteId: factura.clienteId,
      facturaId,
      nivel,
      diasVencidos: dias,
      usuarioId: auth.usuario.id,
      usuarioNombre: auth.usuario.nombre,
    },
  });

  revalidatePath("/finanzas/cobranza");
  return {};
}

export async function alternarBloqueoCliente(clienteId: string, bloquear: boolean) {
  const auth = await requerirRol(["GERENCIA"]);
  if ("error" in auth) return auth;
  if (!(await puedeRealizar(auth.usuario, "finanzas", "aprobar"))) {
    return { error: "Su grupo de seguridad no permite bloquear clientes por cobranza." };
  }

  await prisma.cliente.update({
    where: { id: clienteId },
    data: bloquear
      ? { bloqueadoCobranza: true, bloqueadoCobranzaEn: new Date(), bloqueadoCobranzaPor: auth.usuario.nombre }
      : { bloqueadoCobranza: false, bloqueadoCobranzaEn: null, bloqueadoCobranzaPor: null },
  });

  revalidatePath("/finanzas/cobranza");
  revalidatePath("/comercial/clientes");
  return {};
}
