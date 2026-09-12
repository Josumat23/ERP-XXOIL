import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  codigoDocumentoIdentidad,
  esDniPeruano,
  esRucPeruano,
  prefijoSerieEsperado,
  serieCoincideConTipo,
  tipoComprobantePara,
} from "@/lib/tipoComprobanteVenta";

// El comprobante lo decide el DOCUMENTO del comprador, no el canal comercial.

test("con RUC peruano corresponde factura", () => {
  assert.equal(
    tipoComprobantePara({ tipoDocumentoFiscal: "RUC", documento: "20123456789" }),
    "FACTURA"
  );
  assert.equal(esRucPeruano("20123456789"), true);
  // Con espacios alrededor sigue siendo un RUC: el dato viene de un formulario.
  assert.equal(esRucPeruano("  20123456789  "), true);
});

test("con DNI o sin documento corresponde boleta", () => {
  assert.equal(tipoComprobantePara({ tipoDocumentoFiscal: "RUC", documento: "09876543" }), "BOLETA");
  assert.equal(tipoComprobantePara({ tipoDocumentoFiscal: "RUC", documento: null }), "BOLETA");
  assert.equal(tipoComprobantePara({ tipoDocumentoFiscal: "RUC", documento: "" }), "BOLETA");
  assert.equal(esDniPeruano("09876543"), true);
  assert.equal(esDniPeruano("20123456789"), false);
});

test("el canal comercial NO decide el comprobante", () => {
  // Un cliente del canal minorista que es empresa con RUC recibe factura, y
  // uno del canal mayorista que compra con DNI recibe boleta. Confundir canal
  // con documento emitiría el comprobante equivocado a media cartera.
  //
  // La función ni siquiera recibe el canal: es la forma más segura de que no
  // pueda influir.
  const conRuc = { tipoDocumentoFiscal: "RUC", documento: "20999888777" };
  const conDni = { tipoDocumentoFiscal: "RUC", documento: "12345678" };
  assert.equal(tipoComprobantePara(conRuc), "FACTURA");
  assert.equal(tipoComprobantePara(conDni), "BOLETA");
});

test("un cliente extranjero conserva la factura", () => {
  // Una boleta es un comprobante para consumidor final peruano. Dársela a un
  // cliente del exterior sería peor que dejar la factura como estaba.
  for (const tipo of ["RUT", "NIT", "RFC", "EIN", "VAT", "CI", "OTRO"]) {
    assert.equal(
      tipoComprobantePara({ tipoDocumentoFiscal: tipo, documento: "76.543.210-K" }),
      "FACTURA",
      `${tipo} debe seguir recibiendo factura`
    );
  }
});

test("el documento del adquirente deja de declararse siempre como RUC", () => {
  // Catálogo 06 de SUNAT. Antes iba fijo en 6, así que el DNI de un cliente se
  // declaraba a SUNAT como si fuera un RUC.
  assert.equal(codigoDocumentoIdentidad({ tipoDocumentoFiscal: "RUC", documento: "20123456789" }), 6);
  assert.equal(codigoDocumentoIdentidad({ tipoDocumentoFiscal: "RUC", documento: "09876543" }), 1);
  assert.equal(codigoDocumentoIdentidad({ tipoDocumentoFiscal: "RUC", documento: null }), 0);
  assert.equal(codigoDocumentoIdentidad({ tipoDocumentoFiscal: "RUT", documento: "76543210" }), 0);
});

test("las series de boleta empiezan con B y las de factura con F", () => {
  assert.equal(prefijoSerieEsperado("BOLETA"), "B");
  assert.equal(prefijoSerieEsperado("FACTURA"), "F");
  assert.equal(serieCoincideConTipo("B001", "BOLETA"), true);
  assert.equal(serieCoincideConTipo("F001", "BOLETA"), false);
  assert.equal(serieCoincideConTipo("f001", "FACTURA"), true); // tolera minúscula
  assert.equal(serieCoincideConTipo("B001", "FACTURA"), false);
});

// --- Guardias ---------------------------------------------------------------

test("el tipo se deriva al emitir, no lo elige el usuario", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /tipoComprobantePara\(\{/);
  // No sale de un formulario: nadie puede pedir una boleta para un RUC.
  assert.doesNotMatch(acciones, /formData\.get\("tipoComprobante"\)/);
});

test("una serie que contradice el documento se rechaza, no se corrige sola", async () => {
  // Emitir una boleta numerada "F001-…" produciría un comprobante que miente
  // sobre lo que es. Elegir la serie es del usuario: se avisa, no se corrige
  // en silencio.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/pedidos/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /serieCoincideConTipo\(numero, tipoComprobante\)/);
  assert.match(acciones, /corresponde una boleta/);
  assert.match(acciones, /corresponde una factura/);
});

test("el envío usa el tipo guardado en la factura, no una constante", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/facturas/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function enviarComprobanteFactura"),
    acciones.indexOf("export async function enviarComprobanteNotaCredito")
  );
  assert.ok(bloque.length > 0);
  assert.match(bloque, /tipoDocumento: factura\.tipoComprobante/);
  assert.match(bloque, /clienteTipoDocumento: codigoDocumentoIdentidad/);
});

test("los catálogos de envío cubren la boleta", async () => {
  const soap = await readFile(resolve(process.cwd(), "src/lib/sunatSoap.ts"), "utf8");
  assert.match(soap, /BOLETA: "03"/); // Catálogo 01 de SUNAT

  const nubefact = await readFile(
    resolve(process.cwd(), "src/lib/facturacionElectronica.ts"),
    "utf8"
  );
  assert.match(nubefact, /BOLETA: 2/);
  // Y el documento del adquirente dejó de estar fijo.
  assert.doesNotMatch(nubefact, /cliente_tipo_de_documento: 6, \/\/ RUC/);
  assert.match(nubefact, /cliente_tipo_de_documento: datos\.clienteTipoDocumento/);
});

test("la boleta comparte el UBL Invoice con la factura, y no cae en otra rama", async () => {
  const fuente = await readFile(resolve(process.cwd(), "src/lib/facturacionElectronica.ts"), "utf8");
  assert.match(
    fuente,
    /tipoDocumento === "FACTURA" \|\| datos\.tipoDocumento === "BOLETA"/,
    "la boleta debe construir el mismo documento UBL Invoice que la factura"
  );
});

test("las facturas anteriores al cambio siguen siendo facturas", async () => {
  // El campo nace en FACTURA, y eso es correcto: hasta ahora el sistema solo
  // emitía factura, así que el valor histórico no es una suposición.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.match(esquema, /tipoComprobante\s+TipoComprobanteVenta\s+@default\(FACTURA\)/);
});
