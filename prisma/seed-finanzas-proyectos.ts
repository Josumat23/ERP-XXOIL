// Antes que nada: estos sembradores corren en su propio proceso bajo tsx,
// fuera de Next, así que nadie carga `.env` por ellos.
import "dotenv/config";
import { crearAdaptador } from "../src/lib/adaptadorBase";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  siguienteCodigoProyecto,
  siguienteCodigoOrdenInterna,
  siguienteCodigoConteo,
} from "../src/lib/correlativos";
import { registrarMovimiento } from "../src/lib/inventario";

// ---------------------------------------------------------------------------
// Las otras cuatro pantallas que se podían abrir y no se podían estrenar.
//
// Proyectos de inversión, órdenes internas, conciliación bancaria y conteo
// cíclico estaban en cero. Igual que en el sembrador comercial, lo que hace
// falta no es una fila por tabla sino el CASO que cada pantalla existe para
// mostrar:
//
//   — una orden interna sirve para acumular costos y después LIQUIDARLOS a un
//     centro de costo: hace falta una abierta con costos encima y una ya
//     liquidada, porque son dos pantallas distintas del mismo registro;
//   — un proyecto se mide contra su presupuesto: sin costos reales cargados,
//     la columna «costo real» sale en cero y no se puede ver un sobrecosto;
//   — la conciliación bancaria existe para mostrar lo que NO cuadra: si todo
//     el extracto concilia, la pantalla no enseña nada. Acá quedan dos
//     movimientos sin aplicar a propósito, que es el caso que se revisa;
//   — un conteo cíclico sin diferencias no prueba nada: el conteo de acá
//     encuentra una diferencia y genera su ajuste de kardex, con la misma
//     función que usa la pantalla.
//
// EL CONTEO MUEVE STOCK DE VERDAD. Un conteo con diferencia registra un
// movimiento de ajuste; se usa `registrarMovimiento`, la misma función del
// dominio que llama la acción real, en vez de escribir la fila a mano. Un dato
// de prueba que dejara el conteo sin su ajuste mostraría un inventario que
// ninguna operación real puede producir.
//
// Todo es INVENTADO y para ambiente de prueba: los bancos, los números de
// cuenta, los importes y los conceptos no salen de ningún dato real de XXOIL.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: crearAdaptador() });

const HOY = new Date();
function dia(n: number): Date {
  return new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n);
}

type Actor = { id: string; nombre: string };

