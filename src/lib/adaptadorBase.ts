// El adaptador de base de datos, en un solo lugar.
//
// Hasta el 2026-09-15 había cinco copias de la misma línea —`src/lib/prisma.ts`
// y los cuatro sembradores— cada una construyendo su `PrismaBetterSqlite3`. Es
// exactamente la forma del error que ya costó caro una vez: cuando cinco
// lugares repiten cómo se abre la base, basta que uno quede atrás para que un
// proceso escriba donde no debe, y el día de cambiar de motor son cinco
// ediciones que hay que acertar todas.
//
// Ahora el motor se declara acá. Cambiarlo es un import y una línea.
import { PrismaPg } from "@prisma/adapter-pg";
import { urlBaseRequerida } from "./databaseUrl";

/** El adaptador para la URL dada, o la configurada si no se pasa ninguna. */
export function crearAdaptador(url: string = urlBaseRequerida()) {
  return new PrismaPg({ connectionString: url });
}
