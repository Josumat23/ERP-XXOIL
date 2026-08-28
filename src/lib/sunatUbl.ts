import type { $Enums } from "@/generated/prisma/client";
import type { DatosComprobante } from "@/lib/facturacionElectronica";
import { CODIGO_MODALIDAD_TRANSPORTE } from "@/lib/catalogosSunat";

// ---------------------------------------------------------------------------
// Construcción de XML UBL 2.1 para SUNAT (SEE - Del Contribuyente).
//
// Escrito según la estructura pública documentada por SUNAT (Resolución de
// Superintendencia que aprueba el Sistema de Emisión Electrónica — Anexos
// técnicos UBL 2.1) y la forma en que la reproducen implementaciones de
// referencia de uso común en Perú. NO fue probado contra el servicio SOAP
// real de SUNAT (ni el ambiente beta ni producción) — eso requiere un
// certificado digital real y credenciales de homologación que XXOil todavía
// no tiene. Antes de usarlo en producción, verificar cada campo contra la
// documentación técnica vigente de SUNAT.
//
// Mismo principio que el adaptador Nubefact ya existente: código real,
// escrito de buena fe según la especificación pública, pendiente de
// verificación contra el servicio real antes de confiar en él para producción.
// ---------------------------------------------------------------------------

export type DatosEmisor = {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccion?: string | null;
  ubigeo?: string | null; // código SUNAT de 6 dígitos de la dirección del emisor
};

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function formatearMonto(monto: number): string {
  return monto.toFixed(2);
}

