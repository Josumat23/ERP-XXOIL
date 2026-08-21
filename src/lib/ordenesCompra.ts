import "server-only";

import { prisma } from "@/lib/prisma";
import { siguienteNumeroOrdenCompra } from "@/lib/correlativos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { convertirAPen } from "@/lib/tipoCambio";
import { edtPerteneceAProyecto } from "@/lib/proyectos";
import type { LineaOrdenCompraNormalizada } from "@/lib/lineasOrdenCompra";

export async function crearOrdenCompraDesdeDatos(
  datos: {
    proveedorId: string;
    almacenId: string | null;
    notas: string | null;
    moneda: string;
    tipoCambio: number;
    lineas: LineaOrdenCompraNormalizada[];
    proyectoId?: string | null;
    edtId?: string | null;
  },
  actor: { usuarioId: string; usuarioNombre: string }
): Promise<string> {
  const { montoAprobacionCompras } = await obtenerConfiguracionEmpresa();

  let ocId = "";
  await prisma.$transaction(async (tx) => {
    if (datos.edtId) {
      if (!datos.proyectoId) throw new Error("Seleccione el proyecto al que pertenece la fase.");
      const edt = await tx.edtProyecto.findUnique({
        where: { id: datos.edtId },
        select: { proyectoId: true },
      });
      if (!edtPerteneceAProyecto(edt, datos.proyectoId)) {
        throw new Error("La fase seleccionada no pertenece al proyecto de la orden.");
      }
    }

    const numero = await siguienteNumeroOrdenCompra(tx);
    const total = datos.lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
    const totalPen = convertirAPen(total, datos.moneda, datos.tipoCambio);
    const oc = await tx.ordenCompra.create({
      data: {
        numero,
        proveedorId: datos.proveedorId,
        almacenId: datos.almacenId,
        moneda: datos.moneda,
        tipoCambio: datos.tipoCambio,
        total,
        notas: datos.notas,
        proyectoId: datos.proyectoId ?? null,
        edtId: datos.edtId ?? null,
        estadoAprobacion: totalPen >= montoAprobacionCompras.toNumber() ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: actor.usuarioId,
        usuarioNombre: actor.usuarioNombre,
        detalles: {
          create: datos.lineas.map((l) => ({
            insumoId: l.insumoId,
            cantidad: l.cantidad,
            costoUnitario: l.costoUnitario,
            subtotal: l.cantidad * l.costoUnitario,
            fechaEntregaEsperada: l.fechaEntregaEsperada ?? null,
          })),
        },
      },
    });
    ocId = oc.id;
  });

  return ocId;
}
