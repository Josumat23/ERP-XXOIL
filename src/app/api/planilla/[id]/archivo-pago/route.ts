import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";

// Exportador GENÉRICO de archivo de pago de haberes — NO es el formato exacto
// de carga masiva de ningún banco (BBVA u otro). Contiene los datos mínimos
// que cualquier banca empresas pide para un pago masivo (documento, nombre,
// cuenta, CCI, monto). Usar como referencia para cargar manualmente en el
// portal del banco, o como base para adaptar al formato oficial una vez que
// XXOil obtenga la plantilla real de su ejecutivo de banca empresas — ver
// docs/gobernanza/04-hcm-nomina-investigacion-normativa.md, sección 5.
const TIPOS_PAGABLES = ["MENSUAL", "GRATIFICACION_JULIO", "GRATIFICACION_DICIEMBRE"] as const;

function csvEscape(valor: string): string {
  if (valor.includes(",") || valor.includes('"') || valor.includes("\n")) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (
    (usuario.rol !== "ADMIN" && usuario.rol !== "GERENCIA") ||
    !(await puedeRealizar(usuario, "rrhh", "ver"))
  ) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { id } = await params;
  const periodo = await prisma.planillaPeriodo.findUnique({
    where: { id },
    include: { detalles: { include: { empleado: true }, orderBy: { empleado: { codigo: "asc" } } } },
  });
  if (!periodo) return NextResponse.json({ error: "El período no existe." }, { status: 404 });
  if (!TIPOS_PAGABLES.includes(periodo.tipo as (typeof TIPOS_PAGABLES)[number])) {
    return NextResponse.json(
      { error: "Este tipo de período no se paga por transferencia a la cuenta de haberes (ej. CTS se deposita en la cuenta CTS del trabajador)." },
      { status: 400 }
    );
  }

  const filas = [
    ["Tipo Doc.", "N° Documento", "Apellidos y Nombres", "Banco", "N° Cuenta", "CCI", "Monto", "Concepto"],
    ...periodo.detalles.map((d) => [
      d.empleado.tipoDocumentoIdentidad,
      d.empleado.dni ?? "",
      `${d.empleado.apellidos} ${d.empleado.nombres}`,
      d.empleado.banco ?? "",
      d.empleado.numeroCuenta ?? "",
      d.empleado.cci ?? "",
      d.neto.toFixed(2),
      `Planilla ${periodo.mes}/${periodo.anio}`,
    ]),
  ];

  const sinDatosBancarios = periodo.detalles.filter((d) => !d.empleado.banco || !d.empleado.numeroCuenta);
  if (sinDatosBancarios.length > 0) {
    filas.push([]);
    filas.push([`ADVERTENCIA: ${sinDatosBancarios.length} trabajador(es) sin banco/cuenta registrados — completar en su ficha antes de pagar.`]);
  }

  const contenido = "﻿" + filas.map((f) => f.map((c) => csvEscape(String(c))).join(",")).join("\r\n");
  const nombreArchivo = `pago-haberes_${periodo.tipo}_${periodo.anio}-${String(periodo.mes).padStart(2, "0")}.csv`;

  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
