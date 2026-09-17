import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  MENSAJE_ERROR_EQUIVALENCIA,
  cambioDeCobertura,
  coberturaEspecificaciones,
  validarEquivalencia,
} from "@/lib/equivalencias";

// ---------------------------------------------------------------------------
// «¿Cuál es tu equivalente al Delvac 1340?»
//
// Es la pregunta que más se repite en una venta de lubricantes, y el sistema no
// podía contestarla. La respuesta fácil es una tabla de sinónimos —lo que hacen
// los ERP genéricos con sus cross-references— y esa tabla no dice nada: si
// alguien pregunta por qué son equivalentes, la respuesta es «porque alguien lo
// tecleó».
//
// Acá la equivalencia carga su evidencia: se compara contra las
// especificaciones que las dos fichas declaran. Lo que el sistema NO hace es
// decidir —dos lubricantes se reemplazan por criterio técnico, no por
// aritmética de siglas— pero sí calcula la cobertura y exige que un hueco tenga
// su motivo escrito.
//
// Y hace algo que una tabla de sinónimos no puede: **degradarse sola**. Si una
// homologación nuestra vence, la cobertura de hoy baja sin que nadie toque la
// equivalencia.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const HOY = new Date(2026, 8, 17);
const enDias = (n: number) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);
const cumple = (id: string) => ({ especificacionId: id, tipo: "CUMPLE" as const, vigenteHasta: null });
const homologado = (id: string, vence: Date) => ({
  especificacionId: id,
  tipo: "HOMOLOGADO" as const,
  vigenteHasta: vence,
});

// --- La cobertura se calcula, no se opina ----------------------------------

test("cubrir todo lo que el competidor declara es cobertura total", () => {
  const cobertura = coberturaEspecificaciones(
    [cumple("api-ck4"), cumple("acea-e9"), cumple("sae-15w40")],
    [{ especificacionId: "api-ck4" }, { especificacionId: "acea-e9" }],
    HOY
  );
  assert.equal(cobertura.esTotal, true);
  assert.equal(cobertura.total, 2);
  assert.deepEqual(cobertura.faltantes, []);
  // Declarar de más no resta: cubrir tres cuando piden dos sigue siendo total.
  assert.equal(cobertura.cubiertas.length, 2);
});

test("lo que falta se nombra, no se resume en un número", () => {
  // Quien decide necesita saber QUÉ falta, no cuánto.
  const cobertura = coberturaEspecificaciones(
    [cumple("api-ck4")],
    [{ especificacionId: "api-ck4" }, { especificacionId: "acea-e9" }],
    HOY
  );
  assert.equal(cobertura.esTotal, false);
  assert.deepEqual(cobertura.faltantes, ["acea-e9"]);
});

test("un competidor sin especificaciones no da cobertura total por vacío", () => {
  // Cubrir «todas» de cero sería total por definición, y eso convertiría un
  // maestro a medio cargar en una equivalencia perfecta.
  const cobertura = coberturaEspecificaciones([cumple("api-ck4")], [], HOY);
  assert.equal(cobertura.total, 0);
  assert.equal(cobertura.esTotal, false);
});

test("una homologación nuestra vencida deja de cubrir", () => {
  // LA regla que distingue esto de una tabla de sinónimos. Es la misma que rige
  // el certificado: hoy no se puede afirmar una aprobación que dejó de regir.
  const suyas = [{ especificacionId: "mb-228" }];
  assert.equal(
    coberturaEspecificaciones([homologado("mb-228", enDias(200))], suyas, HOY).esTotal,
    true
  );
  const vencida = coberturaEspecificaciones([homologado("mb-228", enDias(-1))], suyas, HOY);
  assert.equal(vencida.esTotal, false);
  assert.deepEqual(vencida.faltantes, ["mb-228"]);
});

test("un «cumple» no caduca, así que sigue cubriendo", () => {
  const suyas = [{ especificacionId: "api-ck4" }];
  assert.equal(coberturaEspecificaciones([cumple("api-ck4")], suyas, enDias(9999)).esTotal, true);
});

