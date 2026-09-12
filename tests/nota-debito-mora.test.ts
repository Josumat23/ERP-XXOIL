import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { CODIGO_TIPO_NOTA_DEBITO, ETIQUETA_TIPO_NOTA_DEBITO } from "@/lib/catalogosSunat";

// La nota de débito documenta un recargo por mora YA aplicado. El recargo ya
// aumentó el saldo de la factura y ya generó su asiento; emitir el documento no
// vuelve a cargar nada.

test("los códigos del Catálogo 10 son los de SUNAT", () => {
  assert.deepEqual(CODIGO_TIPO_NOTA_DEBITO, {
    INTERES_MORA: "01",
    AUMENTO_VALOR: "02",
    PENALIDAD_OTROS: "03",
  });
  // Cada código tiene su etiqueta: un select sin texto no sirve.
  assert.deepEqual(
    Object.keys(CODIGO_TIPO_NOTA_DEBITO).sort(),
    Object.keys(ETIQUETA_TIPO_NOTA_DEBITO).sort()
  );
});

test("emitir la nota de débito NO vuelve a cargar el recargo", async () => {
  // La razón de ser de todo este ciclo: el recargo ya está cobrado. Si emitir
  // el documento tocara el saldo o posteara un asiento, se cobraría dos veces.
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/facturas/actions.ts"),
    "utf8"
  );
  // Acotado a la acción de mora: desde que existe la emisión manual —que SÍ
  // carga a propósito— un corte abierto hasta el final del archivo abarcaba su
  // código y daba un falso positivo.
  const bloque = acciones.slice(
    acciones.indexOf("export async function emitirNotaDebitoMora"),
    acciones.indexOf("export async function emitirNotaDebitoManual")
  );
  assert.ok(bloque.length > 0, "no se encontró la acción");

  assert.doesNotMatch(bloque, /postearAsiento|postearRecargoMora/, "no debe generar asiento");
  assert.doesNotMatch(bloque, /saldo:\s*\{\s*increment/, "no debe tocar el saldo de la factura");
  assert.doesNotMatch(bloque, /factura\.update/, "no debe modificar la factura");
  // Y sí valida la compañía activa: el id del recargo llega del navegador.
  assert.match(bloque, /factura: \{ empresaId \}/);
});