async function sembrarOrdenesInternas(
  empresaId: string,
  gerencia: Actor,
  centrosCosto: { id: string; codigo: string }[]
) {
  // Una ABIERTA acumulando costos y una ya LIQUIDADA: son las dos mitades de
  // la misma pantalla, y con una sola no se ve para qué sirve el registro.
  const abierta = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoOrdenInterna(tx, empresaId);
    const orden = await tx.ordenInterna.create({
      data: {
        empresaId,
        codigo,
        descripcion: "Mantenimiento mayor del reactor de saponificación",
        centroCostoId: centrosCosto[0].id,
        presupuesto: 18000,
        estado: "ABIERTA",
        fechaInicio: dia(-30),
        usuarioId: gerencia.id,
        usuarioNombre: gerencia.nombre,
      },
      select: { id: true, codigo: true },
    });
    const costos = [
      { concepto: "Repuestos del agitador", monto: 6480, dias: -24 },
      { concepto: "Servicio técnico externo", monto: 4200, dias: -18 },
      { concepto: "Horas de personal propio", monto: 1950, dias: -9 },
    ];
    for (const c of costos) {
      await tx.ordenInternaCosto.create({
        data: {
          ordenInternaId: orden.id,
          concepto: c.concepto,
          monto: c.monto,
          fecha: dia(c.dias),
          usuarioId: gerencia.id,
          usuarioNombre: gerencia.nombre,
        },
      });
    }
    const total = costos.reduce((acc, c) => acc + c.monto, 0);
    await tx.ordenInterna.update({
      where: { id: orden.id },
      data: { totalAcumulado: total },
    });
    return { ...orden, total };
  });

  const liquidada = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoOrdenInterna(tx, empresaId);
    const orden = await tx.ordenInterna.create({
      data: {
        empresaId,
        codigo,
        descripcion: "Campaña de señalización y pintura de planta",
        centroCostoId: centrosCosto[1 % centrosCosto.length].id,
        presupuesto: 5000,
        estado: "LIQUIDADA",
        fechaInicio: dia(-90),
        fechaLiquidacion: dia(-52),
        usuarioId: gerencia.id,
        usuarioNombre: gerencia.nombre,
      },
      select: { id: true, codigo: true },
    });
    const costos = [
      { concepto: "Pintura epóxica y señalética", monto: 3120, dias: -84 },
      { concepto: "Mano de obra contratada", monto: 2480, dias: -70 },
    ];
    for (const c of costos) {
      await tx.ordenInternaCosto.create({
        data: {
          ordenInternaId: orden.id,
          concepto: c.concepto,
          monto: c.monto,
          fecha: dia(c.dias),
          usuarioId: gerencia.id,
          usuarioNombre: gerencia.nombre,
        },
      });
    }
    const total = costos.reduce((acc, c) => acc + c.monto, 0);
    await tx.ordenInterna.update({ where: { id: orden.id }, data: { totalAcumulado: total } });
    return { ...orden, total };
  });

  // La liquidada se pasó del presupuesto: 5600 contra 5000. Es el caso que la
  // pantalla marca, y con todo por debajo del tope no se vería nunca.
  console.log(
    `[finanzas] Órdenes internas ${abierta.codigo} (abierta, ${abierta.total}) y ${liquidada.codigo} (liquidada, ${liquidada.total} sobre un presupuesto de 5000).`
  );
}

async function sembrarProyecto(
  empresaId: string,
  gerencia: Actor,
  centrosCosto: { id: string; codigo: string }[],
  empleados: { id: string }[]
) {
  const resultado = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoProyecto(tx, empresaId);
    const proyecto = await tx.proyecto.create({
      data: {
        empresaId,
        codigo,
        nombre: "Segunda línea de envasado de grasas",
        descripcion:
          "Ampliación de capacidad: envasadora automática, faja de salida y adecuación eléctrica.",
        centroCostoId: centrosCosto[0].id,
        presupuestoTotal: 240000,
        estado: "EN_PROGRESO",
        fechaInicioPlan: dia(-60),
        fechaFinPlan: dia(120),
        fechaInicioReal: dia(-55),
        responsableId: empleados[0]?.id ?? null,
        usuarioId: gerencia.id,
        usuarioNombre: gerencia.nombre,
      },
      select: { id: true, codigo: true },
    });

    // Una EDT de dos niveles: sin jerarquía, la pantalla de proyectos es una
    // lista de actividades sueltas y no se ve de qué cuelga cada costo.
    const paquetes = [
      { codigo: "1", nombre: "Obra civil y eléctrica", presupuesto: 70000 },
      { codigo: "2", nombre: "Equipos", presupuesto: 140000 },
      { codigo: "3", nombre: "Puesta en marcha", presupuesto: 30000 },
    ];
    const edts: { id: string; codigo: string }[] = [];
    for (const [i, p] of paquetes.entries()) {
      edts.push(
        await tx.edtProyecto.create({
          data: {
            proyectoId: proyecto.id,
            codigo: p.codigo,
            nombre: p.nombre,
            presupuesto: p.presupuesto,
            orden: i,
          },
          select: { id: true, codigo: true },
        })
      );
    }

    const actividades = [
      { edt: 0, codigo: "1.1", nombre: "Adecuación de piso y canaletas", dias: 15, estado: "CERRADO" as const },
      { edt: 0, codigo: "1.2", nombre: "Tablero y acometida eléctrica", dias: 10, estado: "EN_PROGRESO" as const },
      { edt: 1, codigo: "2.1", nombre: "Compra e importación de envasadora", dias: 60, estado: "EN_PROGRESO" as const },
      { edt: 1, codigo: "2.2", nombre: "Montaje mecánico", dias: 20, estado: "PLANIFICADO" as const },
      { edt: 2, codigo: "3.1", nombre: "Pruebas en vacío y capacitación", dias: 12, estado: "PLANIFICADO" as const },
    ];
    let desde = -55;
    for (const a of actividades) {
      await tx.actividadProyecto.create({
        data: {
          edtId: edts[a.edt].id,
          codigo: a.codigo,
          nombre: a.nombre,
          duracionDias: a.dias,
          estado: a.estado,
          fechaInicioPlan: dia(desde),
          fechaFinPlan: dia(desde + a.dias),
        },
      });
      desde += a.dias;
    }

    // Costos reales ya incurridos: es lo que la pantalla compara contra el
    // presupuesto. Sin esto la columna «costo real» sale en cero.
    const costos = [
      { edt: 0, concepto: "Concreto y canaletas", monto: 28400, dias: -48 },
      { edt: 0, concepto: "Tablero eléctrico", monto: 19750, dias: -30 },
      { edt: 1, concepto: "Anticipo 40% envasadora", monto: 56000, dias: -40 },
      { edt: 1, concepto: "Flete y seguro de importación", monto: 8900, dias: -12 },
    ];
    for (const c of costos) {
      await tx.costoProyecto.create({
        data: {
          proyectoId: proyecto.id,
          edtId: edts[c.edt].id,
          concepto: c.concepto,
          monto: c.monto,
          fecha: dia(c.dias),
          usuarioId: gerencia.id,
          usuarioNombre: gerencia.nombre,
        },
      });
    }
    const total = costos.reduce((acc, c) => acc + c.monto, 0);
    return { codigo: proyecto.codigo, total };
  });

  console.log(
    `[finanzas] Proyecto ${resultado.codigo} en progreso: ${resultado.total} de costo real sobre 240000 de presupuesto.`
  );
}

