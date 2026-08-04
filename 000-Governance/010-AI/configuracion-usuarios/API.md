# API — Server actions — configuracion-usuarios

Sin Server Actions nuevas. `page.tsx` (Server Component) agrega una consulta de solo lectura:

- `prisma.sesion.findMany({ orderBy: { creadoEn: "desc" }, select: { usuarioId, creadoEn } })`, reducida en memoria a un `Map<usuarioId, Date>` con la primera (más reciente) aparición de cada usuario.
- Función pura `estadoAcceso(usuarioId, creadoEn): { texto, alerta }` — sin efectos secundarios.
