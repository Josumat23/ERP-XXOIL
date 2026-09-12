import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { prisma } from "@/lib/prisma";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { ETIQUETA_REGIMEN_TRIBUTARIO } from "@/lib/regimenTributario";

// Representante legal, su documento y el régimen tributario: los datos de la
// entidad legal que la razón social y el RUC no cubren. Son referencia
// informativa para documentos formales.

test("los datos de entidad legal se guardan y son opcionales", async () => {
  const empresaId = `empresa-legal-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await prisma.empresa.create({ data: { id: empresaId, razonSocial: empresaId } });

  try {
    // Nacen vacíos: una compañía nueva no tiene por qué declararlos.
    const inicial = await obtenerConfiguracionEmpresa(empresaId);
    assert.equal(inicial.representanteLegal, null);
    assert.equal(inicial.representanteLegalDocumento, null);
    assert.equal(inicial.regimenTributario, null);

    const guardada = await prisma.configuracionEmpresa.update({
      where: { empresaId },
      data: {
        representanteLegal: "María Quispe Rojas",
        representanteLegalDocumento: "09876543",
        regimenTributario: "RMT",
      },
    });
    assert.equal(guardada.representanteLegal, "María Quispe Rojas");
    assert.equal(guardada.regimenTributario, "RMT");

    // El régimen es un catálogo cerrado en base.
    await assert.rejects(() =>
      prisma.configuracionEmpresa.update({
        where: { empresaId },
        // @ts-expect-error valor fuera del enum, a propósito
        data: { regimenTributario: "INVENTADO" },
      })
    );
  } finally {
    await prisma.configuracionEmpresa.deleteMany({ where: { empresaId } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
  }
});

test("las etiquetas cubren exactamente los regímenes del catálogo", async () => {
  const esquema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const bloque = esquema.slice(
    esquema.indexOf("enum RegimenTributario {"),
    esquema.indexOf("}", esquema.indexOf("enum RegimenTributario {"))
  );
  const valores = bloque
    .split("\n")
    .slice(1)
    .map((linea) => linea.split("//")[0].trim())
    .filter(Boolean);

  assert.deepEqual(valores.sort(), Object.keys(ETIQUETA_REGIMEN_TRIBUTARIO).sort());
});

// --- Guardia ----------------------------------------------------------------

async function archivosFuente(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const rutas: string[] = [];
  for (const entrada of entradas) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "generated" || entrada.name === "node_modules") continue;
      rutas.push(...(await archivosFuente(ruta)));
    } else if (/\.tsx?$/.test(entrada.name)) {
      rutas.push(ruta);
    }
  }
  return rutas;
}

test("el régimen tributario no gobierna ningún cálculo", async () => {
  // La razón de ser de esta guardia: el día que alguien haga que el régimen
  // decida una tasa o una obligación, estará inventando un requisito legal a
  // partir de un campo que se documentó como informativo. Ese criterio lo
  // tiene que dar un contador, no el código.
  const raiz = resolve(process.cwd(), "src");
  const usos: string[] = [];

  for (const ruta of await archivosFuente(raiz)) {
    const contenido = await readFile(ruta, "utf8");
    if (!/regimenTributario/i.test(contenido)) continue;
    // Se permite leerlo, mostrarlo y guardarlo. No se permite ramificar sobre
    // él: un `if`, un `switch` o un ternario sobre el régimen es una decisión
    // de negocio disfrazada.
    if (/(if\s*\(|switch\s*\(|\?\s*)[^\n;]*regimenTributario\s*===/.test(contenido)) {
      usos.push(ruta.replace(raiz, "src"));
    }
  }

  assert.deepEqual(
    usos,
    [],
    `El régimen tributario es informativo: no debe decidir tasas ni obligaciones.\n${usos.join("\n")}`
  );
});
