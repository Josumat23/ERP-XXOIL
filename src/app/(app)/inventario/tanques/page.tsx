import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import BotonImprimir from "@/components/BotonImprimir";
import TanqueFormulario from "./TanqueFormulario";
import { crearTanque } from "./actions";

function formatKg(valor: number) {
  return valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function TanquesPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");
  const empresaId = await obtenerEmpresaActivaId();

  const [tanques, almacenes, insumos, puedeCrear] = await Promise.all([
    prisma.tanque.findMany({
      where: { empresaId },
      include: {
        insumo: { select: { codigo: true, nombre: true } },
        almacen: { select: { nombre: true } },
        _count: { select: { aportes: true } },
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.almacen.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.insumo.findMany({
      where: { empresaId, activo: true, tipo: "MATERIA_PRIMA" },
      orderBy: { nombre: "asc" },
    }),
    puedeRealizar(usuario, "materiales", "crear"),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
          Tanques de granel
        </h1>
        <BotonImprimir />
      </div>

      <p className="text-sm mb-6 max-w-3xl" style={{ color: "var(--epicor-texto-tenue)" }}>
        Para la base que llega en cisterna. Al descargar sobre el remanente de otra recepción los
        lotes quedan <strong>mezclados</strong>, así que el consumo hacia producción se reparte{" "}
        <strong>en proporción</strong> a lo que cada recepción aporta — y la trazabilidad dice con
        qué porcentaje participó cada lote, en vez de señalar uno solo. Lo que llega envasado
        (cilindro, IBC) no pasa por acá: cada envase conserva su lote.
      </p>

      {tanques.length === 0 ? (
        <p className="text-sm mb-6" style={{ color: "var(--epicor-texto-tenue)" }}>
          Todavía no hay tanques.
        </p>
      ) : (
        <div className="overflow-x-auto mb-8">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Almacén</th>
                <th>Contiene</th>
                <th className="text-right">Contenido (kg)</th>
                <th className="text-right">Capacidad (kg)</th>
                <th className="text-right">Lotes en mezcla</th>
              </tr>
            </thead>
            <tbody>
              {tanques.map((t) => {
                const contenido = t.contenidoKg.toNumber();
                const capacidad = t.capacidadKg.toNumber();
                return (
                  <tr key={t.id}>
                    <td className="font-mono">
                      <Link href={`/inventario/tanques/${t.id}`} className="enlace">
                        {t.codigo}
                      </Link>
                    </td>
                    <td>{t.nombre}</td>
                    <td>{t.almacen.nombre}</td>
                    <td>
                      {t.insumo.codigo} — {t.insumo.nombre}
                    </td>
                    <td className="text-right">{formatKg(contenido)}</td>
                    <td className="text-right">{formatKg(capacidad)}</td>
                    <td className="text-right">{t._count.aportes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {puedeCrear && (
        <section className="borde-seccion">
          <h2 className="text-lg font-semibold mb-3">Nuevo tanque</h2>
          <TanqueFormulario
            accion={crearTanque}
            almacenes={almacenes.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
            insumos={insumos.map((i) => ({ id: i.id, etiqueta: `${i.codigo} — ${i.nombre}` }))}
          />
        </section>
      )}
    </div>
  );
}
