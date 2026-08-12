export function puedeResolverSolicitud(
  usuarioSolicitanteId: string,
  usuarioResolutorId: string
): boolean {
  return usuarioSolicitanteId !== usuarioResolutorId;
}
