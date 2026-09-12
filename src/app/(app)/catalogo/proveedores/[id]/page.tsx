import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelDirecciones from "@/components/PanelDirecciones";
import PanelContactos from "@/components/PanelContactos";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import { obtenerEmpresaActivaId, perteneceAEmpresaActiva } from "@/lib/empresas";
import ProveedorFormulario from "../ProveedorFormulario";
import { actualizarProveedor, registrarCondicionComercial } from "../actions";
import { arbolUbigeos } from "@/lib/ubigeosCatalogo";
import { formatFecha } from "@/lib/format";
import CondicionComercialFormulario from "./CondicionComercialFormulario";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();
  const [proveedor, proveedores, arbol] = await Promise.all([
    prisma.proveedor.findFirst({
      where: { id, empresaId },
      include: {
        ubigeo: true,
        condicionesComerciales: { orderBy: { vigenteDesde: "desc" } },
      },
    }),
    prisma.proveedor.findMany({ where: { empresaId }, orderBy: { razonSocial: "asc" } }),
    arbolUbigeos(),
  ]);
  if (!perteneceAEmpresaActiva(proveedor, empresaId)) notFound();

  return (
    <div>
      <Link href="/catalogo/proveedores" className="text-sm hover:underline" style={{ color: "var(--epicor-texto-tenue)" }}>
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-semibold mt-1 mb-4" style={{ color: "var(--epicor-texto)" }}>
        Editar proveedor
      </h1>

      <PanelMaestroDetalle
        seleccionadoId={id}
        nuevoHref="/catalogo/proveedores/nuevo"
        nuevoTexto="Nuevo proveedor"
        registros={proveedores.map((p) => ({
          id: p.id,
          href: `/catalogo/proveedores/${p.id}`,
          primario: p.razonSocial,
          secundario: p.ruc ?? undefined,
        }))}
      >
      <div className="max-w-lg flex flex-col gap-6">
        <ProveedorFormulario
          accion={actualizarProveedor.bind(null, id)}
          arbolUbigeos={arbol}
          ubigeoSeleccionado={proveedor.ubigeo}
          valoresIniciales={{
            razonSocial: proveedor.razonSocial,
            tipoDocumentoFiscal: proveedor.tipoDocumentoFiscal,
            ruc: proveedor.ruc,
            pais: proveedor.pais,
            telefono: proveedor.telefono,
            email: proveedor.email,
            direccion: proveedor.direccion,
            contactoNombre: proveedor.contactoNombre,
            contactoTelefono: proveedor.contactoTelefono,
            cuentaBancaria: proveedor.cuentaBancaria,
            banco: proveedor.banco,
            numeroCuenta: proveedor.numeroCuenta,
            cci: proveedor.cci,
            swift: proveedor.swift,
            iban: proveedor.iban,
            condicionPagoDias: proveedor.condicionPagoDias,
            notas: proveedor.notas,
          }}
          textoBoton="Guardar cambios"
        />
        <section className="borde-seccion">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
            Condiciones comerciales
          </h2>
          <p className="text-sm mb-3" style={{ color: "var(--epicor-texto-tenue)" }}>
            Plazo de pago pactado, con vigencias. Permite responder qué condición regía cuando se
            recibió una factura, y por qué cambió.
          </p>

          <CondicionComercialFormulario
            accion={registrarCondicionComercial.bind(null, proveedor.id)}
            diasVigentes={proveedor.condicionPagoDias}
          />

          <table className="tabla mt-4">
            <thead>
              <tr>
                <th>Plazo</th>
                <th>Rige desde</th>
                <th>Hasta</th>
                <th>Motivo</th>
                <th>Registró</th>
              </tr>
            </thead>
            <tbody>
              {proveedor.condicionesComerciales.map((c) => (
                <tr key={c.id}>
                  <td>{c.condicionPagoDias === 0 ? "Contado" : `${c.condicionPagoDias} días`}</td>
                  <td>{formatFecha(c.vigenteDesde)}</td>
                  <td>
                    {c.vigenteHasta ? (
                      formatFecha(c.vigenteHasta)
                    ) : (
                      <span className="insignia bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                        Vigente
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-neutral-500">{c.motivo}</td>
                  <td className="text-xs text-neutral-500">{c.usuarioNombre}</td>
                </tr>
              ))}
              {proveedor.condicionesComerciales.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-500 py-3">
                    Sin condiciones registradas. El proveedor opera con el plazo vigente de su
                    ficha ({proveedor.condicionPagoDias === 0
                      ? "contado"
                      : `${proveedor.condicionPagoDias} días`}), sin historial que lo respalde.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <PanelDirecciones
          entidadTipo="Proveedor"
          entidadId={proveedor.id}
          rutaRevalidar={`/catalogo/proveedores/${proveedor.id}`}
        />
        <PanelContactos
          entidadTipo="Proveedor"
          entidadId={proveedor.id}
          rutaRevalidar={`/catalogo/proveedores/${proveedor.id}`}
        />
        <PanelAdjuntos
          entidadTipo="Proveedor"
          entidadId={proveedor.id}
          rutaRevalidar={`/catalogo/proveedores/${proveedor.id}`}
        />
      </div>
      </PanelMaestroDetalle>
    </div>
  );
}