async function sembrarConciliacionBancaria(empresaId: string, gerencia: Actor) {
  // La demo no tenía ninguna cuenta bancaria, y sin cuenta no hay nada que
  // conciliar. Se crea una y se le asignan los pagos por transferencia que ya
  // existían sueltos: es el dato que les faltaba, no un movimiento nuevo.
  const cuenta = await prisma.cuentaBancariaEmpresa.create({
    data: {
      empresaId,
      banco: "Banco de Crédito del Perú",
      moneda: "PEN",
      numeroCuenta: "193-2547896-0-11",
      cci: "00219300254789601138",
      activo: true,
    },
    select: { id: true, banco: true },
  });

  const bancarios = await prisma.movimientoCaja.findMany({
    where: { empresaId, cuentaBancariaId: null, medioPago: { in: ["TRANSFERENCIA", "DEPOSITO"] } },
    orderBy: { fecha: "asc" },
    select: { id: true, fecha: true, tipo: true, concepto: true, monto: true, referencia: true },
  });
  if (bancarios.length === 0) {
    console.log("[finanzas] No hay movimientos de caja por banco: no se siembra la conciliación.");
    return;
  }
  await prisma.movimientoCaja.updateMany({
    where: { id: { in: bancarios.map((m) => m.id) } },
    data: { cuentaBancariaId: cuenta.id },
  });

  // El extracto cubre el mes de los movimientos. Se concilian todos menos los
  // dos últimos, y además se agregan dos líneas que NO están en el libro —una
  // comisión y un ITF—, que es justamente lo que la pantalla sirve para
  // encontrar. Una conciliación donde todo cuadra no enseña nada.
  const aConciliar = bancarios.slice(0, Math.max(1, bancarios.length - 2));
  const fechas = bancarios.map((m) => m.fecha.getTime());
  const desde = new Date(Math.min(...fechas));
  const hasta = new Date(Math.max(...fechas));

  const resumen = await prisma.$transaction(async (tx) => {
    const salidas = bancarios.reduce(
      (acc, m) => acc + (m.tipo === "EGRESO" ? m.monto.toNumber() : -m.monto.toNumber()),
      0
    );
    const comision = 35.4;
    const itf = 1.2;
    const saldoInicial = 50000;
    const conciliacion = await tx.conciliacionBancaria.create({
      data: {
        empresaId,
        cuentaBancariaId: cuenta.id,
        fechaDesde: desde,
        fechaHasta: hasta,
        saldoInicialExtracto: saldoInicial,
        saldoFinalExtracto: Number((saldoInicial - salidas - comision - itf).toFixed(2)),
        estado: "BORRADOR",
        usuarioId: gerencia.id,
        usuarioNombre: gerencia.nombre,
      },
      select: { id: true },
    });

    let aplicadas = 0;
    for (const [i, m] of bancarios.entries()) {
      const extracto = await tx.movimientoExtractoBancario.create({
        data: {
          conciliacionId: conciliacion.id,
          fecha: m.fecha,
          tipo: m.tipo,
          descripcion: m.concepto,
          referencia: m.referencia,
          monto: m.monto,
          huella: `demo-${i}-${m.id}`,
        },
        select: { id: true },
      });
      if (aConciliar.some((x) => x.id === m.id)) {
        await tx.conciliacionBancariaAplicacion.create({
          data: {
            movimientoExtractoId: extracto.id,
            movimientoCajaId: m.id,
            monto: m.monto,
            usuarioId: gerencia.id,
            usuarioNombre: gerencia.nombre,
          },
        });
        aplicadas++;
      }
    }

    // Dos cargos del banco que el libro no tiene: son los que obligan a mirar.
    for (const [i, extra] of [
      { descripcion: "Comisión por mantenimiento de cuenta", monto: comision },
      { descripcion: "ITF del período", monto: itf },
    ].entries()) {
      await tx.movimientoExtractoBancario.create({
        data: {
          conciliacionId: conciliacion.id,
          fecha: hasta,
          tipo: "EGRESO",
          descripcion: extra.descripcion,
          monto: extra.monto,
          huella: `demo-extra-${i}`,
        },
      });
    }

    return { total: bancarios.length + 2, aplicadas };
  });

  console.log(
    `[finanzas] Conciliación en ${cuenta.banco}: ${resumen.total} líneas de extracto, ${resumen.aplicadas} conciliadas, ${resumen.total - resumen.aplicadas} sin aplicar.`
  );
}

