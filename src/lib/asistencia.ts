export function minutosHora(valor: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(valor)) return null;
  const [hora, minuto] = valor.split(":").map(Number);
  return hora >= 0 && hora < 24 && minuto >= 0 && minuto < 60 ? hora * 60 + minuto : null;
}

export function calcularJornada(entrada: Date, salida: Date, turno: { inicioMinuto: number; finMinuto: number; refrigerioMinuto: number; toleranciaMinuto: number }) {
  if (salida <= entrada) return null;
  const minutosPresencia = Math.floor((salida.getTime() - entrada.getTime()) / 60000);
  if (minutosPresencia > 18 * 60) return null;
  const minutosTrabajados = Math.max(0, minutosPresencia - turno.refrigerioMinuto);
  const entradaMinuto = entrada.getHours() * 60 + entrada.getMinutes();
  const duracionTurno = turno.finMinuto > turno.inicioMinuto
    ? turno.finMinuto - turno.inicioMinuto
    : 1440 - turno.inicioMinuto + turno.finMinuto;
  const jornadaPlan = Math.max(0, duracionTurno - turno.refrigerioMinuto);
  return { minutosTrabajados, minutosTardanza: Math.max(0, entradaMinuto - turno.inicioMinuto - turno.toleranciaMinuto), minutosSobretiempo: Math.max(0, minutosTrabajados - jornadaPlan) };
}
