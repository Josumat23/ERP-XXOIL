import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuario } from "@/lib/auth";
import { puedeRealizar } from "@/lib/permisos";
import { formatMoneda, formatNumero } from "@/lib/format";
import BotonImprimir from "@/components/BotonImprimir";

const DIAS_VENTANA = 90;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

type Fila = {
  codigo: string;
  nombre: string;
  stock: number;
  costoUnitario: number;
  valor: number;
  salidas: number;
  diasCobertura: number | null;
};

type FilaClasificada = Fila & { clase: "A" | "B" | "C" };

function clasificarAbc(filas: Fila[]): FilaClasificada[] {
  const total = filas.reduce((acc, f) => acc + f.valor, 0);
  let acumulado = 0;
  return filas.map((f) => {
    acumulado += f.valor;
    const pctAcumulado = total > 0 ? acumulado / total : 0;
    const clase = pctAcumulado <= 0.8 ? "A" : pctAcumulado <= 0.95 ? "B" : "C";
    return { ...f, clase };
  });
}

const COLOR_CLASE: Record<"A" | "B" | "C", string> = {
  A: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  B: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  C: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800",
};

function Tabla({ titulo, filas }: { titulo: string; filas: FilaClasificada[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">{titulo}</h2>
      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th className="text-right">Stock</th>
            <th className="text-right">Costo unit.</th>
            <th className="text-right">Valor</th>
            <th className="text-right">Salidas ({DIAS_VENTANA}d)</th>
            <th className="text-right">Cobertura</th>
            <th>Clase</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.codigo}>
              <td className="font-mono text-xs">{f.codigo}</td>
              <td>{f.nombre}</td>
              <td className="text-right">{formatNumero(f.stock, 0)}</td>
              <td className="text-right">{formatMoneda(f.costoUnitario)}</td>
              <td className="text-right font-medium">{formatMoneda(f.valor)}</td>
              <td className="text-right">{formatNumero(f.salidas, 0)}</td>
              <td className="text-right text-neutral-500">
                {f.diasCobertura !== null ? `${formatNumero(f.diasCobertura, 0)} días` : "—"}
              </td>
              <td>
                <span className={`insignia ${COLOR_CLASE[f.clase]}`}>{f.clase}</span>
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-neutral-500 py-6">
                Sin registros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

type DatosRotacionAbc = {
  filasProductos: FilaClasificada[];
  filasInsumos: FilaClasificada[];
};

// Frontera de carga de datos: el instante actual y las consultas Prisma
// viven aquí, no en el cuerpo del Server Component, para que el render
// reciba únicamente resultados ya deterministas.
async function cargarDatosRotacionAbc(): Promise<DatosRotacionAbc> {
  const desde = new Date(Date.now() - DIAS_VENTANA * MS_POR_DIA);

  const [presentaciones, insumos, salidasPresentacion, salidasInsumo] = await Promise.all([
    prisma.presentacion.findMany({ where: { activo: true }, include: { producto: true } }),
    prisma.insumo.findMany({ where: { activo: true } }),
    prisma.movimientoKardex.groupBy({
      by: ["presentacionId"],
      where: { tipoItem: "PRESENTACION", tipoMovimiento: "SALIDA", fecha: { gte: desde } },
      _sum: { cantidad: true },
    }),
    prisma.movimientoKardex.groupBy({
      by: ["insumoId"],
      where: { tipoItem: "INSUMO", tipoMovimiento: "SALIDA", fecha: { gte: desde } },
      _sum: { cantidad: true },
    }),
  ]);

  const salidasPresMap = new Map(salidasPresentacion.map((s) => [s.presentacionId, s._sum.cantidad?.toNumber() ?? 0]));
  const salidasInsMap = new Map(salidasInsumo.map((s) => [s.insumoId, s._sum.cantidad?.toNumber() ?? 0]));

  function calcularFila(codigo: string, nombre: string, stock: number, costoUnitario: number, salidas: number): Fila {
    const valor = stock * costoUnitario;
    const promedioDiario = salidas / DIAS_VENTANA;
    const diasCobertura = promedioDiario > 0 ? stock / promedioDiario : null;
    return { codigo, nombre, stock, costoUnitario, valor, salidas, diasCobertura };
  }

  const filasProductos = clasificarAbc(
    presentaciones
      .map((p) =>
        calcularFila(
          p.sku,
          `${p.producto.nombre} — ${p.nombre}`,
          p.stock.toNumber(),
          p.costoPromedio.toNumber(),
          salidasPresMap.get(p.id) ?? 0
        )
      )
      .sort((a, b) => b.valor - a.valor)
  );

  const filasInsumos = clasificarAbc(
    insumos
      .map((i) => calcularFila(i.codigo, i.nombre, i.stock.toNumber(), i.costoUnitario.toNumber(), salidasInsMap.get(i.id) ?? 0))
      .sort((a, b) => b.valor - a.valor)
  );

  return { filasProductos, filasInsumos };
}

export default async function RotacionAbcPage() {
  const usuario = await obtenerUsuario();
  if (!usuario || !(await puedeRealizar(usuario, "materiales", "ver"))) redirect("/");

  const { filasProductos, filasInsumos } = await cargarDatosRotacionAbc();

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Rotación de inventario y clasificación ABC
        </h1>
        <BotonImprimir />
      </div>
      <p className="text-neutral-500 mt-1">
        Clasificación de Pareto por valor de inventario (A = 80% del valor, B = siguiente 15%, C =
        último 5%) y salidas de los últimos {DIAS_VENTANA} días — quién realmente rota y quién solo
        ocupa espacio y capital.
      </p>

      <Tabla titulo="Productos terminados (presentaciones)" filas={filasProductos} />
      <Tabla titulo="Materias primas e insumos" filas={filasInsumos} />
    </div>
  );
}
