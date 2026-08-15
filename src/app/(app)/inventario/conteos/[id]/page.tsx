import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatNumero } from "@/lib/format";

export default async function DetalleConteoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { id } = await params;

  const conteo = await prisma.conteoInventario.findUnique({
    where: { id },
    include: {
      detalles: {
        include: { presentacion: { include: { producto: true } }, insumo: true },
      },
    },
  });
  if (!conteo) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/inventario/conteos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a conteos
      </Link>
      <h1 className="text-2xl font-semibold mt-1" style={{ color: "var(--epicor-texto)" }}>
        Conteo {conteo.codigo}
      </h1>
      <p className="text-sm text-neutral-500 mt-1">
        Registrado por {conteo.usuarioNombre} el{" "}
        {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(conteo.fecha)}
      </p>

      <table className="tabla mt-6">
        <thead>
          <tr>
            <th>Ítem</th>
            <th className="text-right">Sistema</th>
            <th className="text-right">Contado</th>
            <th className="text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {conteo.detalles.map((d) => {
            const diferencia = d.diferencia.toNumber();
            return (
              <tr key={d.id}>
                <td>
                  {d.tipoItem === "PRESENTACION"
                    ? `${d.presentacion?.producto.nombre} — ${d.presentacion?.nombre}`
                    : d.insumo?.nombre}
                </td>
                <td className="text-right">{formatNumero(d.cantidadSistema, 2)}</td>
                <td className="text-right">{formatNumero(d.cantidadContada, 2)}</td>
                <td
                  className={`text-right font-medium ${
                    diferencia > 0
                      ? "text-green-700 dark:text-green-400"
                      : diferencia < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-neutral-400"
                  }`}
                >
                  {diferencia > 0 ? "+" : ""}
                  {formatNumero(diferencia, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