// --- Declarar la equivalencia ----------------------------------------------

test("con cobertura total no hace falta justificar", () => {
  const cobertura = coberturaEspecificaciones([cumple("a")], [{ especificacionId: "a" }], HOY);
  assert.equal(validarEquivalencia(cobertura, null), null);
});

test("con un hueco, el motivo es obligatorio — pero no se prohíbe declararla", () => {
  // Hay razones legítimas: una norma nueva reemplaza a la anterior, o la
  // faltante no aplica al uso. Bloquearlo sería inventar un criterio técnico
  // que no es del sistema; exigir que la razón quede escrita, no.
  const cobertura = coberturaEspecificaciones(
    [cumple("a")],
    [{ especificacionId: "a" }, { especificacionId: "b" }],
    HOY
  );
  assert.equal(validarEquivalencia(cobertura, null), "FALTA_JUSTIFICACION");
  assert.equal(validarEquivalencia(cobertura, "   "), "FALTA_JUSTIFICACION", "espacios no son motivo");
  assert.equal(validarEquivalencia(cobertura, "API CK-4 reemplaza a CJ-4"), null);
});

test("sin especificaciones del competidor no hay contra qué comparar", () => {
  const cobertura = coberturaEspecificaciones([cumple("a")], [], HOY);
  assert.equal(validarEquivalencia(cobertura, "porque sí"), "COMPETIDOR_SIN_ESPECIFICACIONES");
  // Y el mensaje manda a cargar la ficha, no solo niega.
  assert.match(MENSAJE_ERROR_EQUIVALENCIA.COMPETIDOR_SIN_ESPECIFICACIONES, /ficha técnica/);
});

// --- Que la evidencia cambió -----------------------------------------------

test("la cobertura que bajó se dice, no se deja restar al lector", () => {
  const bajo = cambioDeCobertura({ cubiertas: 3, total: 3 }, { cubiertas: 2, total: 3 });
  assert.equal(bajo.sentido, "EMPEORO");
  assert.match(bajo.texto, /bajó desde 3 de 3/);

  const subio = cambioDeCobertura({ cubiertas: 1, total: 3 }, { cubiertas: 3, total: 3 });
  assert.equal(subio.sentido, "MEJORO");
  assert.match(subio.texto, /subió desde 1 de 3/);

  const igual = cambioDeCobertura({ cubiertas: 2, total: 2 }, { cubiertas: 2, total: 2 });
  assert.equal(igual.sentido, "IGUAL");
  assert.equal(igual.texto, "2 de 2");
});

test("agregar una especificación al competidor también cambia la cobertura", () => {
  // No solo vencen homologaciones: si el competidor declara una norma más, lo
  // que era total deja de serlo.
  const cambio = cambioDeCobertura({ cubiertas: 2, total: 2 }, { cubiertas: 2, total: 3 });
  assert.equal(cambio.sentido, "MEJORO", "cubiertas no bajó");
  assert.match(cambio.texto, /2 de 3/);
});

// --- Guardias estructurales -------------------------------------------------

test("la equivalencia la declara una persona y queda con su nombre", async () => {
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model EquivalenciaProducto {"),
    esquema.indexOf("\n}", esquema.indexOf("model EquivalenciaProducto {"))
  );
  assert.ok(modelo.length > 200, "el corte quedó vacío");
  assert.match(modelo, /usuarioId\s+String/);
  assert.match(modelo, /justificacion\s+String\?/);
  // La cobertura al declararla se guarda: sin ella no habría contra qué
  // comparar la de hoy, y el contraste es el punto.
  assert.match(modelo, /cubiertasAlDeclarar\s+Int/);
  assert.match(modelo, /totalAlDeclarar\s+Int/);
});

