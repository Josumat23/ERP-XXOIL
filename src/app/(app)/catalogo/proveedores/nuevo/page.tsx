import Link from "next/link";
import ProveedorFormulario from "../ProveedorFormulario";
import { crearProveedor } from "../actions";

export default function NuevoProveedorPage() {
  return (
    <div className="max-w-lg">
      <Link href="/catalogo/proveedores" className="text-sm text-neutral-500 hover:underline">
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mt-2">
        Nuevo proveedor
      </h1>

      <div className="mt-6">
        <ProveedorFormulario accion={crearProveedor} textoBoton="Crear proveedor" />
      </div>
    </div>
  );
}
