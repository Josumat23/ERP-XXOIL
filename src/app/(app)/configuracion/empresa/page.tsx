import { redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerConfiguracionEmpresa } from "@/lib/empresa";
import { prisma } from "@/lib/prisma";
import EmpresaFormulario from "./EmpresaFormulario";
import CuentasBancarias from "./CuentasBancarias";

export default async function EmpresaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/");
  if (!(await puedeRealizar(usuario, "configuracion", "ver"))) redirect("/");

  const [config, cuentasBancarias] = await Promise.all([
    obtenerConfiguracionEmpresa(),
    prisma.cuentaBancariaEmpresa.findMany({ where: { empresaId: "1" }, orderBy: { banco: "asc" } }),
  ]);

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
            direccion2: config.direccion2,
            ciudad: config.ciudad,
            distrito: config.distrito,
            provincia: config.provincia,
            departamento: config.departamento,
            codigoPostal: config.codigoPostal,
            pais: config.pais,
            telefono: config.telefono,
            fax: config.fax,
            email: config.email,
            sitioWeb: config.sitioWeb,
            tasaIgv: config.tasaIgv.toNumber(),
            registroHidrocarburosOsinergmin: config.registroHidrocarburosOsinergmin,
            registroHidrocarburosVigencia: config.registroHidrocarburosVigencia
              ? config.registroHidrocarburosVigencia.toISOString().slice(0, 10)
              : null,
            tarifaHoraManoObra: config.tarifaHoraManoObra.toNumber(),
            montoAprobacionCompras: config.montoAprobacionCompras.toNumber(),
            montoAprobacionPagos: config.montoAprobacionPagos.toNumber(),
            tasaDescuentoCxC: config.tasaDescuentoCxC.toNumber(),
            tasaCreditoCortoPlazo: config.tasaCreditoCortoPlazo.toNumber(),
            limiteCreditoCortoPlazo: config.limiteCreditoCortoPlazo.toNumber(),
            tasaCreditoLargoPlazo: config.tasaCreditoLargoPlazo.toNumber(),
            tasaRecargoMora: config.tasaRecargoMora.toNumber(),
            oseProveedor: config.oseProveedor,
            oseToken: config.oseToken,
            sunatUsuarioSol: config.sunatUsuarioSol,
            sunatClaveSol: config.sunatClaveSol,
            sunatCertificadoPassword: config.sunatCertificadoPassword,
            tieneCertificado: Boolean(config.sunatCertificadoBase64),
          }}
        />
      </div>

      <div className="mt-8">
        <CuentasBancarias cuentas={cuentasBancarias} />
      </div>
    </div>
  );
}
