import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import BotonImprimir from "@/components/BotonImprimir";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import CompetenciaFormulario from "./CompetenciaFormulario";

export default async function CompetenciaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const productos = await prisma.productoCompetencia.findMany({
    where: { empresaId },
    include: { _count: { select: { especificaciones: true, equivalencias: true } } },
    orderBy: [{ marca: "asc" }, { nombre: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Productos de la competencia
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-sm mb-1" style={{ color: "var(--epicor-texto-tenue)" }}>
        Para contestar la pregunta que más se repite en una venta: «¿cuál es su equivalente al
        Delvac 1340?».
      </p>
      {/*
        La diferencia con una tabla de sinónimos: acá la equivalencia se apoya
        en las especificaciones que las dos fichas declaran, y el sistema puede
        decir qué cubre y qué no.
      */}
      <p className="text-sm mb-5" style={{ color: "var(--epicor-texto-tenue)" }}>
        La equivalencia no se teclea suelta: se declara contra las especificaciones que cada ficha
        dice cumplir, y queda con su cobertura, su motivo y su responsable.
      </p>

      <div className="max-w-4xl">
        <CompetenciaFormulario />

        <table className="tabla mt-6">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Producto</th>
              <th>Fuente</th>
              <th>Especificaciones</th>
              <th>Equivalentes nuestros</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.marca}</td>
                <td className="font-medium">
                  <Link href={`/catalogo/competencia/${p.id}`} className="hover:underline">
                    {p.nombre}
                  </Link>
                </td>
                <td style={{ color: "var(--epicor-texto-tenue)" }}>{p.fuente ?? "—"}</td>
                <td>{p._count.especificaciones}</td>
                <td
                  className={p._count.equivalencias === 0 ? "" : "font-medium"}
                  style={p._count.equivalencias === 0 ? { color: "var(--epicor-texto-tenue)" } : undefined}
                >
                  {p._count.equivalencias === 0 ? "sin declarar" : p._count.equivalencias}
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-6" style={{ color: "var(--epicor-texto-tenue)" }}>
                  Todavía no hay productos de la competencia cargados. Necesitan que el catálogo de{" "}
                  <Link href="/catalogo/especificaciones" className="hover:underline">
                    especificaciones técnicas
                  </Link>{" "}
                  tenga contra qué comparar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