// Placeholder donde sunatFirma.ts inserta el nodo <ds:Signature> (enveloped,
// dentro de <ext:UBLExtensions>) — obligatorio en todo documento UBL de SUNAT.
const UBL_EXTENSIONS_PLACEHOLDER = `<ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

function bloqueParteSupplier(emisor: DatosEmisor): string {
  return `<cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${escaparXml(emisor.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escaparXml(emisor.razonSocial)}</cbc:RegistrationName>
        ${
          emisor.direccion
            ? `<cac:RegistrationAddress>
          ${emisor.ubigeo ? `<cbc:ID schemeAgencyName="PE:INEI">${escaparXml(emisor.ubigeo)}</cbc:ID>` : ""}
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cac:AddressLine>
            <cbc:Line>${escaparXml(emisor.direccion)}</cbc:Line>
          </cac:AddressLine>
        </cac:RegistrationAddress>`
            : ""
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function bloqueParteCustomer(ruc: string, denominacion: string, direccion?: string | null): string {
  return `<cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${escaparXml(ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escaparXml(denominacion)}</cbc:RegistrationName>
        ${
          direccion
            ? `<cac:RegistrationAddress>
          <cac:AddressLine>
            <cbc:Line>${escaparXml(direccion)}</cbc:Line>
          </cac:AddressLine>
        </cac:RegistrationAddress>`
            : ""
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function bloqueFirma(rucEmisor: string, razonSocialEmisor: string): string {
  // SUNAT exige que el <cac:Signature> apunte al mismo ID que usará
  // sunatFirma.ts como target de la firma XMLDSig.
  return `<cac:Signature>
    <cbc:ID>${escaparXml(rucEmisor)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${escaparXml(rucEmisor)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escaparXml(razonSocialEmisor)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignatureSP</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;
}

function bloqueTaxTotal(totalGravada: number, totalIgv: number, moneda: string): string {
  return `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escaparXml(moneda)}">${formatearMonto(totalIgv)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escaparXml(moneda)}">${formatearMonto(totalGravada)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escaparXml(moneda)}">${formatearMonto(totalIgv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
}

// Catálogo 07 SUNAT: tipo de afectación IGV. 10 = gravado - operación onerosa
// (el único caso que este ERP maneja — no hay ventas exoneradas/inafectas).
function bloqueLineaFactura(
  idx: number,
  item: DatosComprobante["items"][number],
  tasaIgv: number,
  moneda: string
): string {
  const factorIgv = tasaIgv / 100;
  const igvLinea = item.valorUnitario * item.cantidad * factorIgv;
  const totalLinea = item.valorUnitario * item.cantidad + igvLinea;
  return `<cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escaparXml(item.unidadMedida)}">${item.cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${escaparXml(moneda)}">${formatearMonto(item.valorUnitario * item.cantidad)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${escaparXml(moneda)}">${formatearMonto(item.valorUnitario * (1 + factorIgv))}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${escaparXml(moneda)}">${formatearMonto(igvLinea)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${escaparXml(moneda)}">${formatearMonto(item.valorUnitario * item.cantidad)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${escaparXml(moneda)}">${formatearMonto(igvLinea)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${tasaIgv}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${escaparXml(item.descripcion)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${escaparXml(moneda)}">${formatearMonto(item.valorUnitario)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
  <!-- totalLinea (informativo, no forma parte del XML): ${formatearMonto(totalLinea)} -->`;
}

export function construirFacturaUBL(datos: DatosComprobante, emisor: DatosEmisor): string {
  const tasaIgv = datos.tasaIgv;
  if (tasaIgv === undefined || !Number.isFinite(tasaIgv) || tasaIgv < 0) {
    throw new Error("Falta una tasa de IGV válida para construir la factura UBL.");
  }
  const items = datos.items
    .map((item, idx) => bloqueLineaFactura(idx, item, tasaIgv, datos.moneda))
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escaparXml(datos.serie)}-${datos.numero}</cbc:ID>
  <cbc:IssueDate>${formatearFecha(datos.fechaEmision)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escaparXml(datos.moneda)}</cbc:DocumentCurrencyCode>
  ${bloqueFirma(emisor.ruc, emisor.razonSocial)}
  ${bloqueParteSupplier(emisor)}
  ${bloqueParteCustomer(datos.clienteRuc, datos.clienteDenominacion, datos.clienteDireccion)}
  ${bloqueTaxTotal(datos.totalGravada, datos.totalIgv, datos.moneda)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.totalGravada)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${items}
</Invoice>`;
}

export function construirNotaCreditoUBL(datos: DatosComprobante, emisor: DatosEmisor): string {
  const tasaIgv = datos.tasaIgv;
  if (tasaIgv === undefined || !Number.isFinite(tasaIgv) || tasaIgv < 0) {
    throw new Error("Falta una tasa de IGV válida para construir la nota de crédito UBL.");
  }
  const items = datos.items
    .map((item, idx) =>
      bloqueLineaFactura(idx, item, tasaIgv, datos.moneda).replace(/InvoiceLine/g, "CreditNoteLine")
    )
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escaparXml(datos.serie)}-${datos.numero}</cbc:ID>
  <cbc:IssueDate>${formatearFecha(datos.fechaEmision)}</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>${escaparXml(datos.moneda)}</cbc:DocumentCurrencyCode>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${escaparXml(datos.facturaAfectadaSerie ?? "")}-${escaparXml(datos.facturaAfectadaNumero ?? "")}</cbc:ReferenceID>
    <cbc:ResponseCode>${escaparXml(datos.tipoNota ?? "10")}</cbc:ResponseCode>
    <cbc:Description>${escaparXml(datos.motivo ?? "")}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escaparXml(datos.facturaAfectadaSerie ?? "")}-${escaparXml(datos.facturaAfectadaNumero ?? "")}</cbc:ID>
      <cbc:DocumentTypeCode>01</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  ${bloqueFirma(emisor.ruc, emisor.razonSocial)}
  ${bloqueParteSupplier(emisor)}
  ${bloqueParteCustomer(datos.clienteRuc, datos.clienteDenominacion, datos.clienteDireccion)}
  ${bloqueTaxTotal(datos.totalGravada, datos.totalIgv, datos.moneda)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.totalGravada)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escaparXml(datos.moneda)}">${formatearMonto(datos.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${items}
</CreditNote>`;
}

function bloqueDireccionUbigeo(direccion: string, ubigeo: string): string {
  return `<cac:Address>
        <cbc:ID schemeAgencyName="PE:INEI">${escaparXml(ubigeo)}</cbc:ID>
        <cac:AddressLine>
          <cbc:Line>${escaparXml(direccion)}</cbc:Line>
        </cac:AddressLine>
      </cac:Address>`;
}

export function construirGuiaRemisionUBL(datos: DatosComprobante, emisor: DatosEmisor): string {
  const guia = datos.guia;
  if (!guia) {
    throw new Error("Faltan los datos de traslado (datos.guia) para construir el UBL de la guía.");
  }
  const modalidadCodigo = CODIGO_MODALIDAD_TRANSPORTE[guia.modalidadTransporte as $Enums.ModalidadTransporte];

  const items = datos.items
    .map(
      (item, idx) => `<cac:DespatchLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${escaparXml(item.unidadMedida)}">${item.cantidad}</cbc:DeliveredQuantity>
    <cac:OrderLineReference>
      <cbc:LineID>${idx + 1}</cbc:LineID>
    </cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${escaparXml(item.descripcion)}</cbc:Description>
    </cac:Item>
  </cac:DespatchLine>`
    )
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${escaparXml(datos.serie)}-${datos.numero}</cbc:ID>
  <cbc:IssueDate>${formatearFecha(datos.fechaEmision)}</cbc:IssueDate>
  <cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>
  ${bloqueFirma(emisor.ruc, emisor.razonSocial)}
  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${escaparXml(emisor.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escaparXml(emisor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${escaparXml(guia.destinatarioRuc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escaparXml(guia.destinatarioDenominacion)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado">01</cbc:HandlingCode>
    <cbc:HandlingInstructions>${escaparXml(guia.motivoTraslado)}</cbc:HandlingInstructions>
    <cbc:GrossWeightMeasure unitCode="KGM">${formatearMonto(guia.pesoBrutoTotal)}</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <cbc:TransportModeCode listName="Modalidad de transporte">${modalidadCodigo}</cbc:TransportModeCode>
      <cac:TransitPeriod>
        <cbc:StartDate>${formatearFecha(guia.fechaTraslado)}</cbc:StartDate>
      </cac:TransitPeriod>
      ${
        guia.transportistaRuc
          ? `<cac:CarrierParty>
        <cac:PartyIdentification>
          <cbc:ID schemeID="6">${escaparXml(guia.transportistaRuc)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escaparXml(guia.transportistaDenominacion ?? "")}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
      </cac:CarrierParty>`
          : ""
      }
      ${
        guia.placaVehiculo
          ? `<cac:TransportMeans>
        <cac:RoadTransport>
          <cbc:LicensePlateID>${escaparXml(guia.placaVehiculo)}</cbc:LicensePlateID>
        </cac:RoadTransport>
      </cac:TransportMeans>`
          : ""
      }
      ${
        guia.dniConductor
          ? `<cac:DriverPerson>
        <cbc:ID schemeID="1">${escaparXml(guia.dniConductor)}</cbc:ID>
      </cac:DriverPerson>`
          : ""
      }
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        ${bloqueDireccionUbigeo(guia.puntoLlegadaDireccion, guia.puntoLlegadaUbigeo)}
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>
          ${bloqueDireccionUbigeo(guia.puntoPartidaDireccion, guia.puntoPartidaUbigeo)}
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>
  </cac:Shipment>
  ${items}
</DespatchAdvice>`;
}
