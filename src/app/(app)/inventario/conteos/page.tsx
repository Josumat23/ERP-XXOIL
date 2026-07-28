import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ConteoFormulario from "./ConteoFormulario";

export default async function ConteosPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) {
    redirect("/inventario/kardex");
  }

  const [presentaciones, insumos, conteos] = await Promise.all([
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.conteoInventario.findMany({ orderBy: { fecha: "desc" }, take: 30 }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Conteo cíclico de inventario
      </h1>
      <p className="text-neutral-500 mt-1">
        Registra lo contado físicamente; las diferencias contra el sistema se ajustan solas en el
        kardex, con el código del conteo como motivo.
      </p>

      <PanelMaestroDetalle
        registros={conteos.map((c) => ({
          id: c.id,
          href: `/inventario/conteos/${c.id}`,
          primario: c.codigo,
          secundario: new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(c.fecha),
        }))}
      >
      <div className="mt-6 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <ConteoFormulario
          presentaciones={presentaciones.map((p) => ({
            valor: `PRESENTACION:${p.id}`,
            etiqueta: `${p.sku} — ${p.producto.nombre} ${p.nombre}`,
            stock: p.stock.toNumber(),
          }))}
          insumos={insumos.map((i) => ({
            valor: `INSUMO:${i.id}`,
            etiqueta: `${i.codigo} — ${i.nombre}`,
            stock: i.stock.toNumber(),
          }))}
        />
      </div>

      <div className="mt-8">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Conteos anteriores</h2>
        <ul className="flex flex-col gap-1">
          {conteos.map((c) => (
            <li key={c.id} className="text-sm">
              <Link href={`/inventario/conteos/${c.id}`} className="hover:underline font-mono">
                {c.codigo}
              </Link>{" "}
              <span className="text-neutral-500">
                — {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(c.fecha)} por{" "}
                {c.usuarioNombre}
              </span>
            </li>
          ))}
          {conteos.length === 0 && <li className="text-sm text-neutral-500">Sin conteos registrados.</li>}
        </ul>
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
