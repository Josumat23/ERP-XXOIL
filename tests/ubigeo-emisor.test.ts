import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";

// La dirección fiscal del emisor es la que va impresa en los documentos y la
// que viaja en el XML de facturación electrónica, donde SUNAT espera el código
// de ubigeo de 6 dígitos y no el nombre del distrito.

test("la configuración trae siempre el ubigeo del emisor", async () => {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const empresaId = `empresa-emisor-${sufijo}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });
  const ubigeo = await prisma.ubigeo.create({
    data: {
      codigo: `7${sufijo.slice(0, 5)}`,
      departamento: "LIMA",
      provincia: "LIMA",
      distrito: "SAN ISIDRO",
    },
  });

  try {
    // Nace sin ubigeo, y eso no rompe nada: una compañía recién creada no lo
    // tiene, y el XML simplemente sale sin ese dato.
    const inicial = await obtenerConfiguracionEmpresa(empresaId);
    assert.equal(inicial.ubigeo, null);

    await prisma.configuracionEmpresa.update({
      where: { empresaId },
      data: { ubigeoId: ubigeo.id, departamento: "LIMA", provincia: "LIMA", distrito: "SAN ISIDRO" },
    });

    // Viene incluido, no en una segunda consulta fácil de olvidar: quien arma
    // un comprobante necesita el código junto al resto de la configuración.
    const conUbigeo = await obtenerConfiguracionEmpresa(empresaId);
    assert.equal(conUbigeo.ubigeo?.codigo, ubigeo.codigo);
    assert.equal(conUbigeo.ubigeo?.distrito, "SAN ISIDRO");
    // Y el texto quedó sincronizado, porque lo leen los documentos impresos.
    assert.equal(conUbigeo.distrito, "SAN ISIDRO");
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
    await prisma.ubigeo.deleteMany({ where: { id: ubigeo.id } });
  }
});

test("cada compañía tiene su propia dirección fiscal", async () => {
  // Es parte de la identidad de la sociedad emisora, como el RUC.
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const a = `empresa-emisor-a-${sufijo}`;
  const b = `empresa-emisor-b-${sufijo}`;
  await prisma.empresa.createMany({ data: [a, b].map((id) => ({ id, razonSocial: id })) });
  const [lima, arequipa] = await Promise.all([
    prisma.ubigeo.create({
      data: { codigo: `6${sufijo.slice(0, 5)}`, departamento: "LIMA", provincia: "LIMA", distrito: "MIRAFLORES" },
    }),
    prisma.ubigeo.create({
      data: { codigo: `5${sufijo.slice(0, 5)}`, departamento: "AREQUIPA", provincia: "AREQUIPA", distrito: "YANAHUARA" },
    }),
  ]);

  try {
    await obtenerConfiguracionEmpresa(a);
    await obtenerConfiguracionEmpresa(b);
    await prisma.configuracionEmpresa.update({ where: { empresaId: a }, data: { ubigeoId: lima.id } });
    await prisma.configuracionEmpresa.update({ where: { empresaId: b }, data: { ubigeoId: arequipa.id } });

    assert.equal((await obtenerConfiguracionEmpresa(a)).ubigeo?.distrito, "MIRAFLORES");
    assert.equal((await obtenerConfiguracionEmpresa(b)).ubigeo?.distrito, "YANAHUARA");
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId: { in: [a, b] } } });
    await prisma.empresa.deleteMany({ where: { id: { in: [a, b] } } });
    await prisma.ubigeo.deleteMany({ where: { id: { in: [lima.id, arequipa.id] } } });
  }
});

// --- Guardias ---------------------------------------------------------------

test("el ubigeo del emisor llega al XML", async () => {
  // El constructor UBL ya aceptaba emisor.ubigeo; hasta este ciclo nadie se lo
  // pasaba, así que el XML salía sin el ubigeo del emisor y nada lo advertía.
  const envio = await readFile(resolve(process.cwd(), "src/lib/facturacionElectronica.ts"), "utf8");
  assert.match(envio, /ubigeo: config\.ubigeo\?\.codigo/, "las credenciales deben llevar el código");
  assert.match(envio, /ubigeo: credenciales\.ubigeo/, "el emisor del UBL debe recibirlo");

  const ubl = await readFile(resolve(process.cwd(), "src/lib/sunatUbl.ts"), "utf8");
  assert.match(ubl, /emisor\.ubigeo/, "el UBL debe emitir el ubigeo del emisor");
});

test("el distrito del emisor se valida contra el catálogo", async () => {
  const acciones = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/empresa/actions.ts"),
    "utf8"
  );
  assert.match(acciones, /resolverUbigeoEnTransaccion\(tx, ubigeoId\)/);
  // Y el texto se deriva del catálogo, en vez de quedar suelto.
  assert.match(acciones, /nombresDeUbigeo\(ubigeo\)/);
  // El formulario ya no manda la terna a mano.
  const formulario = await readFile(
    resolve(process.cwd(), "src/app/(app)/configuracion/empresa/EmpresaFormulario.tsx"),
    "utf8"
  );
  assert.doesNotMatch(formulario, /name="distrito"/);
  assert.doesNotMatch(formulario, /name="departamento"/);
});
