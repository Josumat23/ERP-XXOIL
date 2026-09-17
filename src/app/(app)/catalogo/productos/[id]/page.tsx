import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import { unidadesMedidaParaSelect } from "@/lib/unidadesMedida";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import ProductoFormulario from "../ProductoFormulario";
import { actualizarProducto, declararEspecificacion, quitarEspecificacion } from "../actions";
import EspecificacionesProducto from "./EspecificacionesProducto";
import { declaracionesParaDocumento, etiquetaEspecificacion, homologacionesPorVencer, textoDeclaracion } from "@/lib/especificaciones";
import { obtenerEmpresaActivaId } from "@/lib/empresas";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();

  const [producto, productos, categorias, unidadesMedida] = await Promise.all([
    prisma.producto.findUnique({
      where: { id, empresaId },
      include: {
        presentaciones: { orderBy: { creadoEn: "asc" } },
        especificaciones: {
          include: { especificacion: true },
          orderBy: [{ especificacion: { organismo: "asc" } }, { especificacion: { codigo: "asc" } }],
        },
      },
    }),
    prisma.producto.findMany({ where: { empresaId }, orderBy: { creadoEn: "desc" } }),
    prisma.categoria.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    unidadesMedidaParaSelect(),
  ]);

  // Solo las activas se pueden declarar: desactivar una especificación
  // significa que la empresa dejó de manejarla, y las ya declaradas se
  // conservan porque son un hecho del pasado.
  const especificacionesActivas = await prisma.especificacionTecnica.findMany({
    where: { empresaId, activo: true },
    orderBy: [{ organismo: "asc" }, { codigo: "asc" }],
  });

  if (!producto) notFound();

  // Las que el certificado ya no imprimiría, para marcarlas acá y que alguien
  // cargue la renovación. Se resuelve una vez, fuera del render.
  const vigentes = new Set(declaracionesParaDocumento(producto.especificaciones).map((e) => e.id));
  const vencidas = new Set(
    producto.especificaciones.filter((e) => !vigentes.has(e.id)).map((e) => e.id)
  );
  // Renovar una homologación toma meses. Avisar el día que vence es avisar
  // tarde: el certificado ya dejó de imprimirla.
  const DIAS_DE_AVISO = 90;
  const porVencer = new Set(
    homologacionesPorVencer(producto.especificaciones, DIAS_DE_AVISO)
      .filter((e) => !vencidas.has(e.id))
      .map((e) => e.id)
  );

  return (
    <div>
      <Link href="/catalogo/productos" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar producto
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/catalogo/productos/nuevo"
        nuevoTexto="Nuevo producto"
        registros={productos.map((p) => ({
          id: p.id,
          href: `/catalogo/productos/${p.id}`,
          primario: p.nombre,
          secundario: p.codigo,
        }))}
      >
      <div className="max-w-2xl">
        <ProductoFormulario
          accion={actualizarProducto.bind(null, id)}
          categorias={categorias}
          unidadesMedida={unidadesMedida}
          valoresIniciales={{
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            categoriaId: producto.categoriaId,
            unidadMedidaBase: producto.unidadMedidaBase,
            marca: producto.marca,
            gradoNlgi: producto.gradoNlgi,
            viscosidad: producto.viscosidad,
            densidadKgL: producto.densidadKgL ? producto.densidadKgL.toNumber() : null,
            temperaturaReferenciaC: producto.temperaturaReferenciaC
              ? producto.temperaturaReferenciaC.toNumber()
              : null,
            vidaUtilMeses: producto.vidaUtilMeses,
            segmentoMercado: producto.segmentoMercado,
            fichaTecnicaUrl: producto.fichaTecnicaUrl,
            hojaSeguridadUrl: producto.hojaSeguridadUrl,
            notasTecnicas: producto.notasTecnicas,
          }}
          textoBoton="Guardar cambios"
        />
      </div>

      {/*
        Lo que el producto declara sobre las normas del rubro. Antes esto vivía
        en `notasTecnicas`, texto libre: servía para leerlo y para nada más.
      */}
      <section className="mt-10">
        <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Especificaciones técnicas
        </h2>

        {producto.especificaciones.length > 0 && (
          <table className="tabla mb-4">
            <thead>
              <tr>
                <th>Especificación</th>
                <th>Declaración</th>
                <th>Vigente hasta</th>
                <th>Declarada por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {producto.especificaciones.map((e) => {
                const vencida = vencidas.has(e.id);
                return (
                  <tr key={e.id}>
                    <td className="font-medium">{etiquetaEspecificacion(e.especificacion)}</td>
                    <td>{textoDeclaracion(e)}</td>
                    <td
                      className={
                        vencida
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : porVencer.has(e.id)
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : ""
                      }
                    >
                      {e.vigenteHasta
                        ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(
                            e.vigenteHasta
                          )
                        : "—"}
                      {vencida && " — VENCIDA"}
                      {porVencer.has(e.id) && ` — vence en menos de ${DIAS_DE_AVISO} días`}
                    </td>
                    <td>{e.usuarioNombre}</td>
                    <td>
                      <form
                        action={async () => {
                          "use server";
                          await quitarEspecificacion(producto.id, e.id);
                        }}
                      >
                        <button type="submit" className="text-sm text-red-600 hover:underline">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <EspecificacionesProducto
          accion={declararEspecificacion.bind(null, producto.id)}
          opciones={especificacionesActivas
            .filter((e) => !producto.especificaciones.some((d) => d.especificacionId === e.id))
            .map((e) => ({ id: e.id, etiqueta: etiquetaEspecificacion(e) }))}
          catalogoVacio={especificacionesActivas.length === 0}
        />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">Presentaciones</h2>
          <Link
            href={`/catalogo/presentaciones/nuevo?productoId=${producto.id}`}
            className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
          >
            + Agregar presentación
          </Link>
        </div>
        <table className="tabla mt-3">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Contenido</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {producto.presentaciones.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.sku}</td>
                <td>{p.nombre}</td>
                <td>{formatNumero(p.contenidoKg, 3)} kg</td>
                <td>{formatMoneda(p.precio, p.moneda)}</td>
                <td>{formatNumero(p.stock, 0)}</td>
              </tr>
            ))}
            {producto.presentaciones.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-neutral-500 py-4">
                  Este producto aún no tiene presentaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      </PanelMaestroDetalle>
    </div>
  );
}
