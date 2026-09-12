import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { obtenerEmpresaActivaId } from "@/lib/empresas";
import {
  DIAS_NIVEL_2_POR_DEFECTO,
  DIAS_NIVEL_3_POR_DEFECTO,
} from "@/lib/escalamientoCobranza";
import PoliticaFormulario from "./PoliticaFormulario";
import { apagarPoliticaCobranza } from "./actions";

export default async function PoliticaCobranzaPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || usuario.rol !== "ADMIN" || !(await puedeRealizar(usuario, "configuracion", "ver"))) {
    redirect("/");
  }

  const empresaId = await obtenerEmpresaActivaId();
  const politica = await prisma.politicaCobranza.findUnique({ where: { empresaId } });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--epicor-texto)" }}>
        Política de escalamiento de cobranza
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: "var(--epicor-texto-tenue)" }}>
        Define cuándo corresponde subir de nivel con un cliente moroso. Mientras no exista una
        política, <Link href="/finanzas/cobranza" className="text-[var(--epicor-azul)] hover:underline">Gestión
        de cobranza</Link> funciona como siempre: sugiere el nivel por antigüedad y lo decide una
        persona.
      </p>

      <div className="mb-6 rounded-md border border-[var(--epicor-borde)] bg-[var(--epicor-panel)] p-4 text-sm">
        <p className="font-medium text-[var(--epicor-texto)]">El sistema no emite el aviso solo.</p>
        <p className="mt-1" style={{ color: "var(--epicor-texto-tenue)" }}>
          Registrar un aviso deja constancia de que alguien contactó al cliente, y esa llamada la
          hace una persona. Lo que esta política hace es <strong>decir qué corresponde hoy y por
          qué</strong>, en la columna «Acción debida» de la pantalla de cobranza. Ningún cliente
          queda bloqueado automáticamente.
        </p>
      </div>

      {politica ? (
        <p className="mb-4 text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
          Última modificación: {politica.actualizadoPorNombre} ·{" "}
          {politica.actualizadoEn.toLocaleDateString("es-PE")}
        </p>
      ) : (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          Todavía no hay política definida: el escalamiento está apagado. Los valores de abajo son
          los umbrales que el sistema ya venía usando para sugerir el nivel.
        </p>
      )}

      <PoliticaFormulario
        valores={{
          diasNivel2: politica?.diasNivel2 ?? DIAS_NIVEL_2_POR_DEFECTO,
          diasNivel3: politica?.diasNivel3 ?? DIAS_NIVEL_3_POR_DEFECTO,
          diasSinRespuesta: politica?.diasSinRespuesta ?? null,
          diasGraciaCompromiso: politica?.diasGraciaCompromiso ?? null,
          pausarEnDisputa: politica?.pausarEnDisputa ?? true,
        }}
      />

      {politica && (
        <form
          action={async () => {
            "use server";
            await apagarPoliticaCobranza();
          }}
          className="mt-6 border-t border-[var(--epicor-borde)] pt-4"
        >
          <button type="submit" className="text-sm text-red-600 hover:underline dark:text-red-400">
            Apagar el escalamiento
          </button>
          <p className="mt-1 text-xs" style={{ color: "var(--epicor-texto-tenue)" }}>
            Borra la política. La cobranza vuelve a sugerir el nivel por antigüedad, sin acción
            debida.
          </p>
        </form>
      )}
    </div>
  );
}
