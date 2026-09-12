// Tipos y funciones puras del catálogo UBIGEO.
//
// Deliberadamente sin `server-only` y sin importar Prisma: el componente
// cliente del selector toma los tipos de aquí, y la suite prueba las funciones
// sin levantar el cliente de base de datos. Lo que consulta la base vive en
// `@/lib/ubigeosCatalogo`.

/**
 * Catálogo agrupado para los selectores en cascada.
 *
 * Son 1834 distritos. Mandarlos al navegador como lista plana de objetos pesa
 * cientos de KB en cada pantalla con formulario de dirección; agrupados por
 * departamento y provincia, con el distrito reducido a un par [id, nombre],
 * bajan a una fracción y el selector no necesita consultar al servidor en cada
 * paso.
 */
export type ArbolUbigeos = Record<string, Record<string, Array<[string, string]>>>;

/** Lo que el selector necesita del valor ya guardado, para preseleccionarlo. */
export type UbigeoSeleccionado = {
  id: string;
  departamento: string;
  provincia: string;
  distrito: string;
};

type ClienteLectura = {
  ubigeo: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; departamento: true; provincia: true; distrito: true };
    }) => Promise<UbigeoSeleccionado | null>;
  };
};

/**
 * Valida contra el catálogo un ubigeo enviado por el navegador. El id llega en
 * un formulario, así que no se confía en él: si no existe, se trata como si no
 * se hubiera elegido ninguno — nunca se persiste el id crudo, porque ese código
 * termina en el XML que se le manda a SUNAT.
 *
 * Recibe el cliente Prisma (o el de una transacción en curso) para poder
 * resolverse dentro de la misma transacción que guarda el maestro.
 */
export async function resolverUbigeoEnTransaccion(
  cliente: ClienteLectura,
  ubigeoId: string | null
): Promise<UbigeoSeleccionado | null> {
  if (!ubigeoId) return null;
  return cliente.ubigeo.findUnique({
    where: { id: ubigeoId },
    select: { id: true, departamento: true, provincia: true, distrito: true },
  });
}

/**
 * Campos de texto que se derivan del ubigeo elegido.
 *
 * Los tres campos de texto libre siguen existiendo porque los documentos
 * impresos y los reportes los leen. Cuando hay ubigeo, mandan sus nombres.
 *
 * Cuando NO hay ubigeo se devuelve un objeto vacío, no tres `null`: en una
 * edición, tres `null` borrarían la dirección que el usuario había escrito a
 * mano antes de que existiera el catálogo. Al omitir las claves, `update` no
 * toca esas columnas.
 */
export function nombresDeUbigeo(
  ubigeo: UbigeoSeleccionado | null
): { departamento?: string; provincia?: string; distrito?: string } {
  if (!ubigeo) return {};
  return {
    departamento: ubigeo.departamento,
    provincia: ubigeo.provincia,
    distrito: ubigeo.distrito,
  };
}
