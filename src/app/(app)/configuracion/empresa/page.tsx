import { redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/auth";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import EmpresaFormulario from "./EmpresaFormulario";

export default async function EmpresaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");

  const config = await obtenerConfiguracionEmpresa();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Configuración de la empresa
      </h1>
      <p className="text-neutral-500 mt-1">
        Datos fiscales y parámetros generales. Los documentos impresos (facturas, guías, órdenes de
        compra, hojas de ruta) usan esta información como membrete.
      </p>

      <div className="mt-6">
        <EmpresaFormulario
          valores={{
            razonSocial: config.razonSocial,
            nombreComercial: config.nombreComercial,
            ruc: config.ruc,
            direccion: config.direccion,
            ciudad: config.ciudad,
            telefono: config.telefono,
            email: config.email,
            sitioWeb: config.sitioWeb,
            tasaIgv: config.tasaIgv.toNumber(),
          }}
        />
      </div>
    </div>
  );
}
