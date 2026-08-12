import type { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Facturación electrónica SUNAT vía OSE (Operador de Servicios Electrónicos).
//
// Arquitectura tipo adaptador: el resto del sistema solo llama a
// `enviarComprobanteElectronico()` después de crear una Factura/NotaCredito/
// GuiaRemision (fuera de la transacción de base de datos, porque es una
// llamada de red). Esta función resuelve qué adaptador usar según
// ConfiguracionEmpresa.oseProveedor y deja el resultado en el ledger
// ComprobanteElectronico — nunca lanza, "best-effort" igual que el motor
// contable: si el envío falla, el documento comercial ya existe y queda
// PENDIENTE/ERROR para reintentar manualmente desde la UI.
//
// Por defecto oseProveedor = "SIMULADO": no se envía nada real a SUNAT. El
// adaptador NUBEFACT de abajo está escrito según la documentación pública de
// su API JSON v1 (ayuda.nubefact.com + integraciones de referencia), pero NO
// fue probado contra su servicio real — eso requiere una cuenta contratada.
// Antes de usarlo en producción, verificar el endpoint exacto y los nombres
// de campo de la respuesta contra el manual vigente que Nubefact entrega a
// sus clientes.
// ---------------------------------------------------------------------------

export type ItemComprobante = {
  descripcion: string;
  unidadMedida: string; // código Catálogo 03 SUNAT (NIU, KGM, GLL, LTR...)
  cantidad: number;
  valorUnitario: number; // sin IGV
};

// Datos propios de la guía de remisión — sin montos (una guía no es un
// documento de cobro), con los campos que SUNAT exige y que la versión
// anterior de este adaptador no armaba en absoluto.
export type DatosGuia = {
  destinatarioRuc: string;
  destinatarioDenominacion: string;
  fechaTraslado: Date;
  pesoBrutoTotal: number;
  modalidadTransporte: $Enums.ModalidadTransporte;
  puntoPartidaDireccion: string;
  puntoPartidaUbigeo: string;
  puntoLlegadaDireccion: string;
  puntoLlegadaUbigeo: string;
  motivoTraslado: string;
  transportistaRuc?: string | null;
  transportistaDenominacion?: string | null;
  placaVehiculo?: string | null;
  dniConductor?: string | null;
};

export type DatosComprobante = {
  tipoDocumento: $Enums.TipoComprobanteElectronico;
  serie: string;
  numero: number; // parte numérica, sin ceros a la izquierda
  clienteRuc: string;
  clienteDenominacion: string;
  clienteDireccion?: string | null;
  fechaEmision: Date;
  moneda: string;
  totalGravada: number;
  totalIgv: number;
  total: number;
  tasaIgv?: number;
  items: ItemComprobante[];
  // Datos propios de la nota de crédito (solo tipoDocumento = NOTA_CREDITO)
  facturaAfectadaSerie?: string;
  facturaAfectadaNumero?: string;
  motivo?: string;
  tipoNota?: string; // código Catálogo 9 SUNAT ("01".."10"), no el motivo en texto libre
  // Datos propios de la guía (solo tipoDocumento = GUIA_REMISION)
  guia?: DatosGuia;
};

export type ResultadoEnvioOse = {
  ok: boolean;
  estado: $Enums.EstadoEnvioSunat;
  sunatDescripcion?: string;
  codigoHash?: string;
  enlacePdf?: string;
  enlaceXml?: string;
  enlaceCdr?: string;
};

type CredencialesOse = {
  ruc: string;
  token: string;
  razonSocial: string;
  direccion?: string | null;
  sunatCertificadoBase64?: string | null;
  sunatCertificadoPassword?: string | null;
  sunatUsuarioSol?: string | null;
  sunatClaveSol?: string | null;
};

interface AdaptadorOse {
  enviar(datos: DatosComprobante, credenciales: CredencialesOse): Promise<ResultadoEnvioOse>;
}

// --- Adaptador simulado -----------------------------------------------------
// No llama a ningún servicio real. Existe para poder probar el flujo completo
// (creación del documento, ledger de estado, UI de reintento) sin tener un
// OSE contratado todavía. Simula una aceptación inmediata de SUNAT.
const adaptadorSimulado: AdaptadorOse = {
  async enviar(datos) {
    return {
      ok: true,
      estado: "ACEPTADO",
      sunatDescripcion: "Simulado — no se envió nada real a SUNAT.",
      codigoHash: `SIMULADO-${datos.serie}-${datos.numero}`,
    };
  },
};

// --- Adaptador Nubefact ------------------------------------------------------
const TIPO_COMPROBANTE_NUBEFACT: Record<$Enums.TipoComprobanteElectronico, number> = {
  FACTURA: 1,
  NOTA_CREDITO: 3,
  GUIA_REMISION: 7,
};

// Nubefact factura/nota de crédito: documento de cobro con montos e ítems
// valorizados — comparte casi toda la estructura entre ambos tipos.
function armarBodyFacturaONotaCredito(datos: DatosComprobante, fechaDeEmision: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    operacion: "generar_comprobante",
    tipo_de_comprobante: TIPO_COMPROBANTE_NUBEFACT[datos.tipoDocumento],
    serie: datos.serie,
    numero: datos.numero,
    sunat_transaction: 1,
    cliente_tipo_de_documento: 6, // RUC (este sistema solo emite Factura, no Boleta)
    cliente_numero_de_documento: datos.clienteRuc,
    cliente_denominacion: datos.clienteDenominacion,
    cliente_direccion: datos.clienteDireccion ?? "",
    fecha_de_emision: fechaDeEmision,
    moneda: datos.moneda === "PEN" ? 1 : 2,
    porcentaje_de_igv: datos.totalGravada > 0 ? (datos.totalIgv / datos.totalGravada) * 100 : 18,
    total_gravada: datos.totalGravada,
    total_igv: datos.totalIgv,
    total: datos.total,
    enviar_automaticamente_a_la_sunat: true,
    items: datos.items.map((i) => ({
      unidad_de_medida: i.unidadMedida,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      valor_unitario: i.valorUnitario,
      tipo_de_igv: 1, // gravado - operación onerosa
      igv: Math.round(i.valorUnitario * i.cantidad * 0.18 * 100) / 100,
      total: Math.round(i.valorUnitario * i.cantidad * 1.18 * 100) / 100,
    })),
  };

  if (datos.tipoDocumento === "NOTA_CREDITO") {
    // Código real del Catálogo 9 SUNAT (armado en catalogosSunat.ts a partir
    // del tipoNota elegido) — antes se mandaba siempre "8 - Otros" sin
    // importar el motivo real.
    body.tipo_de_nota_de_credito = Number(datos.tipoNota ?? "10");
    body.documento_que_se_modifica_tipo = 1; // Factura
    body.documento_que_se_modifica_serie = datos.facturaAfectadaSerie;
    body.documento_que_se_modifica_numero = datos.facturaAfectadaNumero;
    body.motivo = datos.motivo;
  }

  return body;
}

