import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  diasParaVencer,
  DIAS_AVISO_VENCIMIENTO,
  documentosPorAtender,
  mensajeAvisoDocumento,
  validarDocumento,
  vigenciaDocumento,
} from "@/lib/documentosAdjuntos";

// Un contrato o una licencia vencidos son un riesgo operativo real, y sin
// fecha de vencimiento nadie se entera hasta que alguien los busca — que suele
// ser el día en que hacen falta.

const HOY = new Date(2026, 8, 15);
const enDias = (n: number) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);

test("un documento que vence hoy todavía vale hoy", () => {
  // Se comparan días completos: quien lo renueva hoy no está en falta.
  assert.equal(vigenciaDocumento(enDias(0), HOY), "POR_VENCER");
  assert.equal(vigenciaDocumento(enDias(-1), HOY), "VENCIDO");
});

test("los tres estados se separan por el umbral de aviso", () => {
  assert.equal(vigenciaDocumento(enDias(200), HOY), "VIGENTE");
  assert.equal(vigenciaDocumento(enDias(DIAS_AVISO_VENCIMIENTO), HOY), "POR_VENCER");
  assert.equal(vigenciaDocumento(enDias(DIAS_AVISO_VENCIMIENTO + 1), HOY), "VIGENTE");
  assert.equal(vigenciaDocumento(enDias(-40), HOY), "VENCIDO");
});

test("un documento sin vencimiento no genera ruido", () => {
  assert.equal(vigenciaDocumento(null, HOY), "SIN_VENCIMIENTO");
});

const doc = (id: string, tipo: string | null, venceEl: Date | null) => ({
  id,
  nombreOriginal: `${id}.pdf`,
  tipoDocumento: tipo,
  venceEl,
});

test("solo se avisan los vencidos y los que están por vencer", () => {
  // Listar los vigentes convertiría el aviso en un inventario, y un aviso que
  // siempre tiene contenido deja de mirarse.
  const avisos = documentosPorAtender(
    [
      doc("vigente", "CONTRATO", enDias(200)),
      doc("sin-fecha", "FICHA_RUC", null),
      doc("porvencer", "LICENCIA", enDias(10)),
      doc("vencido", "CERTIFICADO", enDias(-5)),
    ],
    HOY
  );
  assert.deepEqual(
    avisos.map((a) => a.documento.id),
    ["vencido", "porvencer"],
    "el más urgente primero"
  );
});

test("el aviso dice cuántos días, en singular cuando toca", () => {
  const [uno] = documentosPorAtender([doc("c", "CONTRATO", enDias(-1))], HOY);
  assert.match(mensajeAvisoDocumento(uno), /venció hace 1 día\./);

  const [hoy] = documentosPorAtender([doc("c", "LICENCIA", enDias(0))], HOY);
  assert.match(mensajeAvisoDocumento(hoy), /vence hoy/);

  const [varios] = documentosPorAtender([doc("c", "CONTRATO", enDias(12))], HOY);
  assert.match(mensajeAvisoDocumento(varios), /vence en 12 días/);
});

test("el aviso nombra el tipo de documento, no el archivo", () => {
  const [aviso] = documentosPorAtender([doc("x", "CONTRATO", enDias(-3))], HOY);
  assert.match(mensajeAvisoDocumento(aviso), /Contrato comercial/);
  // Y si no está clasificado, cae en el nombre del archivo.
  const [sinTipo] = documentosPorAtender([doc("papel", null, enDias(-3))], HOY);
  assert.match(mensajeAvisoDocumento(sinTipo), /papel\.pdf/);
});

test("los días para vencer no se redondean hacia arriba", () => {
  assert.equal(diasParaVencer(enDias(5), HOY), 5);
  assert.equal(diasParaVencer(enDias(-5), HOY), -5);
});

test("un vencimiento sin decir qué documento es no se acepta", () => {
  // Produciría un aviso que dice «archivo.pdf venció», que no le sirve a nadie.
  assert.equal(
    validarDocumento({ tipoDocumento: null, venceEl: HOY }),
    "VENCIMIENTO_SIN_TIPO"
  );
  assert.equal(validarDocumento({ tipoDocumento: "CONTRATO", venceEl: HOY }), null);
  // Un archivo suelto, sin tipo ni vencimiento, sigue siendo válido: el DMS
  // sirve a siete pantallas y la mayoría de los adjuntos son solo archivos.
  assert.equal(validarDocumento({ tipoDocumento: null, venceEl: null }), null);
});

test("un tipo inventado se rechaza", () => {
  assert.equal(
    validarDocumento({ tipoDocumento: "ESCRITURA_PUBLICA", venceEl: null }),
    "TIPO_INVALIDO"
  );
});

// --- Guardias estructurales -------------------------------------------------

test("los dos campos son opcionales: el DMS sirve a siete pantallas", async () => {
  // Hacerlos obligatorios rompería la subida de adjuntos en insumos, equipos,
  // órdenes de compra y las demás, que no tienen nada que vencer.
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model Adjunto {"),
    esquema.indexOf("model ", esquema.indexOf("model Adjunto {") + 10)
  );
  assert.ok(modelo.length > 300, "el corte quedó vacío");
  assert.match(modelo, /tipoDocumento TipoDocumentoAdjunto\?/);
  assert.match(modelo, /venceEl\s+DateTime\?/);
});

test("el vencimiento no bloquea nada", async () => {
  // Impedir vender porque alguien no actualizó un PDF sería inventar una regla
  // de negocio que nadie pidió. Si algún día se conecta, que sea explícito.
  for (const ruta of [
    "src/app/(app)/comercial/pedidos/actions.ts",
    "src/app/(app)/comercial/facturas/actions.ts",
  ]) {
    const texto = await readFile(resolve(process.cwd(), ruta), "utf8");
    assert.ok(
      !texto.includes("venceEl") && !texto.includes("documentosPorAtender"),
      `${ruta} no debe condicionar una venta al vencimiento de un documento`
    );
  }
});