async function sembrarConteoCiclico(empresaId: string, almacen: Actor) {
  const presentaciones = await prisma.presentacion.findMany({
    where: { empresaId, activo: true },
    take: 2,
    select: { id: true, nombre: true, stock: true },
    orderBy: { nombre: "asc" },
  });
  const insumos = await prisma.insumo.findMany({
    where: { empresaId, activo: true },
    take: 1,
    select: { id: true, nombre: true, stock: true },
    orderBy: { nombre: "asc" },
  });
  if (presentaciones.length === 0) {
    console.log("[inventario] No hay presentaciones activas: no se siembra el conteo.");
    return;
  }

  // Un conteo donde todo cuadra no prueba nada. Este encuentra una diferencia
  // —dos unidades de menos, que es lo que pasa de verdad— y por eso genera su
  // ajuste de kardex.
  const lineas = [
    { tipoItem: "PRESENTACION" as const, id: presentaciones[0].id, contado: presentaciones[0].stock.toNumber() - 2 },
    ...(presentaciones[1]
      ? [{ tipoItem: "PRESENTACION" as const, id: presentaciones[1].id, contado: presentaciones[1].stock.toNumber() }]
      : []),
    ...(insumos[0]
      ? [{ tipoItem: "INSUMO" as const, id: insumos[0].id, contado: insumos[0].stock.toNumber() }]
      : []),
  ];

  const resultado = await prisma.$transaction(async (tx) => {
    const codigo = await siguienteCodigoConteo(tx, empresaId);
    const conteo = await tx.conteoInventario.create({
      data: {
        empresaId,
        codigo,
        fecha: dia(-2),
        usuarioId: almacen.id,
        usuarioNombre: almacen.nombre,
      },
      select: { id: true, codigo: true },
    });

    let conDiferencia = 0;
    for (const l of [...lineas].sort((a, b) => `${a.tipoItem}:${a.id}`.localeCompare(`${b.tipoItem}:${b.id}`))) {
      // Misma escritura neutra que la acción real: bloquea el saldo antes de
      // calcular la diferencia.
      const cantidadSistema =
        l.tipoItem === "PRESENTACION"
          ? (
              await tx.presentacion.update({
                where: { id: l.id, empresaId },
                data: { stock: { increment: 0 } },
                select: { stock: true },
              })
            ).stock.toNumber()
          : (
              await tx.insumo.update({
                where: { id: l.id, empresaId },
                data: { stock: { increment: 0 } },
                select: { stock: true },
              })
            ).stock.toNumber();
      const diferencia = l.contado - cantidadSistema;

      await tx.conteoInventarioDetalle.create({
        data: {
          conteoId: conteo.id,
          tipoItem: l.tipoItem,
          presentacionId: l.tipoItem === "PRESENTACION" ? l.id : null,
          insumoId: l.tipoItem === "INSUMO" ? l.id : null,
          cantidadSistema,
          cantidadContada: l.contado,
          diferencia,
        },
      });

      if (Math.abs(diferencia) > 1e-9) {
        const mov = await registrarMovimiento(tx, {
          tipoItem: l.tipoItem,
          presentacionId: l.tipoItem === "PRESENTACION" ? l.id : undefined,
          insumoId: l.tipoItem === "INSUMO" ? l.id : undefined,
          tipoMovimiento: diferencia > 0 ? "ENTRADA" : "SALIDA",
          origen: "AJUSTE",
          cantidad: Math.abs(diferencia),
          motivo: `Conteo cíclico ${codigo}`,
          referencia: codigo,
          usuarioId: almacen.id,
          usuarioNombre: almacen.nombre,
          empresaIdEsperada: empresaId,
        });
        if (!mov.ok) throw new Error(mov.error);
        conDiferencia++;
      }
    }
    return { codigo: conteo.codigo, items: lineas.length, conDiferencia };
  });

  console.log(
    `[inventario] Conteo ${resultado.codigo}: ${resultado.items} ítems, ${resultado.conDiferencia} con diferencia y su ajuste de kardex.`
  );
}

