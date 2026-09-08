import "server-only";

import { prisma } from "@/lib/prisma";
import { siguienteNumeroOrdenCompra } from "@/lib/correlativos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { convertirAPen } from "@/lib/tipoCambio";
import { edtPerteneceAProyecto } from "@/lib/proyectos";
import type { LineaOrdenCompraNormalizada, MonedaOrdenCompra } from "@/lib/lineasOrdenCompra";
import { pasosAplicablesCompra } from "@/lib/aprobacionesCompra";
import type { Prisma } from "@/generated/prisma/client";

export async function crearOrdenCompraDesdeDatos(
  datos: {
    proveedorId: string;
    almacenId: string | null;
    notas: string | null;
    moneda: MonedaOrdenCompra;
    tipoCambio: number;
    lineas: LineaOrdenCompraNormalizada[];
    proyectoId?: string | null;
    edtId?: string | null;
    acuerdoId?: string | null;
    lineasAcuerdo?: Array<LineaOrdenCompraNormalizada & { acuerdoLineaId: string }>;
  },
  actor: { usuarioId: string; usuarioNombre: string; empresaId: string }
): Promise<string> {
  const { montoAprobacionCompras } = await obtenerConfiguracionEmpresa();

  let ocId = "";
  await prisma.$transaction(async (tx) => {
    let acuerdo: Prisma.AcuerdoSuministroGetPayload<{ include: { lineas: true } }> | null = null;
    if (datos.acuerdoId) {
      acuerdo = await tx.acuerdoSuministro.findFirst({
        where: {
          id: datos.acuerdoId,
          empresaId: actor.empresaId,
          proveedorId: datos.proveedorId,
          estado: "ACTIVO",
          vigenteDesde: { lte: new Date() },
          vigenteHasta: { gte: new Date() },
        },
        include: { lineas: true },
      });
      if (!acuerdo) throw new Error("El acuerdo de suministro ya no está vigente.");
      if (acuerdo.moneda !== datos.moneda || acuerdo.tipoCambio.toNumber() !== datos.tipoCambio) {
        throw new Error("La moneda o el tipo de cambio no coincide con el acuerdo.");
      }
      if (!datos.lineasAcuerdo || datos.lineasAcuerdo.length !== datos.lineas.length) {
        throw new Error("Las líneas de la orden no coinciden con el acuerdo.");
      }
      const idsContractuales = new Set(datos.lineasAcuerdo.map((linea) => linea.acuerdoLineaId));
      const lineasCoinciden = datos.lineasAcuerdo.every((linea, indice) => {
        const orden = datos.lineas[indice];
        return (
          orden?.insumoId === linea.insumoId &&
          Math.abs(orden.cantidad - linea.cantidad) <= 1e-9 &&
          Math.abs(orden.costoUnitario - linea.costoUnitario) <= 1e-9
        );
      });
      if (!lineasCoinciden || idsContractuales.size !== datos.lineasAcuerdo.length) {
        throw new Error("Las líneas de la orden no coinciden con el acuerdo.");
      }

      for (const solicitada of datos.lineasAcuerdo) {
        const contractual = acuerdo.lineas.find(
          (linea) => linea.id === solicitada.acuerdoLineaId && linea.insumoId === solicitada.insumoId,
        );
        if (
          !contractual ||
          Math.abs(contractual.precioUnitario.toNumber() - solicitada.costoUnitario) > 1e-9 ||
          contractual.cantidadComprometida.toNumber() - contractual.cantidadLiberada.toNumber() + 1e-9 < solicitada.cantidad
        ) {
          throw new Error("La cantidad o el precio supera las condiciones vigentes del acuerdo.");
        }
        const actualizada = await tx.acuerdoSuministroLinea.updateMany({
          where: { id: contractual.id, cantidadLiberada: contractual.cantidadLiberada },
          data: { cantidadLiberada: { increment: solicitada.cantidad } },
        });
        if (actualizada.count !== 1) {
          throw new Error("El saldo contractual cambió; actualice e intente nuevamente.");
        }
      }
    } else if (datos.lineasAcuerdo?.length) {
      throw new Error("No se indicó el acuerdo de suministro.");
    }

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
    const pasos = await pasosAplicablesCompra(tx, actor.empresaId, totalPen, montoAprobacionCompras.toNumber());
    const oc = await tx.ordenCompra.create({
      data: {
        numero,
        empresaId: actor.empresaId,
        proveedorId: datos.proveedorId,
        almacenId: datos.almacenId,
        moneda: datos.moneda,
        tipoCambio: datos.tipoCambio,
        total,
        notas: datos.notas,
        proyectoId: datos.proyectoId ?? null,
        edtId: datos.edtId ?? null,
        acuerdoId: datos.acuerdoId ?? null,
        estadoAprobacion: pasos.length ? "PENDIENTE" : "NO_REQUERIDA",
        usuarioId: actor.usuarioId,
        usuarioNombre: actor.usuarioNombre,
        detalles: {
          create: datos.lineas.map((l, indice) => ({
            insumoId: l.insumoId,
            acuerdoLineaId: datos.lineasAcuerdo?.[indice]?.acuerdoLineaId,
            cantidad: l.cantidad,
            costoUnitario: l.costoUnitario,
            subtotal: l.cantidad * l.costoUnitario,
            fechaEntregaEsperada: l.fechaEntregaEsperada ?? null,
          })),
        },
        pasosAprobacion: { create: pasos },
      },
    });
    if (
      acuerdo &&
      acuerdo.lineas.every((linea) => {
        const liberada = datos.lineasAcuerdo?.find((item) => item.acuerdoLineaId === linea.id)?.cantidad ?? 0;
        return linea.cantidadLiberada.toNumber() + liberada >= linea.cantidadComprometida.toNumber() - 1e-9;
      })
    ) {
      await tx.acuerdoSuministro.update({ where: { id: acuerdo.id }, data: { estado: "CERRADO" } });
    }
    ocId = oc.id;
  });

  return ocId;
}
