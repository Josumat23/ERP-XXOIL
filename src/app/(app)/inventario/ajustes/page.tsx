import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import AjusteFormulario from "./AjusteFormulario";

export default async function AjustesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || (usuario.rol !== "ADMIN" && usuario.rol !== "ALMACEN")) {
    redirect("/inventario/kardex");
  }
  if (!(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const [presentaciones, insumos] = await Promise.all([
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true },
      orderBy: { sku: "asc" },
    }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Ajuste de inventario
      </h1>
      <p className="text-neutral-500 mt-1">
        Regulariza diferencias sin tocar la historia: se registra un movimiento nuevo en el kardex
        con su motivo, usuario y fecha.
      </p>

      <div className="mt-6">
        <AjusteFormulario
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
    </div>
  );
}
