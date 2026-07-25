import { randomBytes, scryptSync } from "crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(password, sal, 64).toString("hex")}`;
}

async function main() {
  // ------------------------------------------------------- configuración empresa
  await prisma.configuracionEmpresa.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      razonSocial: "Grasas y Lubricantes del Perú S.A.C.",
      ciudad: "Lima, Perú",
      tasaIgv: 18,
    },
  });

  // ------------------------------------------------------------------ usuarios
  const usuariosSemilla = [
    { usuario: "admin", nombre: "Administrador General", rol: "ADMIN" as const },
    { usuario: "almacen", nombre: "Encargado de Almacén", rol: "ALMACEN" as const },
    { usuario: "operario", nombre: "Operario de Planta", rol: "PRODUCCION" as const },
    { usuario: "ventas", nombre: "Asistente Comercial", rol: "VENTAS" as const },
    { usuario: "gerencia", nombre: "Gerencia General", rol: "GERENCIA" as const },
  ];
  for (const u of usuariosSemilla) {
    await prisma.usuario.upsert({
      where: { empresaId_usuario: { empresaId: "1", usuario: u.usuario } },
      update: {},
      create: { ...u, passwordHash: hashPassword("cambiar123") },
    });
  }
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { empresaId_usuario: { empresaId: "1", usuario: "admin" } },
  });
  const audit = { usuarioId: admin.id, usuarioNombre: admin.nombre };

  // ------------------------------------------------------------------ catálogo
  const grasas = await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Grasas" } },
    update: {},
    create: { nombre: "Grasas", descripcion: "Grasas lubricantes industriales y automotrices" },
  });
  await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Aceites" } },
    update: {},
    create: { nombre: "Aceites", descripcion: "Aceites lubricantes" },
  });
  await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Siliconas" } },
    update: {},
    create: { nombre: "Siliconas", descripcion: "Siliconas y productos afines" },
  });

  const proveedor = await prisma.proveedor.upsert({
    where: { empresaId_ruc: { empresaId: "1", ruc: "20123456789" } },
    update: {},
    create: {
      razonSocial: "Envases y Etiquetas del Perú S.A.C.",
      ruc: "20123456789",
      telefono: "01-2345678",
      email: "ventas@envasesperu.pe",
    },
  });
  const provQuimicos = await prisma.proveedor.upsert({
    where: { empresaId_ruc: { empresaId: "1", ruc: "20456789012" } },
    update: {},
    create: {
      razonSocial: "Química Industrial Andina S.A.",
      ruc: "20456789012",
      telefono: "01-8765432",
      email: "pedidos@quimicandina.pe",
    },
  });

  const grasaChasis = await prisma.producto.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "GR-CHASIS" } },
    update: {},
    create: {
      codigo: "GR-CHASIS",
      nombre: "Grasa Chasis",
      descripcion: "Grasa multipropósito para chasis",
      categoriaId: grasas.id,
    },
  });
  const grasaLitio = await prisma.producto.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "GR-LITIO" } },
    update: {},
    create: {
      codigo: "GR-LITIO",
      nombre: "Grasa de Litio",
      descripcion: "Grasa a base de litio de alto desempeño",
      categoriaId: grasas.id,
    },
  });

  const presentacionesSemilla = [
    { sku: "GR-CHASIS-POTE-1LB", nombre: "Pote 1 lb", productoId: grasaChasis.id, contenidoKg: 0.454, precio: 12.5, stock: 100, stockMinimo: 20 },
    { sku: "GR-CHASIS-BALDE-35LB", nombre: "Balde 35 lb", productoId: grasaChasis.id, contenidoKg: 15.876, precio: 210.0, stock: 15, stockMinimo: 5 },
    { sku: "GR-CHASIS-CIL-400LB", nombre: "Cilindro 400 lb", productoId: grasaChasis.id, contenidoKg: 181.44, precio: 2100.0, stock: 3, stockMinimo: 1 },
    { sku: "GR-LITIO-POTE-1LB", nombre: "Pote 1 lb", productoId: grasaLitio.id, contenidoKg: 0.454, precio: 15.0, stock: 0, stockMinimo: 20 },
  ];
  for (const p of presentacionesSemilla) {
    await prisma.presentacion.upsert({
      where: { empresaId_sku: { empresaId: "1", sku: p.sku } },
      update: {},
      create: p,
    });
  }

  const insumosSemilla = [
    { codigo: "MP-ACEITE-BASE", nombre: "Aceite base mineral 500N", tipo: "MATERIA_PRIMA" as const, unidadMedida: "kg", stock: 2000, stockMinimo: 400, costoUnitario: 6.8, proveedorId: provQuimicos.id },
    { codigo: "MP-LITIO12", nombre: "Jabón de litio 12-hidroxiestearato", tipo: "MATERIA_PRIMA" as const, unidadMedida: "kg", stock: 500, stockMinimo: 100, costoUnitario: 18.3, proveedorId: provQuimicos.id },
    { codigo: "MP-ADITIVO-EP", nombre: "Aditivo extrema presión", tipo: "MATERIA_PRIMA" as const, unidadMedida: "kg", stock: 120, stockMinimo: 30, costoUnitario: 42.0, proveedorId: provQuimicos.id },
    { codigo: "ENV-POTE-1LB", nombre: "Pote plástico 1 lb con tapa", tipo: "ENVASE" as const, unidadMedida: "unidad", stock: 2000, stockMinimo: 500, costoUnitario: 0.85, proveedorId: proveedor.id },
    { codigo: "ENV-BALDE-35LB", nombre: "Balde metálico 35 lb", tipo: "ENVASE" as const, unidadMedida: "unidad", stock: 150, stockMinimo: 40, costoUnitario: 12.5, proveedorId: proveedor.id },
    { codigo: "ETQ-CHASIS", nombre: "Etiqueta Grasa Chasis", tipo: "ETIQUETA" as const, unidadMedida: "unidad", stock: 3000, stockMinimo: 500, costoUnitario: 0.12, proveedorId: proveedor.id },
    { codigo: "ETQ-LITIO", nombre: "Etiqueta Grasa de Litio", tipo: "ETIQUETA" as const, unidadMedida: "unidad", stock: 2500, stockMinimo: 500, costoUnitario: 0.12, proveedorId: proveedor.id },
  ];
  for (const i of insumosSemilla) {
    await prisma.insumo.upsert({
      where: { empresaId_codigo: { empresaId: "1", codigo: i.codigo } },
      update: {},
      create: i,
    });
  }

  // ------------------------------------------------- kardex de stock inicial
  // Solo si el kardex está vacío, para que el historial arranque cuadrado.
  const movimientos = await prisma.movimientoKardex.count();
  if (movimientos === 0) {
    const presentaciones = await prisma.presentacion.findMany();
    for (const p of presentaciones) {
      const stock = p.stock.toNumber();
      if (stock > 0) {
        await prisma.movimientoKardex.create({
          data: {
            tipoItem: "PRESENTACION",
            presentacionId: p.id,
            tipoMovimiento: "ENTRADA",
            origen: "STOCK_INICIAL",
            cantidad: stock,
            saldoAnterior: 0,
            saldoNuevo: stock,
            referencia: "Carga inicial del sistema",
            ...audit,
          },
        });
      }
    }
    const insumos = await prisma.insumo.findMany();
    for (const i of insumos) {
      const stock = i.stock.toNumber();
      if (stock > 0) {
        await prisma.movimientoKardex.create({
          data: {
            tipoItem: "INSUMO",
            insumoId: i.id,
            tipoMovimiento: "ENTRADA",
            origen: "STOCK_INICIAL",
            cantidad: stock,
            saldoAnterior: 0,
            saldoNuevo: stock,
            referencia: "Carga inicial del sistema",
            ...audit,
          },
        });
      }
    }
  }

  // ------------------------------------------------------------------ fórmula
  const formulaExiste = await prisma.formula.findUnique({
    where: { productoId_version: { productoId: grasaChasis.id, version: 1 } },
  });
  if (!formulaExiste) {
    const aceite = await prisma.insumo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId: "1", codigo: "MP-ACEITE-BASE" } } });
    const litio = await prisma.insumo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId: "1", codigo: "MP-LITIO12" } } });
    const aditivo = await prisma.insumo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId: "1", codigo: "MP-ADITIVO-EP" } } });
    await prisma.formula.create({
      data: {
        productoId: grasaChasis.id,
        version: 1,
        rendimientoKg: 100,
        notas: "Fórmula base para batch de 100 kg de granel",
        ...audit,
        detalles: {
          create: [
            { insumoId: aceite.id, cantidad: 88 },
            { insumoId: litio.id, cantidad: 10 },
            { insumoId: aditivo.id, cantidad: 2 },
          ],
        },
      },
    });
  }

  // ------------------------------------------------------------------ comercial
  const zonasSemilla = ["Lima Norte", "Lima Sur", "Provincias"];
  for (const nombre of zonasSemilla) {
    await prisma.zona.upsert({
      where: { empresaId_nombre: { empresaId: "1", nombre } },
      update: {},
      create: { nombre },
    });
  }
  const limaNorte = await prisma.zona.findUniqueOrThrow({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Lima Norte" } },
  });
  const provincias = await prisma.zona.findUniqueOrThrow({
    where: { empresaId_nombre: { empresaId: "1", nombre: "Provincias" } },
  });

  if ((await prisma.vendedor.count()) === 0) {
    await prisma.vendedor.create({
      data: { nombre: "Carlos Huamán", documento: "45678912", tipo: "CON_BASICO", tasaComision: 2.5, zonaId: limaNorte.id },
    });
    await prisma.vendedor.create({
      data: { nombre: "María Quispe", documento: "41234567", tipo: "SOLO_COMISION", tasaComision: 5.0, zonaId: provincias.id },
    });
  }

  const clientesSemilla = [
    { codigo: "CLI-00001", razonSocial: "Lubricentro El Rápido E.I.R.L.", ruc: "20567890123", zonaId: limaNorte.id, direccion: "Av. Túpac Amaru 1520, Comas", telefono: "987654321" },
    { codigo: "CLI-00002", razonSocial: "Distribuidora Ferretera del Norte S.A.C.", ruc: "20678901234", zonaId: provincias.id, direccion: "Jr. Comercio 345, Trujillo", telefono: "944556677" },
  ];
  for (const c of clientesSemilla) {
    await prisma.cliente.upsert({
      where: { empresaId_ruc: { empresaId: "1", ruc: c.ruc } },
      update: {},
      create: c,
    });
  }

  // ------------------------------------------------------------ System Setup (fase 2)

  // Unidades de medida
  const claseP = await prisma.claseUnidadMedida.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "PESO" } },
    update: {},
    create: { codigo: "PESO", nombre: "Peso" },
  });
  const claseV = await prisma.claseUnidadMedida.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "VOLUMEN" } },
    update: {},
    create: { codigo: "VOLUMEN", nombre: "Volumen" },
  });
  const claseC = await prisma.claseUnidadMedida.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "CANTIDAD" } },
    update: {},
    create: { codigo: "CANTIDAD", nombre: "Cantidad" },
  });
  const unidadesSemilla = [
    { claseId: claseP.id, codigo: "kg", nombre: "Kilogramo" },
    { claseId: claseV.id, codigo: "litro", nombre: "Litro" },
    { claseId: claseV.id, codigo: "galon", nombre: "Galón" },
    { claseId: claseC.id, codigo: "unidad", nombre: "Unidad" },
  ];
  for (const u of unidadesSemilla) {
    await prisma.unidadMedida.upsert({
      where: { claseId_codigo: { claseId: u.claseId, codigo: u.codigo } },
      update: {},
      create: u,
    });
  }

  // Almacén y zonas
  const planta = await prisma.almacen.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "PLANTA" } },
    update: {},
    create: { codigo: "PLANTA", nombre: "Planta de producción" },
  });
  const zonasSemillaAlmacen = [
    { almacenId: planta.id, codigo: "A-01", nombre: "Producto terminado" },
    { almacenId: planta.id, codigo: "MP-01", nombre: "Materia prima" },
    { almacenId: planta.id, codigo: "ENV-01", nombre: "Envases y etiquetas" },
  ];
  for (const z of zonasSemillaAlmacen) {
    await prisma.zonaAlmacen.upsert({
      where: { almacenId_codigo: { almacenId: z.almacenId, codigo: z.codigo } },
      update: {},
      create: z,
    });
  }

  // Series de documentos
  const seriesSemilla = [
    { tipoDocumento: "FACTURA" as const, serie: "F001" },
    { tipoDocumento: "NOTA_CREDITO" as const, serie: "FC01" },
    { tipoDocumento: "GUIA_REMISION" as const, serie: "T001" },
  ];
  for (const s of seriesSemilla) {
    await prisma.serieDocumento.upsert({
      where: { empresaId_tipoDocumento_serie: { empresaId: "1", tipoDocumento: s.tipoDocumento, serie: s.serie } },
      update: {},
      create: s,
    });
  }

  // Grupos de seguridad predefinidos (referencia; el acceso real lo sigue
  // controlando el rol del usuario, ver src/lib/auth.ts)
  const permisosPredefinidos: Record<string, Record<string, [boolean, boolean, boolean]>> = {
    ADMIN: {
      ventas: [true, true, true],
      materiales: [true, true, true],
      produccion: [true, true, true],
      finanzas: [true, true, true],
      configuracion: [true, true, true],
    },
    ALMACEN: {
      ventas: [true, false, false],
      materiales: [true, true, true],
      produccion: [true, false, false],
      finanzas: [true, true, false],
      configuracion: [false, false, false],
    },
    PRODUCCION: {
      ventas: [false, false, false],
      materiales: [true, false, false],
      produccion: [true, true, true],
      finanzas: [false, false, false],
      configuracion: [false, false, false],
    },
    VENTAS: {
      ventas: [true, true, true],
      materiales: [true, false, false],
      produccion: [false, false, false],
      finanzas: [true, true, false],
      configuracion: [false, false, false],
    },
    GERENCIA: {
      ventas: [true, false, false],
      materiales: [true, false, false],
      produccion: [true, false, false],
      finanzas: [true, false, true],
      configuracion: [false, false, false],
    },
  };
  const nombreGrupo: Record<string, string> = {
    ADMIN: "Administrador",
    ALMACEN: "Almacén",
    PRODUCCION: "Producción",
    VENTAS: "Ventas",
    GERENCIA: "Gerencia",
  };
  for (const [codigo, permisos] of Object.entries(permisosPredefinidos)) {
    const grupo = await prisma.grupoSeguridad.upsert({
      where: { empresaId_codigo: { empresaId: "1", codigo } },
      update: {},
      create: { codigo, nombre: nombreGrupo[codigo], esPredefinido: true },
    });
    for (const [modulo, [puedeVer, puedeCrear, puedeEditar]] of Object.entries(permisos)) {
      await prisma.permisoGrupo.upsert({
        where: { grupoId_modulo: { grupoId: grupo.id, modulo } },
        update: {},
        create: { grupoId: grupo.id, modulo, puedeVer, puedeCrear, puedeEditar },
      });
    }
  }

  // Calendario fiscal del año en curso
  const anioActual = new Date().getFullYear();
  for (let mes = 1; mes <= 12; mes++) {
    await prisma.periodoFiscal.upsert({
      where: { empresaId_anio_mes: { empresaId: "1", anio: anioActual, mes } },
      update: {},
      create: { anio: anioActual, mes },
    });
  }

  // -------------------------------------------------------- Contabilidad (fase 3)

  const plan = await prisma.planCuentas.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "PCGE" } },
    update: {},
    create: { codigo: "PCGE", nombre: "Plan Contable General Empresarial", esMaestro: true },
  });

  // Plan de cuentas mínimo viable para una fábrica (codificación PCGE)
  const cuentasSemilla: { codigo: string; nombre: string; tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" }[] = [
    { codigo: "1041", nombre: "Caja y bancos — cuentas corrientes", tipo: "ACTIVO" },
    { codigo: "1212", nombre: "Cuentas por cobrar comerciales — terceros", tipo: "ACTIVO" },
    { codigo: "2411", nombre: "Materias primas", tipo: "ACTIVO" },
    { codigo: "2111", nombre: "Productos terminados", tipo: "ACTIVO" },
    { codigo: "4011", nombre: "IGV por pagar", tipo: "PASIVO" },
    { codigo: "4212", nombre: "Cuentas por pagar comerciales — terceros", tipo: "PASIVO" },
    { codigo: "5011", nombre: "Capital social", tipo: "PATRIMONIO" },
    { codigo: "7011", nombre: "Ventas de productos terminados", tipo: "INGRESO" },
    { codigo: "7411", nombre: "Devoluciones y descuentos concedidos", tipo: "GASTO" },
    { codigo: "6911", nombre: "Costo de ventas — productos terminados", tipo: "GASTO" },
    { codigo: "6311", nombre: "Gastos de servicios — operativos", tipo: "GASTO" },
  ];
  const cuentaPorCodigo = new Map<string, string>();
  for (const c of cuentasSemilla) {
    const cuenta = await prisma.cuentaContable.upsert({
      where: { planCuentasId_codigo: { planCuentasId: plan.id, codigo: c.codigo } },
      update: {},
      create: { planCuentasId: plan.id, ...c },
    });
    cuentaPorCodigo.set(c.codigo, cuenta.id);
  }

  await prisma.libro.upsert({
    where: { empresaId_codigo: { empresaId: "1", codigo: "DIARIO" } },
    update: {},
    create: { codigo: "DIARIO", nombre: "Libro diario" },
  });

  // Controles contables: qué cuenta usa cada asiento automático
  const controlesSemilla: [string, string][] = [
    ["CUENTAS_POR_COBRAR", "1212"],
    ["VENTAS", "7011"],
    ["IGV_POR_PAGAR", "4011"],
    ["COSTO_VENTAS", "6911"],
    ["INVENTARIO_PT", "2111"],
    ["INVENTARIO_INSUMOS", "2411"],
    ["CAJA_BANCOS", "1041"],
    ["CUENTAS_POR_PAGAR", "4212"],
    ["DEVOLUCIONES", "7411"],
  ];
  for (const [clave, codigo] of controlesSemilla) {
    const cuentaId = cuentaPorCodigo.get(codigo)!;
    await prisma.controlContable.upsert({
      where: { empresaId_clave: { empresaId: "1", clave } },
      update: {},
      create: { clave, cuentaId },
    });
  }

  console.log(
    "Seed completo. Usuarios: admin / almacen / operario / ventas / gerencia (clave: cambiar123)"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
