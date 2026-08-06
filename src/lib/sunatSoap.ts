import JSZip from "jszip";
import type { $Enums } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Envío directo a SUNAT (SEE - Del Contribuyente) por el webservice SOAP
// `billService` (Factura/Nota de Crédito) o `guiaRemisionElectronicaService`
// (Guía de Remisión), sin pasar por un OSE intermediario.
//
// NO fue probado contra el ambiente beta ni producción de SUNAT — requiere
// un usuario secundario SOL con clave y un certificado digital real que
// XXOil todavía no tiene. Antes de usar en producción, verificar:
//  - Que el endpoint (hoy apunta a producción) y la operación SOAP sigan
//    vigentes en la documentación técnica de SUNAT.
//  - Que el parseo del CDR (hecho con expresiones regulares simples, sin
//    parser XML completo) cubra los casos reales de respuesta.
// ---------------------------------------------------------------------------

const ENDPOINT_BILL_SERVICE = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";
const ENDPOINT_GUIA_SERVICE = "https://e-guiaremision.sunat.gob.pe/ol-ti-itemision-guia-gem/billService";

// Catálogo 01 de SUNAT (tipo de documento) usado en el nombre del archivo.
const CODIGO_TIPO_DOCUMENTO: Record<$Enums.TipoComprobanteElectronico, string> = {
  FACTURA: "01",
  NOTA_CREDITO: "07",
  GUIA_REMISION: "09",
};

export function nombreArchivo(
  rucEmisor: string,
  tipoDocumento: $Enums.TipoComprobanteElectronico,
  serie: string,
  numero: number
): string {
  return `${rucEmisor}-${CODIGO_TIPO_DOCUMENTO[tipoDocumento]}-${serie}-${numero}`;
}

async function comprimirXml(nombreBase: string, xmlFirmado: string): Promise<string> {
  const zip = new JSZip();
  zip.file(`${nombreBase}.xml`, xmlFirmado);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer.toString("base64");
}

function construirSobreSoap(
  rucEmisor: string,
  usuarioSol: string,
  claveSol: string,
  nombreArchivoZip: string,
  contenidoZipBase64: string
): string {
  // Usuario secundario SOL: formato RUC + usuario (ej. "20606595523MODDATOS").
  const usuarioWsSecurity = `${rucEmisor}${usuarioSol}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${usuarioWsSecurity}</wsse:Username>
        <wsse:Password>${claveSol}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${nombreArchivoZip}.zip</fileName>
      <contentFile>${contenidoZipBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export type ResultadoSunatDirecto = {
  ok: boolean;
  aceptado: boolean;
  codigoRespuesta?: string;
  descripcion?: string;
  cdrBase64?: string;
  error?: string;
};

// Extrae <cbc:ResponseCode> y <cbc:Description> del CDR (ApplicationResponse
// UBL dentro del ZIP de respuesta) con una búsqueda simple de texto — no se
// agregó un parser XML completo para esto, dado que solo se necesitan estos
// dos valores. Código 0 = aceptado; cualquier otro código = rechazado u
// observado, según el catálogo de SUNAT.
async function parsearCdr(cdrZipBase64: string): Promise<{ codigo?: string; descripcion?: string }> {
  const zip = await JSZip.loadAsync(Buffer.from(cdrZipBase64, "base64"));
  const archivoXml = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".xml"));
  if (!archivoXml) return {};
  const contenido = await zip.files[archivoXml].async("string");
  const codigo = contenido.match(/<cbc:ResponseCode[^>]*>([^<]*)<\/cbc:ResponseCode>/)?.[1];
  const descripcion = contenido.match(/<cbc:Description[^>]*>([^<]*)<\/cbc:Description>/)?.[1];
  return { codigo, descripcion };
}

export async function enviarSunatDirecto(params: {
  tipoDocumento: $Enums.TipoComprobanteElectronico;
  rucEmisor: string;
  serie: string;
  numero: number;
  xmlFirmado: string;
  usuarioSol: string;
  claveSol: string;
}): Promise<ResultadoSunatDirecto> {
  const nombreBase = nombreArchivo(params.rucEmisor, params.tipoDocumento, params.serie, params.numero);
  const endpoint = params.tipoDocumento === "GUIA_REMISION" ? ENDPOINT_GUIA_SERVICE : ENDPOINT_BILL_SERVICE;

  try {
    const zipBase64 = await comprimirXml(nombreBase, params.xmlFirmado);
    const sobre = construirSobreSoap(
      params.rucEmisor,
      params.usuarioSol,
      params.claveSol,
      nombreBase,
      zipBase64
    );

    const respuesta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "urn:sendBill",
      },
      body: sobre,
    });

    const texto = await respuesta.text();

    if (!respuesta.ok || texto.includes("soapenv:Fault") || texto.includes("soap:Fault")) {
      const mensajeFalla = texto.match(/<faultstring>([^<]*)<\/faultstring>/)?.[1];
      return {
        ok: false,
        aceptado: false,
        error: mensajeFalla ?? `HTTP ${respuesta.status}`,
      };
    }

    const cdrBase64 = texto.match(/<applicationResponse>([^<]*)<\/applicationResponse>/)?.[1];
    if (!cdrBase64) {
      return { ok: false, aceptado: false, error: "La respuesta de SUNAT no incluyó el CDR esperado." };
    }

    const { codigo, descripcion } = await parsearCdr(cdrBase64);
    return {
      ok: true,
      aceptado: codigo === "0",
      codigoRespuesta: codigo,
      descripcion,
      cdrBase64,
    };
  } catch (e) {
    return {
      ok: false,
      aceptado: false,
      error: e instanceof Error ? e.message : "Error de red al enviar el comprobante a SUNAT.",
    };
  }
}