test("un recargo tiene a lo sumo una nota de débito", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-nd-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    const cliente = await prisma.cliente.create({
      data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: "Cliente moroso" },
    });
    const vendedor = await prisma.vendedor.create({
      data: { empresaId, nombre: "Vendedor", tipo: "SOLO_COMISION", tasaComision: 1 },
    });
    const pedido = await prisma.pedido.create({
      data: {
        empresaId,
        numero: `PED-${sufijo}`,
        clienteId: cliente.id,
        vendedorId: vendedor.id,
        total: 1180,
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const factura = await prisma.factura.create({
      data: {
        empresaId,
        numero: `F001-${sufijo}`,
        pedidoId: pedido.id,
        clienteId: cliente.id,
        vendedorId: vendedor.id,
        fechaEmision: new Date(2026, 0, 1),
        fechaVencimiento: new Date(2026, 1, 1),
        subtotal: 1000,
        igv: 180,
        total: 1180,
        saldo: 1180,
        condicionPago: "DIAS_30",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const recargo = await prisma.recargoMora.create({
      data: {
        facturaId: factura.id,
        diasCalculados: 30,
        tasaAplicada: 2,
        monto: 23.6,
        montoFuncional: 23.6,
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    const nd = await prisma.notaDebito.create({
      data: {
        empresaId,
        numero: "ND-00001",
        facturaId: factura.id,
        recargoMoraId: recargo.id,
        baseImponible: recargo.monto,
        monto: recargo.monto,
        montoFuncional: recargo.montoFuncional,
        motivo: "Intereses por mora",
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    assert.equal(nd.tipoNota, "INTERES_MORA");

    // Un segundo documento para el mismo recargo se rechaza en base.
    await assert.rejects(() =>
      prisma.notaDebito.create({
        data: {
          empresaId,
          numero: "ND-00002",
          facturaId: factura.id,
          recargoMoraId: recargo.id,
          baseImponible: recargo.monto,
          monto: recargo.monto,
          motivo: "Duplicada",
          usuarioId: "u",
          usuarioNombre: "u",
        },
      })
    );

    // El monto de la nota es exactamente el del recargo: no se recalcula ni se
    // le agrega IGV por cuenta propia.
    assert.equal(nd.monto.toNumber(), recargo.monto.toNumber());

    // Y el saldo de la factura quedó como estaba: emitir no cobra.
    const despues = await prisma.factura.findUniqueOrThrow({ where: { id: factura.id } });
    assert.equal(despues.saldo.toNumber(), 1180);
  } finally {
    await prisma.notaDebito.deleteMany({ where: { empresaId } });
    await prisma.recargoMora.deleteMany({ where: { factura: { empresaId } } });
    await prisma.factura.deleteMany({ where: { empresaId } });
    await prisma.pedido.deleteMany({ where: { empresaId } });
    await prisma.vendedor.deleteMany({ where: { empresaId } });
    await prisma.cliente.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("el número de nota de débito es por compañía", async () => {
  // Mismo criterio que el resto de documentos numerados.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model NotaDebito {"),
    esquema.indexOf("}", esquema.indexOf("model NotaDebito {"))
  );
  assert.match(modelo, /@@unique\(\[empresaId, numero\]\)/);

  const correlativos = await readFile(resolve(process.cwd(), "src/lib/correlativos.ts"), "utf8");
  const generador = correlativos.slice(correlativos.indexOf("siguienteNumeroNotaDebito"));
  assert.match(generador, /where: \{ empresaId \}/);
});

test("el envío directo a SUNAT no inventa el UBL de una nota de débito", async () => {
  // Antes, un tipo nuevo caía en la última rama de un ternario encadenado y se
  // habría enviado a SUNAT con la estructura de una GUÍA DE REMISIÓN, sin que
  // nada lo advirtiera. Construir el DebitNote sin poder probarlo contra SUNAT
  // —lo que exige el certificado digital real, pendiente— sería adivinar la
  // estructura de un documento tributario.
  const fuente = await readFile(resolve(process.cwd(), "src/lib/facturacionElectronica.ts"), "utf8");

  assert.doesNotMatch(
    fuente,
    /construirNotaCreditoUBL\(datos, emisor\)\s*:\s*construirGuiaRemisionUBL/,
    "no debe quedar el ternario que hacía caer un tipo nuevo en la guía de remisión"
  );
  assert.match(fuente, /tipoDocumento === "GUIA_REMISION"/);
  assert.match(fuente, /todavía no arma el UBL de una nota de débito/);
});

test("los catálogos de envío cubren la nota de débito", async () => {
  // Un Record<TipoComprobanteElectronico, ...> incompleto no compila, pero el
  // valor importa: 08 en el Catálogo 01 de SUNAT, 4 en la API de Nubefact.
  const soap = await readFile(resolve(process.cwd(), "src/lib/sunatSoap.ts"), "utf8");
  assert.match(soap, /NOTA_DEBITO: "08"/);

  const nubefact = await readFile(
    resolve(process.cwd(), "src/lib/facturacionElectronica.ts"),
    "utf8"
  );
  assert.match(nubefact, /NOTA_DEBITO: 4/);
  assert.match(nubefact, /tipo_de_nota_de_debito/);
});

test("la emisión automática sigue siendo solo la del tipo 01", async () => {
  // El negocio confirmó el 2026-09-13 que también emite por aumento de valor y
  // penalidad, así que el catálogo dejó de estar a medias. Lo que sigue siendo
  // cierto —y es lo que hay que proteger— es que el sistema **calcula** un
  // solo tipo: el de mora. Los otros dos los emite una persona, que aporta el
  // concepto y el importe (véase nota-debito-manual.test.ts).
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/comercial/facturas/actions.ts"),
    "utf8"
  );
  const bloque = acciones.slice(
    acciones.indexOf("export async function emitirNotaDebitoMora"),
    acciones.indexOf("export async function emitirNotaDebitoManual")
  );
  assert.match(bloque, /tipoNota: "INTERES_MORA"/);
  assert.doesNotMatch(bloque, /AUMENTO_VALOR|PENALIDAD_OTROS/);
});