test("al competidor no se le atribuye una homologación", async () => {
  // No tenemos forma de saber si lo que su ficha dice es un cumplimiento o una
  // aprobación con número, y suponerlo sería atribuirle algo que no dijo.
  const esquema = await readFile(resolve(RAIZ, "prisma/schema.prisma"), "utf8");
  const modelo = esquema.slice(
    esquema.indexOf("model EspecificacionCompetencia {"),
    esquema.indexOf("\n}", esquema.indexOf("model EspecificacionCompetencia {"))
  );
  assert.ok(modelo.length > 150, "el corte quedó vacío");
  assert.doesNotMatch(modelo, /tipo\s+TipoCumplimientoEspecificacion/);
  assert.doesNotMatch(modelo, /numeroAprobacion/);
});

test("la acción calcula la cobertura y no confía en los ids del formulario", async () => {
  const acciones = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/competencia/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /export async function declararEquivalencia/);
  assert.match(acciones, /coberturaEspecificaciones\(/, "no calcula la cobertura en el servidor");
  assert.match(acciones, /validarEquivalencia\(/, "no usa la validación compartida");
  // Los dos productos llegan del navegador: los dos se comprueban.
  assert.match(acciones, /productoCompetencia\.findFirst\(\{[\s\S]{0,120}empresaId/);
  assert.match(acciones, /producto\.findFirst\(\{[\s\S]{0,120}empresaId/);
});

test("la cobertura que se muestra es la de hoy, no la del día que se declaró", async () => {
  // Si la pantalla mostrara el número guardado, una homologación vencida
  // seguiría diciendo «cubre 3 de 3» para siempre — exactamente el problema.
  const pagina = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/competencia/[id]/page.tsx"),
    "utf8"
  );
  assert.match(pagina, /coberturaEspecificaciones\(/, "no recalcula la cobertura");
  assert.match(pagina, /cambioDeCobertura\(/, "no contrasta contra la del día de la declaración");

  const ficha = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/productos/[id]/page.tsx"),
    "utf8"
  );
  assert.match(ficha, /coberturaEspecificaciones\(/, "la vista inversa no recalcula");
  assert.match(ficha, /Reemplaza a/, "el producto no dice a qué reemplaza");
});

test("se puede cargar y declarar desde pantalla", async () => {
  const archivos = await readdir(resolve(RAIZ, "src/app/(app)/catalogo/competencia"));
  assert.ok(archivos.includes("page.tsx"));
  assert.ok(archivos.includes("actions.ts"));

  const alta = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/competencia/CompetenciaFormulario.tsx"),
    "utf8"
  );
  for (const campo of ["marca", "nombre", "fuente"]) {
    assert.match(alta, new RegExp(`name="${campo}"`), `falta el campo ${campo}`);
  }
  const equivalencia = await readFile(
    resolve(RAIZ, "src/app/(app)/catalogo/competencia/[id]/EquivalenciaFormulario.tsx"),
    "utf8"
  );
  assert.match(equivalencia, /name="productoId"/);
  assert.match(equivalencia, /name="justificacion"/);
  // La cobertura se ve ANTES de declarar: quien declara tiene que saber contra
  // qué lo hace.
  assert.match(
    equivalencia,
    /\{c\.cubiertas\} de \{c\.total\}/,
    "la cobertura no se ve antes de declarar"
  );
  // Y también qué falta: un número sin el detalle no deja comparar candidatos.
  assert.match(equivalencia, /c\.faltantes/, "no se ve qué le falta a cada candidato");

  const navegacion = await readFile(resolve(RAIZ, "src/lib/navegacion.ts"), "utf8");
  assert.match(navegacion, /\/catalogo\/competencia/);
});

test("el catálogo de competencia no se siembra", async () => {
  // Qué productos de la competencia sigue XXOIL y qué dicen sus fichas es del
  // negocio. Sembrar marcas reales además les atribuiría afirmaciones.
  for (const archivo of ["prisma/seed.ts", "prisma/seed-demo.ts"]) {
    const texto = await readFile(resolve(RAIZ, archivo), "utf8");
    assert.doesNotMatch(texto, /productoCompetencia\.(create|createMany|upsert)/, archivo);
    assert.doesNotMatch(texto, /equivalenciaProducto\.(create|createMany|upsert)/, archivo);
  }
});

// --- Contra la base ---------------------------------------------------------

test("una equivalencia no se repite y se borra con cualquiera de sus dos puntas", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `EQ-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });
  const espec = await prisma.especificacionTecnica.create({
    data: { empresaId, organismo: "API", codigo: `EQ-${sufijo}` },
  });

  try {
    const competidor = await prisma.productoCompetencia.create({
      data: {
        empresaId,
        marca: `Marca ${sufijo}`,
        nombre: `Producto ${sufijo}`,
        especificaciones: { create: [{ empresaId, especificacionId: espec.id }] },
      },
    });

    await prisma.equivalenciaProducto.create({
      data: {
        empresaId,
        productoId: producto.id,
        productoCompetenciaId: competidor.id,
        cubiertasAlDeclarar: 1,
        totalAlDeclarar: 1,
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });

    // La misma pareja dos veces se rechaza: la segunda contradiría a la primera
    // sin que nada dijera cuál rige.
    await assert.rejects(
      prisma.equivalenciaProducto.create({
        data: {
          empresaId,
          productoId: producto.id,
          productoCompetenciaId: competidor.id,
          cubiertasAlDeclarar: 1,
          totalAlDeclarar: 1,
          usuarioId: "u",
          usuarioNombre: "u",
        },
      })
    );

    // Borrar el competidor se lleva la equivalencia y lo que su ficha declaraba;
    // la especificación del catálogo sobrevive, porque es de la empresa.
    await prisma.productoCompetencia.delete({ where: { id: competidor.id } });
    assert.equal(
      await prisma.equivalenciaProducto.count({ where: { productoId: producto.id } }),
      0
    );
    assert.equal(
      await prisma.especificacionCompetencia.count({ where: { productoCompetenciaId: competidor.id } }),
      0
    );
    assert.equal(await prisma.especificacionTecnica.count({ where: { id: espec.id } }), 1);
  } finally {
    await prisma.equivalenciaProducto.deleteMany({ where: { productoId: producto.id } });
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.especificacionTecnica.delete({ where: { id: espec.id } }).catch(() => {});
  }
});

test("la cobertura contra filas reales reproduce el vencimiento", async () => {
  // La prueba pura usa literales; esta comprueba que lo que sale de la base
  // —con Date de PostgreSQL— se comporta igual.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = "1";
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { empresaId } });
  const producto = await prisma.producto.create({
    data: { empresaId, categoriaId: categoria.id, codigo: `EQV-${sufijo}`, nombre: `Aceite ${sufijo}` },
  });
  const espec = await prisma.especificacionTecnica.create({
    data: { empresaId, organismo: "OEM", codigo: `X-${sufijo}`, emisor: "Fabricante" },
  });

  try {
    await prisma.especificacionProducto.create({
      data: {
        empresaId,
        productoId: producto.id,
        especificacionId: espec.id,
        tipo: "HOMOLOGADO",
        numeroAprobacion: "APR-1",
        // Vencida ayer.
        vigenteHasta: new Date(Date.now() - 24 * 60 * 60 * 1000),
        usuarioId: "u",
        usuarioNombre: "u",
      },
    });
    const declaraciones = await prisma.especificacionProducto.findMany({
      where: { productoId: producto.id },
      select: { especificacionId: true, tipo: true, vigenteHasta: true },
    });
    const cobertura = coberturaEspecificaciones(declaraciones, [{ especificacionId: espec.id }]);
    assert.equal(cobertura.esTotal, false, "una homologación vencida no debería cubrir");
    assert.deepEqual(cobertura.faltantes, [espec.id]);
  } finally {
    await prisma.especificacionProducto.deleteMany({ where: { productoId: producto.id } });
    await prisma.producto.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.especificacionTecnica.delete({ where: { id: espec.id } }).catch(() => {});
  }
});