async function main() {
  const empresa = await prisma.empresa.findFirstOrThrow({
    where: { esPrincipal: true },
    select: { id: true },
  });
  const empresaId = empresa.id;

  if ((await prisma.ordenInterna.count({ where: { empresaId } })) > 0) {
    console.log("[finanzas] Ya hay órdenes internas sembradas. No se repite.");
    return;
  }

  const porRol = async (rol: "ALMACEN" | "GERENCIA"): Promise<Actor> =>
    prisma.usuario.findFirstOrThrow({
      where: { empresaId, rol, activo: true },
      select: { id: true, nombre: true },
    });
  const [almacen, gerencia] = await Promise.all([porRol("ALMACEN"), porRol("GERENCIA")]);

  const centrosCosto = await prisma.centroCosto.findMany({
    where: { empresaId, activo: true },
    select: { id: true, codigo: true },
    orderBy: { codigo: "asc" },
  });
  if (centrosCosto.length === 0) {
    console.log("[finanzas] No hay centros de costo: no se siembran órdenes internas ni proyectos.");
    return;
  }
  const empleados = await prisma.empleado.findMany({
    where: { empresaId, estado: "ACTIVO" },
    select: { id: true },
    take: 1,
  });

  await sembrarOrdenesInternas(empresaId, gerencia, centrosCosto);
  await sembrarProyecto(empresaId, gerencia, centrosCosto, empleados);
  await sembrarConciliacionBancaria(empresaId, gerencia);
  await sembrarConteoCiclico(empresaId, almacen);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
