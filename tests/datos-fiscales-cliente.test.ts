import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  avisosFiscales,
  diasDesdeConsulta,
  DIAS_VIGENCIA_CONSULTA,
  mensajeAvisoFiscal,
  validarDatosFiscales,
} from "@/lib/datosFiscalesCliente";

// Nada de esto se valida contra SUNAT: no hay servicio conectado. Todo se carga
// a mano desde la ficha RUC, así que lo que importa no es el dato sino cuán
// viejo es — un estado cacheado y nunca refrescado deja de ser un dato y pasa a
// ser una afirmación falsa.

const HOY = new Date(2026, 8, 15);
const haceDias = (n: number) => new Date(HOY.getTime() - n * 24 * 60 * 60 * 1000);

const conRuc = {
  tipoDocumentoFiscal: "RUC",
  estadoRuc: "ACTIVO" as string | null,
  condicionRuc: "HABIDO" as string | null,
  rucConsultadoEn: haceDias(10) as Date | null,
};

test("un cliente con la consulta fresca y todo en orden no genera avisos", () => {
  assert.deepEqual(avisosFiscales(conRuc, HOY), []);
});

test("a quien no tiene RUC no se le consulta estado de contribuyente", () => {
  // A una persona con DNI no le corresponde ninguno de estos avisos.
  assert.deepEqual(
    avisosFiscales(
      { ...conRuc, tipoDocumentoFiscal: "DNI", estadoRuc: null, condicionRuc: null, rucConsultadoEn: null },
      HOY
    ),
    []
  );
});

test("una consulta que envejeció se avisa con su antigüedad", () => {
  const avisos = avisosFiscales({ ...conRuc, rucConsultadoEn: haceDias(200) }, HOY);
  assert.equal(avisos.length, 1);
  assert.deepEqual(avisos[0], { tipo: "CONSULTA_VIEJA", dias: 200 });
  // Justo en el umbral todavía sirve.
  assert.deepEqual(
    avisosFiscales({ ...conRuc, rucConsultadoEn: haceDias(DIAS_VIGENCIA_CONSULTA) }, HOY),
    []
  );
});

test("un RUC con RUC pero sin consultar se avisa", () => {
  const avisos = avisosFiscales(
    { ...conRuc, estadoRuc: null, condicionRuc: null, rucConsultadoEn: null },
    HOY
  );
  assert.deepEqual(avisos, [{ tipo: "SIN_CONSULTA" }]);
});

test("los avisos se acumulan: una consulta vieja no tapa un estado malo", () => {
  // Que el dato esté viejo no quita que lo que registra ya sea malo.
  const avisos = avisosFiscales(
    {
      ...conRuc,
      estadoRuc: "BAJA_DEFINITIVA",
      condicionRuc: "NO_HABIDO",
      rucConsultadoEn: haceDias(400),
    },
    HOY
  );
  assert.deepEqual(
    avisos.map((a) => a.tipo),
    ["ESTADO_NO_ACTIVO", "NO_UBICABLE", "CONSULTA_VIEJA"]
  );
});

test("«no hallado» también avisa; «pendiente» no", () => {
  assert.equal(
    avisosFiscales({ ...conRuc, condicionRuc: "NO_HALLADO" }, HOY)[0]?.tipo,
    "NO_UBICABLE"
  );
  assert.deepEqual(avisosFiscales({ ...conRuc, condicionRuc: "PENDIENTE" }, HOY), []);
});

test("los mensajes dicen qué está en juego, no solo el estado", () => {
  assert.match(
    mensajeAvisoFiscal({ tipo: "ESTADO_NO_ACTIVO", estado: "BAJA_DEFINITIVA" }),
    /puede ser observado/
  );
  assert.match(mensajeAvisoFiscal({ tipo: "CONSULTA_VIEJA", dias: 200 }), /200 días/);
  assert.match(mensajeAvisoFiscal({ tipo: "SIN_CONSULTA" }), /Nadie consultó/);
});

