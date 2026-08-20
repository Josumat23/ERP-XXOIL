"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { validarArchivoCertificadoSunat } from "@/lib/certificadoSunat";
import { resolverSecretoFormulario } from "@/lib/secretosFormulario";

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function guardarConfiguracionEmpresa(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const razonSocial = String(formData.get("razonSocial") ?? "").trim();
  const nombreComercial = String(formData.get("nombreComercial") ?? "").trim() || null;
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const direccion2 = String(formData.get("direccion2") ?? "").trim() || null;
  const ciudad = String(formData.get("ciudad") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const departamento = String(formData.get("departamento") ?? "").trim() || null;
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim() || null;
  const pais = String(formData.get("pais") ?? "").trim() || "Perú";
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const fax = String(formData.get("fax") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const sitioWeb = String(formData.get("sitioWeb") ?? "").trim() || null;
  const tasaIgv = Number(formData.get("tasaIgv"));
  const registroHidrocarburosOsinergmin =
    String(formData.get("registroHidrocarburosOsinergmin") ?? "").trim() || null;
  const registroHidrocarburosVigenciaRaw = String(formData.get("registroHidrocarburosVigencia") ?? "").trim();
  const registroHidrocarburosVigencia = registroHidrocarburosVigenciaRaw
    ? new Date(`${registroHidrocarburosVigenciaRaw}T00:00:00`)
    : null;
  const tarifaHoraManoObra = Number(formData.get("tarifaHoraManoObra"));
  const montoAprobacionCompras = Number(formData.get("montoAprobacionCompras"));
  const montoAprobacionPagos = Number(formData.get("montoAprobacionPagos"));
  const tasaDescuentoCxC = Number(formData.get("tasaDescuentoCxC"));
  const tasaCreditoCortoPlazo = Number(formData.get("tasaCreditoCortoPlazo"));
  const limiteCreditoCortoPlazo = Number(formData.get("limiteCreditoCortoPlazo"));
  const tasaCreditoLargoPlazo = Number(formData.get("tasaCreditoLargoPlazo"));
  const tasaRecargoMora = Number(formData.get("tasaRecargoMora") ?? 0);
  const oseProveedor = String(formData.get("oseProveedor") ?? "SIMULADO");
  const oseTokenIngresado = formData.get("oseToken");
  const sunatUsuarioSol = String(formData.get("sunatUsuarioSol") ?? "").trim() || null;
  const sunatClaveSolIngresada = formData.get("sunatClaveSol");
  const sunatCertificadoPasswordIngresada = formData.get("sunatCertificadoPassword");

  if (!razonSocial) return { error: "La razón social es obligatoria." };
  if (ruc && !/^\d{11}$/.test(ruc)) return { error: "El RUC debe tener 11 dígitos." };
  if (!Number.isFinite(tasaIgv) || tasaIgv < 0 || tasaIgv > 30) {
    return { error: "La tasa de IGV debe estar entre 0 y 30%." };
  }
  if (!Number.isFinite(tarifaHoraManoObra) || tarifaHoraManoObra < 0) {
    return { error: "La tarifa de mano de obra debe ser mayor o igual a 0." };
  }
  if (!Number.isFinite(montoAprobacionCompras) || montoAprobacionCompras < 0) {
    return { error: "El monto de aprobación de compras debe ser mayor o igual a 0." };
  }
  if (!Number.isFinite(montoAprobacionPagos) || montoAprobacionPagos < 0) {
    return { error: "El monto de aprobación de pagos debe ser mayor o igual a 0." };
  }
  if (
    !Number.isFinite(tasaDescuentoCxC) ||
    !Number.isFinite(tasaCreditoCortoPlazo) ||
    !Number.isFinite(limiteCreditoCortoPlazo) ||
    !Number.isFinite(tasaCreditoLargoPlazo) ||
    tasaDescuentoCxC < 0 ||
    tasaCreditoCortoPlazo < 0 ||
    limiteCreditoCortoPlazo < 0 ||
    tasaCreditoLargoPlazo < 0
  ) {
    return { error: "Las tasas y el límite de financiamiento deben ser números válidos mayores o iguales a 0." };
  }
  if (!Number.isFinite(tasaRecargoMora) || tasaRecargoMora < 0) {
    return { error: "La tasa de recargo por mora debe ser un número válido mayor o igual a 0." };
  }
  if (!["SIMULADO", "NUBEFACT", "SUNAT_DIRECTO"].includes(oseProveedor)) {
    return { error: "Seleccione un proveedor OSE válido." };
  }
  const existente = await prisma.configuracionEmpresa.findUnique({ where: { id: "1" } });
  const oseToken = resolverSecretoFormulario(oseTokenIngresado, existente?.oseToken ?? null);
  const sunatClaveSol = resolverSecretoFormulario(
    sunatClaveSolIngresada,
    existente?.sunatClaveSol ?? null
  );
  const sunatCertificadoPassword = resolverSecretoFormulario(
    sunatCertificadoPasswordIngresada,
    existente?.sunatCertificadoPassword ?? null
  );

  if (oseProveedor === "NUBEFACT" && (!ruc || !oseToken)) {
    return {
      error: "Para usar Nubefact, complete el RUC de la empresa y el token del proveedor.",
    };
  }

  // El certificado (.pfx/.p12) solo se reemplaza si se subió un archivo
  // nuevo — de lo contrario se conserva el que ya estaba guardado.
  const archivoCertificado = formData.get("sunatCertificadoArchivo");
  let sunatCertificadoBase64 = existente?.sunatCertificadoBase64 ?? null;
  if (archivoCertificado instanceof File && archivoCertificado.size > 0) {
    const errorCertificado = validarArchivoCertificadoSunat(archivoCertificado);
    if (errorCertificado) return { error: errorCertificado };
    const buffer = Buffer.from(await archivoCertificado.arrayBuffer());
    sunatCertificadoBase64 = buffer.toString("base64");
  }

  if (
    oseProveedor === "SUNAT_DIRECTO" &&
    (!ruc || !sunatCertificadoBase64 || !sunatCertificadoPassword || !sunatUsuarioSol || !sunatClaveSol)
  ) {
    return {
      error:
        "Para comunicación directa con SUNAT, complete el RUC, el certificado digital (.pfx/.p12), su contraseña, y el usuario/clave SOL secundario.",
    };
  }

  const datos = {
    razonSocial,
    nombreComercial,
    ruc,
    direccion,
    direccion2,
    ciudad,
    distrito,
    provincia,
    departamento,
    codigoPostal,
    pais,
    telefono,
    fax,
    email,
    sitioWeb,
    tasaIgv,
    registroHidrocarburosOsinergmin,
    registroHidrocarburosVigencia,
    tarifaHoraManoObra,
    montoAprobacionCompras,
    montoAprobacionPagos,
    tasaDescuentoCxC,
    tasaCreditoCortoPlazo,
    limiteCreditoCortoPlazo,
    tasaCreditoLargoPlazo,
    tasaRecargoMora,
    oseProveedor,
    oseToken,
    sunatCertificadoBase64,
    sunatCertificadoPassword,
    sunatUsuarioSol,
    sunatClaveSol,
  };

  await prisma.configuracionEmpresa.upsert({
    where: { id: "1" },
    update: datos,
    create: { id: "1", ...datos },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Cuentas bancarias (pie de página de Factura/Nota de Crédito) ----------

export async function agregarCuentaBancaria(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return auth;

  const banco = String(formData.get("banco") ?? "").trim();
  const moneda = String(formData.get("moneda") ?? "PEN") === "USD" ? "USD" : "PEN";
  const numeroCuenta = String(formData.get("numeroCuenta") ?? "").trim();
  const cci = String(formData.get("cci") ?? "").trim() || null;

  if (!banco) return { error: "Ingrese el nombre del banco." };
  if (!numeroCuenta) return { error: "Ingrese el número de cuenta." };

  await prisma.cuentaBancariaEmpresa.create({
    data: { banco, moneda, numeroCuenta, cci },
  });

  revalidatePath("/configuracion/empresa");
  return { ok: true };
}

export async function eliminarCuentaBancaria(id: string): Promise<void> {
  const auth = await requerirRol([]); // solo ADMIN
  if ("error" in auth) return;

  await prisma.cuentaBancariaEmpresa.delete({ where: { id } });
  revalidatePath("/configuracion/empresa");
}
