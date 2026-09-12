import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { nombresDeUbigeo, resolverUbigeoEnTransaccion } from "@/lib/ubigeos";

// El catálogo UBIGEO de SUNAT ya existía, pero solo lo usaba GuiaRemision para
// el XML. Cliente y Almacén guardaban departamento/provincia/distrito como
// texto libre y Proveedor no guardaba ubicación en absoluto.

async function conUbigeos<T>(cuerpo: (ids: { lima: string; arequipa: string }) => Promise<T>) {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const [lima, arequipa] = await Promise.all([
    prisma.ubigeo.create({
      data: {
        codigo: `9${sufijo.slice(0, 5)}`,
        departamento: "LIMA",
        provincia: "LIMA",
        distrito: "COMAS",
      },
    }),
    prisma.ubigeo.create({
      data: {
        codigo: `8${sufijo.slice(0, 5)}`,
        departamento: "AREQUIPA",
        provincia: "AREQUIPA",
        distrito: "CAYMA",
      },
    }),
  ]);
  try {
    return await cuerpo({ lima: lima.id, arequipa: arequipa.id });
  } finally {
    await prisma.ubigeo.deleteMany({ where: { id: { in: [lima.id, arequipa.id] } } });
  }
}

test("un ubigeo inexistente no se guarda como id crudo", async () => {
  // El id viaja en un formulario. Si no está en el catálogo se trata como si
  // no se hubiera elegido ninguno: nunca se persiste un valor sin respaldo.
  assert.equal(await resolverUbigeoEnTransaccion(prisma, "no-existe"), null);
  assert.equal(await resolverUbigeoEnTransaccion(prisma, null), null);
  assert.equal(await resolverUbigeoEnTransaccion(prisma, ""), null);
});

test("los nombres de texto se derivan del ubigeo elegido", async () => {
  await conUbigeos(async ({ lima }) => {
    const ubigeo = await resolverUbigeoEnTransaccion(prisma, lima);
    assert.deepEqual(nombresDeUbigeo(ubigeo), {
      departamento: "LIMA",
      provincia: "LIMA",
      distrito: "COMAS",
    });
  });
});

test("sin ubigeo no se borra la dirección que ya estaba escrita", async () => {
  // Lo importante es que devuelva un objeto VACÍO y no tres null: al
  // esparcirlo en un update, las claves ausentes dejan intactas las columnas.
  // Con null borraría la dirección que el usuario escribió a mano antes de que
  // existiera el catálogo.
  assert.deepEqual(nombresDeUbigeo(null), {});
  assert.equal(Object.keys(nombresDeUbigeo(null)).length, 0);
});

test("el ubigeo queda guardado en los tres maestros y no se pierde el texto", async () => {
  await conUbigeos(async ({ lima, arequipa }) => {
    const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const empresaId = `empresa-ubigeo-${sufijo}`;
    await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

    try {
      const cliente = await prisma.cliente.create({
        data: {
          empresaId,
          codigo: `CLI-${sufijo}`,
          razonSocial: "Cliente con ubigeo",
          ubigeoId: lima,
          ...nombresDeUbigeo(await resolverUbigeoEnTransaccion(prisma, lima)),
        },
      });
      assert.equal(cliente.ubigeoId, lima);
      // El texto se mantiene sincronizado: los documentos impresos lo leen.
      assert.equal(cliente.distrito, "COMAS");

      const proveedor = await prisma.proveedor.create({
        data: { empresaId, razonSocial: "Proveedor con ubigeo", ubigeoId: arequipa },
      });
      assert.equal(proveedor.ubigeoId, arequipa);

      const almacen = await prisma.almacen.create({
        data: {
          empresaId,
          codigo: `ALM-${sufijo}`,
          nombre: "Almacén con ubigeo",
          ubigeoId: lima,
          ...nombresDeUbigeo(await resolverUbigeoEnTransaccion(prisma, lima)),
        },
      });
      assert.equal(almacen.ubigeoId, lima);
      assert.equal(almacen.departamento, "LIMA");

      // Una fila puede quedarse sin ubigeo con su texto libre intacto: es el
      // caso de los datos cargados antes del catálogo y de las direcciones
      // que no corresponden a un distrito peruano.
      const extranjero = await prisma.cliente.create({
        data: {
          empresaId,
          codigo: `CLI-EXT-${sufijo}`,
          razonSocial: "Cliente del extranjero",
          pais: "Chile",
          departamento: "Región Metropolitana",
          provincia: "Santiago",
          distrito: "Providencia",
        },
      });
      assert.equal(extranjero.ubigeoId, null);
      assert.equal(extranjero.distrito, "Providencia");
    } finally {
      await prisma.cliente.deleteMany({ where: { empresaId } });
      await prisma.proveedor.deleteMany({ where: { empresaId } });
      await prisma.almacen.deleteMany({ where: { empresaId } });
      await prisma.empresa.deleteMany({ where: { id: empresaId } });
    }
  });
});

// --- Guardias ---------------------------------------------------------------

test("el seed principal carga el catálogo de ubigeos", async () => {
  // Sin catálogo, los tres selectores salen vacíos en una instalación nueva y
  // no hay ningún error que lo delate — el mismo defecto de clase que ya se
  // corrigió con el almacén de tipo PLANTA que el seed no creaba.
  const seed = await readFile(resolve(process.cwd(), "prisma/seed.ts"), "utf8");
  assert.match(seed, /sembrarUbigeos\(/);

  const paquete = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
  assert.ok(paquete.scripts["seed:ubigeos"], "debe existir el script seed:ubigeos");
});

test("los maestros resuelven el ubigeo contra el catálogo antes de guardarlo", async () => {
  // El id llega del navegador: guardarlo sin validar dejaría una FK a un
  // distrito inventado, y ese código termina en el XML que se manda a SUNAT.
  for (const ruta of [
    "src/app/(app)/comercial/clientes/actions.ts",
    "src/app/(app)/catalogo/proveedores/actions.ts",
    "src/app/(app)/configuracion/almacenes/actions.ts",
  ]) {
    const fuente = await readFile(resolve(process.cwd(), ruta), "utf8");
    assert.match(fuente, /resolverUbigeoEnTransaccion\(/, `${ruta} debe validar el ubigeo`);
  }
});