// Nubefact guía de remisión: documento de traslado, sin montos — estructura
// completamente distinta a la de arriba (transportista, vehículo, peso,
// ubigeos, motivo de traslado en vez de ítems valorizados).
function armarBodyGuia(datos: DatosComprobante, fechaDeEmision: string): Record<string, unknown> {
  const guia = datos.guia;
  if (!guia) {
    throw new Error("Faltan los datos de traslado (datos.guia) para armar la guía de remisión.");
  }
  return {
    operacion: "generar_guia",
    tipo_de_comprobante: TIPO_COMPROBANTE_NUBEFACT.GUIA_REMISION,
    serie: datos.serie,
    numero: datos.numero,
    cliente_tipo_de_documento: 6,
    cliente_numero_de_documento: guia.destinatarioRuc,
    cliente_denominacion: guia.destinatarioDenominacion,
    fecha_de_emision: fechaDeEmision,
    fecha_de_inicio_de_traslado: fechaDeEmision,
    motivo_de_traslado: guia.motivoTraslado,
    peso_bruto_total: guia.pesoBrutoTotal,
    peso_bruto_unidad_medida: "KGM",
    modalidad_de_transporte: guia.modalidadTransporte === "PUBLICO" ? "01" : "02",
    transportista_documento_tipo: guia.transportistaRuc ? 6 : undefined,
    transportista_documento_numero: guia.transportistaRuc ?? undefined,
    transportista_denominacion: guia.transportistaDenominacion ?? undefined,
    vehiculo_placa_numero: guia.placaVehiculo ?? undefined,
    conductor_documento_numero: guia.dniConductor ?? undefined,
    punto_de_partida_ubigeo: guia.puntoPartidaUbigeo,
    punto_de_partida_direccion: guia.puntoPartidaDireccion,
    punto_de_llegada_ubigeo: guia.puntoLlegadaUbigeo,
    punto_de_llegada_direccion: guia.puntoLlegadaDireccion,
    enviar_automaticamente_a_la_sunat: true,
    items: datos.items.map((i) => ({
      unidad_de_medida: i.unidadMedida,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
    })),
  };
}

