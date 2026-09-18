import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  ENTIDADES_DE_LA_EMPRESA,
  entidadEsDeLaEmpresa,
  esEntidadDeLaEmpresa,
} from "@/lib/entidadesDeLaEmpresa";
import { existeEntidadAdjunto } from "@/lib/adjuntos";

// ---------------------------------------------------------------------------
// Los paneles genéricos no comprobaban la compañía.
//
// Adjuntos, contactos y direcciones se montan sobre CUALQUIER ficha con un par
// `entidadTipo` + `entidadId` que llega del navegador. Cada uno se preguntaba
// por su cuenta si esa entidad existe, y las tres respuestas se habían
// separado: comprobaban la compañía para Cliente y Proveedor, y para el resto
// —Empleado, Insumo, OrdenCompra, Equipo, ActivoFijo— solo que el id existiera.
//
// Los cinco modelos TIENEN `empresaId`. O sea que, sabiendo un id, un usuario
// de una compañía podía colgarle un adjunto al empleado de otra, borrarle una
// dirección, o —por la ruta de descarga, que usa la misma comprobación—
// bajarse el archivo adjunto de su activo fijo. El rol se comprueba por TIPO
// de entidad, no por compañía, así que no hacía falta ningún permiso extra.
//
// Es la clase de defecto que las instrucciones del proyecto nombran con todas
// las letras: una Server Action es un POST que no se controla, y el id que
// manda el navegador no se cree hasta comprobarlo contra la compañía activa.
// ---------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFile(resolve(RAIZ, ruta), "utf8");

const dia = 24 * 60 * 60 * 1000;

