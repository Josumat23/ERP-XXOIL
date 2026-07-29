"use client";

import { useEffect, useRef, useState } from "react";
import GraficoLinea from "@/components/GraficoLinea";
import BarraRanking from "@/components/BarraRanking";

type SnapshotMetricas = {
  timestamp: string;
  cpuPct: number;
  ramPct: number;
  ramUsadaMb: number;
  ramTotalMb: number;
  discoPct: number | null;
  uptimeSeg: number;
  dbOk: boolean;
  dbLatenciaMs: number | null;
};

type EstadoConexion = "conectando" | "conectado" | "reconectando";

const VENTANA_HISTORICO = 20;
const REINTENTO_MS = 2000;

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatoPct(v: number): string {
  return `${v.toFixed(0)}%`;
}

function formatoUptime(seg: number): string {
  const horas = Math.floor(seg / 3600);
  const dias = Math.floor(horas / 24);
  if (dias > 0) return `${dias}d ${horas % 24}h`;
  if (horas > 0) return `${horas}h ${Math.floor((seg % 3600) / 60)}m`;
  return `${Math.floor(seg / 60)}m`;
}

export default function PanelMonitoreo() {
  const [historial, setHistorial] = useState<SnapshotMetricas[]>([]);
  const [estado, setEstado] = useState<EstadoConexion>("conectando");
  const reintentoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelado = false;
    let socket: WebSocket | null = null;

    function conectar() {
      if (cancelado) return;
      const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocolo}//${window.location.host}/api/monitoreo/ws`);

      socket.onopen = () => {
        if (!cancelado) setEstado("conectado");
      };
      socket.onmessage = (evento) => {
        if (cancelado) return;
        try {
          const snapshot: SnapshotMetricas = JSON.parse(evento.data);
          setHistorial((prev) => [...prev.slice(-(VENTANA_HISTORICO - 1)), snapshot]);
        } catch {
          // frame inválido, se ignora
        }
      };
      socket.onclose = () => {
        if (cancelado) return;
        setEstado("reconectando");
        reintentoRef.current = setTimeout(conectar, REINTENTO_MS);
      };
      socket.onerror = () => {
        socket?.close();
      };
    }

    conectar();

    return () => {
      cancelado = true;
      if (reintentoRef.current) clearTimeout(reintentoRef.current);
      socket?.close();
    };
  }, []);

  const actual = historial[historial.length - 1] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            estado === "conectado"
              ? "bg-green-500"
              : estado === "reconectando"
                ? "bg-red-500"
                : "bg-amber-500"
          }`}
        />
        <span className="text-neutral-500">
          {estado === "conectado" ? "Conectado" : estado === "reconectando" ? "Reconectando…" : "Conectando…"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi etiqueta="CPU" valor={actual ? formatoPct(actual.cpuPct) : "—"} alerta={!!actual && actual.cpuPct > 90} />
        <Kpi
          etiqueta="Memoria"
          valor={actual ? formatoPct(actual.ramPct) : "—"}
          detalle={actual ? `${Math.round(actual.ramUsadaMb)} / ${Math.round(actual.ramTotalMb)} MB` : undefined}
          alerta={!!actual && actual.ramPct > 90}
        />
        <Kpi
          etiqueta="Disco"
          valor={actual?.discoPct != null ? formatoPct(actual.discoPct) : "no disponible"}
          alerta={!!actual && actual.discoPct != null && actual.discoPct > 90}
        />
        <Kpi
          etiqueta="Base de datos"
          valor={actual ? (actual.dbOk ? "OK" : "Sin respuesta") : "—"}
          detalle={actual?.dbLatenciaMs != null ? `${actual.dbLatenciaMs.toFixed(0)} ms` : undefined}
          alerta={!!actual && !actual.dbOk}
        />
      </div>

      {actual && (
        <p className="text-xs text-neutral-500">Servidor activo desde hace {formatoUptime(actual.uptimeSeg)}.</p>
      )}

      {historial.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Histórico de CPU</h2>
            <GraficoLinea
              datos={historial.map((s) => ({ etiqueta: horaCorta(s.timestamp), valor: s.cpuPct }))}
              formatoValor={formatoPct}
            />
          </section>
          <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
            <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Histórico de memoria</h2>
            <GraficoLinea
              datos={historial.map((s) => ({ etiqueta: horaCorta(s.timestamp), valor: s.ramPct }))}
              formatoValor={formatoPct}
            />
          </section>
        </div>
      )}

      {actual && (
        <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Uso actual</h2>
          <div className="flex flex-col gap-3">
            <BarraRanking etiqueta="CPU" valor={actual.cpuPct} max={100} formatoValor={formatoPct} />
            <BarraRanking etiqueta="Memoria" valor={actual.ramPct} max={100} formatoValor={formatoPct} />
            {actual.discoPct != null && (
              <BarraRanking etiqueta="Disco" valor={actual.discoPct} max={100} formatoValor={formatoPct} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <p className="text-sm text-neutral-500">{etiqueta}</p>
      <p
        className={`text-xl font-semibold mt-1 ${
          alerta ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {valor}
      </p>
      {detalle && <p className="text-xs text-neutral-400 mt-0.5">{detalle}</p>}
    </div>
  );
}