const adaptadorNubefact: AdaptadorOse = {
  async enviar(datos, credenciales) {
    if (!credenciales.ruc || !credenciales.token) {
      return {
        ok: false,
        estado: "ERROR",
        sunatDescripcion: "Falta el RUC o el token del OSE en Configuración → Empresa.",
      };
    }

    const fecha = datos.fechaEmision;
    const fechaDeEmision = `${String(fecha.getDate()).padStart(2, "0")}-${String(
      fecha.getMonth() + 1
    ).padStart(2, "0")}-${fecha.getFullYear()}`;

    const body =
      datos.tipoDocumento === "GUIA_REMISION"
        ? armarBodyGuia(datos, fechaDeEmision)
        : armarBodyFacturaONotaCredito(datos, fechaDeEmision);

    try {
      const respuesta = await fetch(`https://api.nubefact.com/api/v1/${credenciales.ruc}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token token=${credenciales.token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !json) {
        return { ok: false, estado: "ERROR", sunatDescripcion: `HTTP ${respuesta.status}` };
      }
      if (json.errors) {
        return { ok: false, estado: "ERROR", sunatDescripcion: String(json.errors) };
      }

      // No se confirmó contra la API real cuál campo distingue "observado"
      // (válido, con nota) de "rechazado" (inválido) cuando aceptada_por_sunat
      // es false — por seguridad se asume RECHAZADO (el error más visible)
      // en vez de OBSERVADO (que implicaría que el comprobante es válido).
      return {
        ok: json.aceptada_por_sunat === true,
        estado: json.aceptada_por_sunat ? "ACEPTADO" : "RECHAZADO",
        sunatDescripcion: json.sunat_description ?? undefined,
        codigoHash: json.codigo_hash ?? undefined,
        enlacePdf: json.enlace_del_pdf ?? undefined,
        enlaceXml: json.enlace_del_xml ?? undefined,
        enlaceCdr: json.enlace_del_cdr ?? undefined,
      };
    } catch (e) {
      return {
        ok: false,
        estado: "ERROR",
        sunatDescripcion: e instanceof Error ? e.message : "Error de red al llamar al OSE.",
      };
    }
  },
};

// --- Adaptador directo a SUNAT (SEE - Del Contribuyente) -------------------
// Sin OSE intermediario: arma el XML UBL 2.1 (sunatUbl.ts), lo firma con el
// certificado digital de la empresa (sunatFirma.ts) y lo envía por SOAP
// directo al webservice de SUNAT (sunatSoap.ts). No tiene modo simulado —
// sin certificado y credenciales SOL reales configuradas, falla explícito.
const adaptadorSunatDirecto: AdaptadorOse = {
  async enviar(datos, credenciales) {
    if (
      !credenciales.ruc ||
      !credenciales.sunatCertificadoBase64 ||
      !credenciales.sunatCertificadoPassword ||
      !credenciales.sunatUsuarioSol ||
      !credenciales.sunatClaveSol
    ) {
      return {
        ok: false,
        estado: "ERROR",
        sunatDescripcion:
          "Falta el certificado digital, su contraseña, o el usuario/clave SOL en Configuración → Empresa.",
      };
    }

    try {
      const { construirFacturaUBL, construirNotaCreditoUBL, construirGuiaRemisionUBL } = await import(
        "@/lib/sunatUbl"
      );
      const { firmarXml } = await import("@/lib/sunatFirma");
      const { enviarSunatDirecto } = await import("@/lib/sunatSoap");

      const emisor = {
        ruc: credenciales.ruc,
        razonSocial: credenciales.razonSocial,
        direccion: credenciales.direccion,
      };

      const xmlSinFirmar =
        datos.tipoDocumento === "FACTURA"
          ? construirFacturaUBL(datos, emisor)
          : datos.tipoDocumento === "NOTA_CREDITO"
            ? construirNotaCreditoUBL(datos, emisor)
            : construirGuiaRemisionUBL(datos, emisor);

      const xmlFirmado = firmarXml(
        xmlSinFirmar,
        credenciales.sunatCertificadoBase64,
        credenciales.sunatCertificadoPassword
      );

      const resultado = await enviarSunatDirecto({
        tipoDocumento: datos.tipoDocumento,
        rucEmisor: credenciales.ruc,
        serie: datos.serie,
        numero: datos.numero,
        xmlFirmado,
        usuarioSol: credenciales.sunatUsuarioSol,
        claveSol: credenciales.sunatClaveSol,
      });

      if (!resultado.ok) {
        return { ok: false, estado: "ERROR", sunatDescripcion: resultado.error };
      }

      return {
        ok: resultado.aceptado,
        estado: resultado.aceptado ? "ACEPTADO" : "RECHAZADO",
        sunatDescripcion: resultado.descripcion ?? `Código de respuesta: ${resultado.codigoRespuesta ?? "?"}`,
      };
    } catch (e) {
      return {
        ok: false,
        estado: "ERROR",
        sunatDescripcion: e instanceof Error ? e.message : "Error al construir/firmar/enviar el XML a SUNAT.",
      };
    }
  },
};

const ADAPTADORES: Record<string, AdaptadorOse> = {
  SIMULADO: adaptadorSimulado,
  NUBEFACT: adaptadorNubefact,
  SUNAT_DIRECTO: adaptadorSunatDirecto,
};

// Punto de entrada único. Llamar SIEMPRE después de que la transacción que
// creó el documento comercial ya haya hecho commit (es una llamada de red,
// no debe correr dentro de una transacción de Prisma). Nunca lanza.
export async function enviarComprobanteElectronico(params: {
  tipoDocumento: $Enums.TipoComprobanteElectronico;
  documentoId: string;
  numeroDocumento: string;
  datos: DatosComprobante;
}): Promise<void> {
  try {
    const config = await prisma.configuracionEmpresa.findUnique({ where: { id: "1" } });
    const proveedor = config?.oseProveedor ?? "SIMULADO";
    const adaptador = ADAPTADORES[proveedor] ?? adaptadorSimulado;

    const registro = await prisma.comprobanteElectronico.upsert({
      where: {
        empresaId_tipoDocumento_documentoId: {
          empresaId: "1",
          tipoDocumento: params.tipoDocumento,
          documentoId: params.documentoId,
        },
      },
      update: {},
      create: {
        tipoDocumento: params.tipoDocumento,
        documentoId: params.documentoId,
        numeroDocumento: params.numeroDocumento,
        proveedorOse: proveedor,
      },
    });

    let resultado: ResultadoEnvioOse;
    try {
      resultado = await adaptador.enviar(params.datos, {
        ruc: config?.ruc ?? "",
        token: config?.oseToken ?? "",
        razonSocial: config?.razonSocial ?? "",
        direccion: config?.direccion,
        sunatCertificadoBase64: config?.sunatCertificadoBase64,
        sunatCertificadoPassword: config?.sunatCertificadoPassword,
        sunatUsuarioSol: config?.sunatUsuarioSol,
        sunatClaveSol: config?.sunatClaveSol,
      });
    } catch (e) {
      resultado = {
        ok: false,
        estado: "ERROR",
        sunatDescripcion: e instanceof Error ? e.message : "Error desconocido al enviar el comprobante.",
      };
    }

    await prisma.comprobanteElectronico.update({
      where: { id: registro.id },
      data: {
        estado: resultado.estado,
        proveedorOse: proveedor,
        sunatDescripcion: resultado.sunatDescripcion,
        codigoHash: resultado.codigoHash,
        enlacePdf: resultado.enlacePdf,
        enlaceXml: resultado.enlaceXml,
        enlaceCdr: resultado.enlaceCdr,
        intentos: { increment: 1 },
        ultimoIntentoEn: new Date(),
      },
    });
  } catch (e) {
    // Nunca debe bloquear la operación comercial que ya se creó (factura,
    // NC). El estado queda como PENDIENTE (el registro puede ni haberse
    // llegado a crear) y se reintenta manualmente desde la UI.
    console.error("Error al enviar comprobante electrónico:", e);
  }
}

// Reintento manual desde la UI: reconstruye los mismos `datos` no es posible
// de forma genérica (dependen del documento original), así que cada módulo
// expone su propio `reenviarXxx` que arma `datos` de nuevo y llama a
// `enviarComprobanteElectronico`. Este helper solo lee el estado actual.
export async function estadoComprobanteElectronico(
  tipoDocumento: $Enums.TipoComprobanteElectronico,
  documentoId: string
) {
  return prisma.comprobanteElectronico.findUnique({
    where: {
      empresaId_tipoDocumento_documentoId: { empresaId: "1", tipoDocumento, documentoId },
    },
  });
}