test("los días se cuentan desde la consulta, sin negativos", () => {
  assert.equal(diasDesdeConsulta(haceDias(5), HOY), 5);
  assert.equal(diasDesdeConsulta(null, HOY), null);
  // Una fecha futura no produce días negativos.
  assert.equal(diasDesdeConsulta(new Date(HOY.getTime() + 86400000), HOY), 0);
});

// --- Validación al cargar ---------------------------------------------------

const cargaValida = {
  estadoRuc: "ACTIVO" as string | null,
  condicionRuc: "HABIDO" as string | null,
  rucConsultadoEn: haceDias(1) as Date | null,
  rucFuenteConsulta: "Consulta RUC en línea" as string | null,
  tipoContribuyente: "SOCIEDAD ANONIMA CERRADA" as string | null,
  afectacionTributaria: null as string | null,
};

test("declarar un estado sin decir cuándo se consultó no se acepta", () => {
  // Es justamente el dato que después nadie sabe si vale.
  assert.equal(
    validarDatosFiscales({ ...cargaValida, rucConsultadoEn: null }, HOY),
    "ESTADO_SIN_CONSULTA"
  );
  // Sin declarar nada, no hace falta fecha.
  assert.equal(
    validarDatosFiscales(
      { ...cargaValida, estadoRuc: null, condicionRuc: null, rucConsultadoEn: null, rucFuenteConsulta: null },
      HOY
    ),
    null
  );
});

test("declarar un estado sin decir de dónde salió tampoco", () => {
  assert.equal(
    validarDatosFiscales({ ...cargaValida, rucFuenteConsulta: "  " }, HOY),
    "SIN_FUENTE"
  );
});

test("la consulta no puede ser del futuro", () => {
  assert.equal(
    validarDatosFiscales(
      { ...cargaValida, rucConsultadoEn: new Date(HOY.getTime() + 86400000) },
      HOY
    ),
    "CONSULTA_FUTURA"
  );
});

test("los textos transcritos están acotados", () => {
  assert.equal(
    validarDatosFiscales({ ...cargaValida, tipoContribuyente: "x".repeat(201) }, HOY),
    "TEXTO_LARGO"
  );
  assert.equal(validarDatosFiscales({ ...cargaValida, afectacionTributaria: "x".repeat(200) }, HOY), null);
});

// --- Guardias estructurales -------------------------------------------------

test("las marcas tributarias no alteran ningún cálculo", async () => {
  // Las tasas y los supuestos son normativos y el negocio no confirmó su
  // régimen: hacer que cambien un comprobante sería inventar una regla
  // tributaria. Si algún día se conectan, este guardia lo hará notar.
  const fuentes = [
    "src/app/(app)/comercial/pedidos/actions.ts",
    "src/app/(app)/comercial/facturas/actions.ts",
    "src/lib/multimoneda.ts",
  ];
  for (const ruta of fuentes) {
    const texto = await readFile(resolve(process.cwd(), ruta), "utf8");
    for (const campo of ["agenteRetencion", "agentePercepcion", "afectacionTributaria"]) {
      assert.ok(
        !texto.includes(campo),
        `${ruta} no debe usar ${campo}: cambiaría un comprobante con una regla que nadie confirmó`
      );
    }
  }
});

test("el estado del RUC se guarda junto con cuándo se consultó", async () => {
  // Sin la fecha, el estado no se puede juzgar: no es lo mismo «activo, visto
  // ayer» que «activo, visto en 2019».
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const cliente = esquema.slice(
    esquema.indexOf("model Cliente {"),
    esquema.indexOf("model Cotizacion {")
  );
  assert.ok(cliente.length > 500, "el corte quedó vacío");
  for (const campo of ["estadoRuc", "condicionRuc", "rucConsultadoEn", "rucFuenteConsulta"]) {
    assert.ok(cliente.includes(campo), `falta ${campo}`);
  }
});
