import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  construirNotaDebitoUBL,
  construirNotaCreditoUBL,
  construirFacturaUBL,
} from "@/lib/sunatUbl";
import type { DatosComprobante } from "@/lib/facturacionElectronica";

// ---------------------------------------------------------------------------
// El UBL de la nota de débito, y una cantidad que estaba mal en la de crédito.
//
// De los cuatro documentos que el envío DIRECTO a SUNAT sabe mandar —factura,
// boleta, nota de crédito y guía— faltaba la nota de débito: se podía emitir
// por un OSE, que arma el XML por su cuenta, pero no firmándola acá.
//
// Al escribirla apareció otra cosa. La nota de crédito reutilizaba la línea de
// la factura y le cambiaba el nombre con
// `.replace(/InvoiceLine/g, "CreditNoteLine")`: eso renombra la etiqueta de
// afuera y deja `<cbc:InvoicedQuantity>` adentro, que NO es hijo válido de
// `cac:CreditNoteLine` en UBL 2.1 —lleva `cbc:CreditedQuantity`—. El XML
// violaba el esquema y SUNAT lo habría rechazado. No se notó porque el envío
// directo espera el certificado digital y nunca se mandó una de verdad.
//
// Las tres diferencias entre nota de débito y nota de crédito salen del
// esquema UBL 2.1 y del ejemplo oficial de OASIS, no de la memoria:
// raíz `DebitNote`, `cac:RequestedMonetaryTotal` en lugar de
// `cac:LegalMonetaryTotal`, y `cac:DebitNoteLine` con `cbc:DebitedQuantity`.
// ---------------------------------------------------------------------------

const EMISOR = {
  ruc: "20123456789",
  razonSocial: "Grasas y Lubricantes del Perú S.A.C.",
  direccion: "Av. Industrial 123, Lima",
  ubigeo: "150101",
};

const DATOS: DatosComprobante = {
  tipoDocumento: "NOTA_DEBITO",
  serie: "FD01",
  numero: 1,
  clienteRuc: "20987654321",
  clienteDenominacion: "Minera del Sur S.A.",
  clienteDireccion: "Carretera Central km 40",
  fechaEmision: new Date("2026-09-21T10:00:00Z"),
  moneda: "PEN",
  totalGravada: 100,
  totalIgv: 18,
  total: 118,
  tasaIgv: 18,
  items: [
    { descripcion: "Interés por mora factura F001-123", unidadMedida: "NIU", cantidad: 1, valorUnitario: 100 },
  ],
  facturaAfectadaSerie: "F001",
  facturaAfectadaNumero: "123",
  motivo: "Intereses por pago fuera de plazo",
  tipoNota: "01",
};

test("la nota de débito es un DebitNote, no una nota de crédito renombrada", () => {
  const xml = construirNotaDebitoUBL(DATOS, EMISOR);
  assert.match(xml, /<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2"/);
  assert.match(xml, /<\/DebitNote>/);
  assert.doesNotMatch(xml, /CreditNote/, "quedó algo de la nota de crédito");
});

test("los totales van en RequestedMonetaryTotal, que es lo que el esquema exige", () => {
  // La factura y la nota de crédito usan `LegalMonetaryTotal`; la nota de
  // débito, no. Es una de las tres diferencias reales entre los documentos.
  const xml = construirNotaDebitoUBL(DATOS, EMISOR);
  assert.match(xml, /<cac:RequestedMonetaryTotal>/);
  assert.doesNotMatch(xml, /LegalMonetaryTotal/);
});

test("la línea es DebitNoteLine con DebitedQuantity", () => {
  const xml = construirNotaDebitoUBL(DATOS, EMISOR);
  assert.match(xml, /<cac:DebitNoteLine>/);
  assert.match(xml, /<cbc:DebitedQuantity unitCode="NIU">1<\/cbc:DebitedQuantity>/);
  assert.doesNotMatch(xml, /InvoicedQuantity/, "quedó la cantidad de la factura");
});

test("el ResponseCode lleva el código del catálogo 10, no el motivo en texto", () => {
  const xml = construirNotaDebitoUBL(DATOS, EMISOR);
  assert.match(xml, /<cbc:ResponseCode>01<\/cbc:ResponseCode>/);
  assert.match(xml, /<cbc:ReferenceID>F001-123<\/cbc:ReferenceID>/);
  // Y los otros dos códigos que el sistema emite llegan igual.
  for (const codigo of ["02", "03"]) {
    const otro = construirNotaDebitoUBL({ ...DATOS, tipoNota: codigo }, EMISOR);
    assert.match(otro, new RegExp(`<cbc:ResponseCode>${codigo}</cbc:ResponseCode>`));
  }
});

test("la nota de crédito ya no manda InvoicedQuantity dentro de CreditNoteLine", () => {
  // Éste era el defecto: `cbc:InvoicedQuantity` no es hijo válido de
  // `cac:CreditNoteLine` en UBL 2.1, así que el XML no pasaba la validación.
  const xml = construirNotaCreditoUBL({ ...DATOS, tipoDocumento: "NOTA_CREDITO", tipoNota: "01" }, EMISOR);
  assert.match(xml, /<cac:CreditNoteLine>/);
  assert.match(xml, /<cbc:CreditedQuantity unitCode="NIU">1<\/cbc:CreditedQuantity>/);
  assert.doesNotMatch(xml, /InvoicedQuantity/);
  assert.doesNotMatch(xml, /InvoiceLine/);
});

test("la factura sigue usando lo suyo", () => {
  // El parámetro tiene valor por omisión: si se hubiera cambiado el de la
  // factura, esto lo dice.
  const xml = construirFacturaUBL({ ...DATOS, tipoDocumento: "FACTURA" }, EMISOR);
  assert.match(xml, /<cac:InvoiceLine>/);
  assert.match(xml, /<cbc:InvoicedQuantity unitCode="NIU">1<\/cbc:InvoicedQuantity>/);
  assert.doesNotMatch(xml, /CreditedQuantity|DebitedQuantity/);
});

test("nadie vuelve a renombrar la etiqueta con un replace sobre el texto", async () => {
  // Es la forma en que entró el defecto: cambia la etiqueta de afuera y deja
  // la de adentro intacta, sin que nada lo advierta.
  //
  // Sobre el CÓDIGO, no sobre el archivo: la primera versión de esta prueba se
  // puso en rojo con el comentario que explica el defecto, que cita el replace
  // que ya no existe. Es el segundo caso en este repositorio —el otro está en
  // `a-quienes-hay-que-avisar`— de una guarda que se dispara con su propia
  // explicación.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/sunatUbl.ts"), "utf8");
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  assert.doesNotMatch(codigo, /\.replace\(\/InvoiceLine\/g/);
  // Y que la explicación siga estando, que es lo que evita que alguien lo
  // reintroduzca por no saber por qué se quitó.
  assert.match(fuente, /InvoicedQuantity` no es hijo válido/);
});

test("el envío directo ya no rechaza la nota de débito", async () => {
  const fuente = await readFile(resolve(process.cwd(), "src/lib/facturacionElectronica.ts"), "utf8");
  assert.match(fuente, /datos\.tipoDocumento === "NOTA_DEBITO"/);
  assert.match(fuente, /construirNotaDebitoUBL\(datos, emisor\)/);
  assert.doesNotMatch(
    fuente,
    /todavía no arma el UBL de una nota de débito/,
    "sigue el mensaje de que no sabe armarla"
  );
});
