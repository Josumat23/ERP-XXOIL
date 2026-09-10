import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioEmpresaActiva as obtenerUsuario } from "@/lib/empresas";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import LiberarFormulario from "../LiberarFormulario";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await obtenerUsuario();
  if (!u || !(await puedeRealizar(u, "materiales", "ver"))) redirect("/");
  const { id } = await params;
  const a = await prisma.acuerdoSuministro.findFirst({
    where: { id, empresaId: u.empresaId },
    include: {
      proveedor: true,
      lineas: { include: { insumo: true } },
      ordenesCompra: { orderBy: { fecha: "desc" } },
    },
  });
  if (!a) notFound();
  const vigente =
    a.estado === "ACTIVO" &&
    a.vigenteDesde <= new Date() &&
    a.vigenteHasta >= new Date();
  return (
    <div className="max-w-5xl">
      <Link
        href="/logistica/acuerdos-suministro"
        className="hover:underline text-sm"
      >
        ← Acuerdos
      </Link>
      <h1 className="text-2xl font-semibold mt-2">
        {a.numero} — {a.titulo}
      </h1>
      <p className="text-neutral-500">
        {a.proveedor.razonSocial} · {a.moneda}
        {a.moneda === "USD" ? ` · TC ${a.tipoCambio.toNumber()}` : ""}
      </p>
      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Material</th>
            <th className="text-right">Comprometido</th>
            <th className="text-right">Liberado</th>
            <th className="text-right">Saldo</th>
            <th className="text-right">Precio</th>
          </tr>
        </thead>
        <tbody>
          {a.lineas.map((l) => (
            <tr key={l.id}>
              <td>
                {l.insumo.codigo} — {l.insumo.nombre}
              </td>
              <td className="text-right">
                {formatNumero(l.cantidadComprometida, 3)}
              </td>
              <td className="text-right">
                {formatNumero(l.cantidadLiberada, 3)}
              </td>
              <td className="text-right">
                {formatNumero(
                  l.cantidadComprometida.minus(l.cantidadLiberada),
                  3,
                )}
              </td>
              <td className="text-right">
                {formatMoneda(l.precioUnitario, a.moneda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {vigente && (
        <section className="border rounded-lg p-4 mt-6">
          <h2 className="font-semibold mb-3">Nueva liberación</h2>
          <LiberarFormulario
            acuerdoId={a.id}
            lineas={a.lineas
              .map((l) => ({
                id: l.id,
                nombre: l.insumo.nombre,
                saldo: l.cantidadComprometida
                  .minus(l.cantidadLiberada)
                  .toNumber(),
              }))
              .filter((l) => l.saldo > 0)}
          />
        </section>
      )}
      <section className="mt-6">
        <h2 className="font-semibold">Órdenes liberadas</h2>
        {a.ordenesCompra.map((o) => (
          <Link
            key={o.id}
            href={`/logistica/ordenes-compra/${o.id}`}
            className="block hover:underline font-mono mt-2"
          >
            {o.numero}
          </Link>
        ))}
      </section>
    </div>
  );
}