/** Una compañía con un registro de cada tipo que los paneles aceptan. */
async function montarCompania(sufijo: string) {
  const empresaId = `empresa-pg-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  const almacen = await prisma.almacen.create({
    data: { empresaId, codigo: `ALM-${sufijo}`, nombre: "Principal" },
  });
  const proveedor = await prisma.proveedor.create({
    data: { empresaId, razonSocial: `Proveedor ${sufijo}` },
  });
  const cliente = await prisma.cliente.create({
    data: { empresaId, codigo: `CLI-${sufijo}`, razonSocial: `Cliente ${sufijo}` },
  });
  const insumo = await prisma.insumo.create({
    data: {
      empresaId,
      codigo: `INS-${sufijo}`,
      nombre: "Aceite base",
      tipo: "MATERIA_PRIMA",
      unidadMedida: "kg",
    },
  });
  const ordenCompra = await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero: `OC-PG-${sufijo}`,
      proveedorId: proveedor.id,
      total: 10,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });
  const empleado = await prisma.empleado.create({
    data: {
      empresaId,
      codigo: `EMP-${sufijo}`,
      nombres: "Ana",
      apellidos: "Pérez",
      fechaIngreso: new Date(Date.now() - 365 * dia),
      cargo: "Operaria",
      area: "Planta",
      tipoContrato: "PLAZO_INDETERMINADO",
    },
  });
  const equipo = await prisma.equipo.create({
    data: { empresaId, codigo: `EQ-${sufijo}`, nombre: "Mezcladora", almacenId: almacen.id },
  });
  const activoFijo = await prisma.activoFijo.create({
    data: {
      empresaId,
      codigo: `AF-${sufijo}`,
      nombre: "Camioneta",
      categoria: "VEHICULO",
      fechaAdquisicion: new Date(Date.now() - 400 * dia),
      costoAdquisicion: 50000,
      vidaUtilAnios: 5,
      usuarioId: "u",
      usuarioNombre: "u",
    },
  });

  /** El id de cada tipo, con los mismos nombres que usan los paneles. */
  const porTipo: Record<string, string> = {
    Insumo: insumo.id,
    Cliente: cliente.id,
    Proveedor: proveedor.id,
    OrdenCompra: ordenCompra.id,
    Empleado: empleado.id,
    Equipo: equipo.id,
    ActivoFijo: activoFijo.id,
  };

  const limpiar = async () => {
    await prisma.activoFijo.delete({ where: { id: activoFijo.id } }).catch(() => {});
    await prisma.equipo.delete({ where: { id: equipo.id } }).catch(() => {});
    await prisma.empleado.delete({ where: { id: empleado.id } }).catch(() => {});
    await prisma.ordenCompra.delete({ where: { id: ordenCompra.id } }).catch(() => {});
    await prisma.insumo.delete({ where: { id: insumo.id } }).catch(() => {});
    await prisma.cliente.delete({ where: { id: cliente.id } }).catch(() => {});
    await prisma.proveedor.delete({ where: { id: proveedor.id } }).catch(() => {});
    await prisma.almacen.delete({ where: { id: almacen.id } }).catch(() => {});
    await prisma.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  };

  return { empresaId, porTipo, limpiar };
}

// --- La comprobación, tipo por tipo -----------------------------------------

test("ningún tipo de entidad cruza de una compañía a otra", async () => {
  // Exhaustivo sobre la lista, no sobre una muestra: si mañana alguien agrega
  // un tipo, esta prueba lo recorre sin que nadie se acuerde de sumarlo.
  const a = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const b = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "z";
  const una = await montarCompania(a);
  const otra = await montarCompania(b);

  try {
    for (const tipo of ENTIDADES_DE_LA_EMPRESA) {
      assert.equal(
        await entidadEsDeLaEmpresa(tipo, una.porTipo[tipo], una.empresaId),
        true,
        `${tipo}: no reconoció su propio registro`
      );
      assert.equal(
        await entidadEsDeLaEmpresa(tipo, otra.porTipo[tipo], una.empresaId),
        false,
        `${tipo}: aceptó el registro de otra compañía`
      );
    }
  } finally {
    await una.limpiar();
    await otra.limpiar();
  }
});

test("el agujero era real: el registro ajeno existe y la comprobación vieja lo daba por bueno", async () => {
  // La forma anterior era `findUnique({ where: { id } })` sin `empresaId`. Se
  // reproduce acá para que conste que esto no es una guarda decorativa: el
  // empleado de la otra compañía EXISTE, así que la comprobación vieja
  // contestaba «sí» y el panel escribía.
  const a = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const b = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "z";
  const una = await montarCompania(a);
  const otra = await montarCompania(b);

  try {
    const comoAntes = await prisma.empleado.findUnique({
      where: { id: otra.porTipo.Empleado },
      select: { id: true },
    });
    assert.ok(comoAntes, "la reproducción del defecto falló: el empleado ajeno no existe");

    assert.equal(
      await entidadEsDeLaEmpresa("Empleado", otra.porTipo.Empleado, una.empresaId),
      false,
      "la comprobación nueva sigue dejando pasar al empleado de otra compañía"
    );
  } finally {
    await una.limpiar();
    await otra.limpiar();
  }
});

test("los adjuntos usan la misma comprobación, no una propia", async () => {
  // La ruta de descarga de archivos pasa por acá: sin el filtro, bajarse el
  // adjunto de otra compañía era cuestión de saber el id.
  const a = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const b = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "z";
  const una = await montarCompania(a);
  const otra = await montarCompania(b);

  try {
    for (const tipo of ENTIDADES_DE_LA_EMPRESA) {
      assert.equal(
        await existeEntidadAdjunto(tipo, una.porTipo[tipo], una.empresaId),
        true,
        `${tipo}: el adjunto propio dejó de verse`
      );
      assert.equal(
        await existeEntidadAdjunto(tipo, otra.porTipo[tipo], una.empresaId),
        false,
        `${tipo}: se alcanzó el adjunto de otra compañía`
      );
    }
  } finally {
    await una.limpiar();
    await otra.limpiar();
  }
});

// --- Los bordes -------------------------------------------------------------

test("sin compañía activa no se autoriza nada", async () => {
  // Guarda que ya existía para Cliente y que ahora rige para todos: dejar
  // pasar cuando falta el dato convertiría un olvido en un agujero silencioso.
  for (const tipo of ENTIDADES_DE_LA_EMPRESA) {
    assert.equal(await entidadEsDeLaEmpresa(tipo, "cualquiera", undefined), false, tipo);
    assert.equal(await entidadEsDeLaEmpresa(tipo, "cualquiera", ""), false, tipo);
  }
});

test("un tipo desconocido no se autoriza", async () => {
  assert.equal(esEntidadDeLaEmpresa("Empresa"), false);
  assert.equal(await entidadEsDeLaEmpresa("Empresa", "x", "1"), false);
  assert.equal(await entidadEsDeLaEmpresa("", "x", "1"), false);
});

test("un id absurdo se descarta sin consultar", async () => {
  assert.equal(await entidadEsDeLaEmpresa("Cliente", "", "1"), false);
  assert.equal(await entidadEsDeLaEmpresa("Cliente", "x".repeat(65), "1"), false);
});

// --- Que no se vuelva a separar ---------------------------------------------

test("los tres paneles preguntan en el mismo lugar", async () => {
  // Tres copias de la misma pregunta fue lo que permitió que se separaran.
  for (const archivo of [
    "src/lib/adjuntos.ts",
    "src/app/(app)/direcciones/actions.ts",
    "src/app/(app)/contactos/actions.ts",
  ]) {
    const contenido = await leer(archivo);
    assert.match(
      contenido,
      /entidadEsDeLaEmpresa/,
      `${archivo} volvió a comprobar la entidad por su cuenta`
    );
    assert.doesNotMatch(
      contenido,
      /findUnique\(\{ where: \{ id: entidadId \} ?, ?select/,
      `${archivo} consulta la entidad por id sin la compañía`
    );
  }
});

test("agregar un tipo obliga a decir cómo se acota", async () => {
  // La tabla de comprobaciones es un `Record` exhaustivo: un `switch` con
  // `default` deja que el próximo tipo entre sin acotar, que es lo que pasó.
  const libreria = await leer("src/lib/entidadesDeLaEmpresa.ts");
  assert.match(libreria, /Record<\s*EntidadDeLaEmpresa,/);
  for (const tipo of ENTIDADES_DE_LA_EMPRESA) {
    assert.match(libreria, new RegExp(`\\n  ${tipo}: async \\(id, empresaId\\) =>`), tipo);
  }
  // Y todas consultan con `empresaId`, sin excepción.
  const comprobaciones = libreria.match(/where: \{ id, empresaId \}/g) ?? [];
  assert.equal(
    comprobaciones.length,
    ENTIDADES_DE_LA_EMPRESA.length,
    `${comprobaciones.length} de ${ENTIDADES_DE_LA_EMPRESA.length} tipos se acotan por compañía`
  );
});

// --- Las filas mismas, no solo la entidad de la que cuelgan -----------------

test("direcciones y contactos genéricos llevan su compañía", async () => {
  // Eran los DOS ÚNICOS modelos polimórficos sin `empresaId` —`Adjunto` ya la
  // tenía—. En la práctica se acotaban por la entidad padre, que sí la lleva,
  // pero la fila en sí no se podía filtrar ni contar por compañía: cualquier
  // consulta nueva nacía sin red.
  const esquema = await leer("prisma/schema.prisma");
  for (const modelo of ["Direccion", "Contacto"]) {
    const bloque = esquema.slice(
      esquema.indexOf(`model ${modelo} {`),
      esquema.indexOf("}", esquema.indexOf(`model ${modelo} {`))
    );
    assert.match(bloque, /empresaId\s+String/, `${modelo} sigue sin compañía`);
    assert.match(bloque, /empresa\s+Empresa\s+@relation/, `${modelo} no la relaciona`);
  }
});

test("la migración rellena antes de exigir la columna", async () => {
  // Agregarla NOT NULL de una haría fallar la migración en cualquier base con
  // filas. Acá están vacías, pero una migración tiene que ser correcta en
  // cualquier base, no solo en la que se probó.
  const sql = await leer(
    "prisma/migrations/20260918190000_aislamiento_direcciones_contactos/migration.sql"
  );
  const agrega = sql.indexOf('ADD COLUMN "empresaId" TEXT');
  const rellena = sql.indexOf("UPDATE \"direcciones\"");
  const exige = sql.indexOf('ALTER COLUMN "empresaId" SET NOT NULL');
  assert.ok(agrega >= 0 && rellena > agrega && exige > rellena, "el orden de la migración no es agregar → rellenar → exigir");
  // Y las tres clases polimórficas se rellenan, no solo una.
  for (const tabla of ["clientes", "proveedores", "empleados"]) {
    assert.ok(sql.includes(tabla), `la migración no rellena desde ${tabla}`);
  }
});

test("una fila huérfana se borra en vez de inventarle dueño", async () => {
  // Sin entidad padre no hay compañía que asignarle. Dejarla obligaría a
  // elegirle una, y una dirección que no cuelga de nadie no la puede ver ni
  // corregir nadie.
  const sql = await leer(
    "prisma/migrations/20260918190000_aislamiento_direcciones_contactos/migration.sql"
  );
  assert.match(sql, /DELETE FROM "direcciones" WHERE "empresaId" IS NULL/);
  assert.match(sql, /DELETE FROM "contactos" WHERE "empresaId" IS NULL/);
});

test("los paneles leen acotados por compañía", async () => {
  for (const panel of ["src/components/PanelDirecciones.tsx", "src/components/PanelContactos.tsx"]) {
    const contenido = await leer(panel);
    assert.match(
      contenido,
      /where: \{ empresaId: await obtenerEmpresaActivaId\(\), entidadTipo, entidadId \}/,
      `${panel} lee sin acotar por compañía`
    );
  }
});

test("el alta escribe la compañía y el borrado la exige", async () => {
  for (const [acciones, modelo] of [
    ["src/app/(app)/direcciones/actions.ts", "direccion"],
    ["src/app/(app)/contactos/actions.ts", "contacto"],
  ] as const) {
    const contenido = await leer(acciones);
    // Comparación literal y no expresión regular: armarla con el nombre del
    // modelo interpolado se prestó a un escape mal puesto, y la guarda dio en
    // rojo sobre código correcto. Una guarda que falla por su propia sintaxis
    // no dice nada sobre lo que vigila.
    assert.ok(
      contenido.includes(`prisma.${modelo}.findFirst({ where: { id, empresaId } })`),
      `${acciones} busca por id sin la compañía`
    );
    assert.ok(
      !contenido.includes(`prisma.${modelo}.findUnique`),
      `${acciones} volvió a leer por id a secas`
    );
    assert.match(contenido, /where: \{ empresaId, entidadTipo, entidadId \}/);
  }
});

test("la fila de una compañía no se ve desde otra", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const una = await montarCompania(sufijo);
  const otra = await montarCompania(sufijo + "z");

  try {
    const direccion = await prisma.direccion.create({
      data: {
        empresaId: otra.empresaId,
        entidadTipo: "Cliente",
        entidadId: otra.porTipo.Cliente,
        tipo: "ENVIO",
        pais: "Perú",
        direccion: "Av. Ajena 123",
      },
    });
    const contacto = await prisma.contacto.create({
      data: {
        empresaId: otra.empresaId,
        entidadTipo: "Cliente",
        entidadId: otra.porTipo.Cliente,
        nombre: "Contacto ajeno",
      },
    });

    // Lo que hace el panel: acotar por compañía activa.
    const desdeLaUna = await prisma.direccion.findMany({
      where: { empresaId: una.empresaId, entidadTipo: "Cliente", entidadId: otra.porTipo.Cliente },
      select: { id: true },
    });
    assert.equal(desdeLaUna.length, 0, "se vio la dirección de otra compañía");

    // Y lo que hace el borrado: buscar por id YA acotado.
    const porId = await prisma.direccion.findFirst({
      where: { id: direccion.id, empresaId: una.empresaId },
      select: { id: true },
    });
    assert.equal(porId, null, "se pudo alcanzar por id la dirección de otra compañía");

    const contactoAjeno = await prisma.contacto.findFirst({
      where: { id: contacto.id, empresaId: una.empresaId },
      select: { id: true },
    });
    assert.equal(contactoAjeno, null, "se pudo alcanzar por id el contacto de otra compañía");

    // Y la dueña sí los ve.
    const suyas = await prisma.direccion.count({ where: { empresaId: otra.empresaId } });
    assert.equal(suyas, 1);
  } finally {
    await prisma.direccion.deleteMany({
      where: { empresaId: { in: [una.empresaId, otra.empresaId] } },
    });
    await prisma.contacto.deleteMany({
      where: { empresaId: { in: [una.empresaId, otra.empresaId] } },
    });
    await una.limpiar();
    await otra.limpiar();
  }
});
