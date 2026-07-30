import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PanelMaestroDetalle from "@/components/PanelMaestroDetalle";
import PanelDirecciones from "@/components/PanelDirecciones";
import PanelContactos from "@/components/PanelContactos";
import PanelAdjuntos from "@/components/PanelAdjuntos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import ProveedorFormulario from "../ProveedorFormulario";
import { actualizarProveedor } from "../actions";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const empresaId = await obtenerEmpresaActivaId();
  const [proveedor, proveedores] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id } }),
    prisma.proveedor.findMany({ where: { empresaId }, orderBy: { razonSocial: "asc" } }),
  ]);
  if (!proveedor) notFound();

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
