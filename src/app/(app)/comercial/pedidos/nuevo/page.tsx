import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PedidoFormulario from "../PedidoFormulario";
import { calcularAtpPorProducto, unidadesEquivalentes } from "@/lib/atp";

export default async function NuevoPedidoPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "ventas", "ver"))) redirect("/");

  const [clientes, vendedores, almacenes, presentaciones, pedidos, descuentosCanal, atpPorProducto] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.vendedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.presentacion.findMany({
      where: { activo: true },
      include: { producto: true, escalonesPrecio: { orderBy: { cantidadMinima: "asc" } } },
      orderBy: { sku: "asc" },
    }),
    prisma.pedido.findMany({ include: { cliente: true }, orderBy: { fecha: "desc" } }),
    prisma.descuentoCanal.findMany(),
    calcularAtpPorProducto(),
  ]);
  const descuentoPorCanal = Object.fromEntries(
    descuentosCanal.map((d) => [d.canal, d.descuentoPct.toNumber()])
  );
  const hoy = new Date();
  const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <Link href="/comercial/pedidos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a pedidos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Nuevo pedido
      </h1>

      <PanelMaestroDetalle
        nuevoHref="/comercial/pedidos/nuevo"
        nuevoTexto="Nuevo pedido"
        registros={pedidos.map((p) => ({
          id: p.id,
          href: `/comercial/pedidos/${p.id}`,
          primario: p.numero,
          secundario: p.cliente.razonSocial,
        }))}
      >
      <div className="max-w-3xl">
        <PedidoFormulario
          clientes={clientes.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            etiqueta: c.razonSocial,
            ruc: c.ruc,
            vendedorId: c.vendedorId,
            canal: c.canal,
            direccion: c.direccion,
            condicionPago: c.condicionPagoDefecto,
          }))}
          vendedores={vendedores.map((v) => ({ id: v.id, etiqueta: v.nombre }))}
          almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: `${a.codigo} — ${a.nombre}` }))}
          fechaMinima={fechaMinima}
          descuentoPorCanal={descuentoPorCanal}
          presentaciones={presentaciones.map((p) => {
            const atp = atpPorProducto.get(p.productoId);
            const contenidoKg = p.contenidoKg.toNumber();
            const atpProduccion = atp
              ? unidadesEquivalentes(atp.granelSinEnvasarKg, contenidoKg) +
                unidadesEquivalentes(atp.planificadoKg, contenidoKg)
              : 0;
            return {
              id: p.id,
              etiqueta: `${p.producto.nombre} — ${p.nombre}`,
              precio: p.precio.toNumber(),
              stock: p.stock.toNumber() - p.stockReservado.toNumber(),
              atpProduccion,
              escalones: p.escalonesPrecio.map((e) => ({
                cantidadMinima: e.cantidadMinima,
                precio: e.precio.toNumber(),
              })),
            };
          })}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
