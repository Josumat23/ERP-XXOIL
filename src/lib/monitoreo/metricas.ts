import { cpus, totalmem, freemem, uptime } from "os";
import { execFile } from "child_process";
import { readFileSync } from "fs";
import type { WebSocket } from "ws";
import { prisma } from "@/lib/prisma";

export type SnapshotMetricas = {
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

const INTERVALO_MS = 2000;

const clientes = new Set<WebSocket>();
let intervalo: ReturnType<typeof setInterval> | null = null;
let ultimoSnapshot: SnapshotMetricas | null = null;
let cpuAnterior = cpus();

function calcularCpuPct(): number {
  const actual = cpus();
  let idleDelta = 0;
  let totalDelta = 0;
  actual.forEach((core, i) => {
    const prev = cpuAnterior[i]?.times ?? core.times;
    const cur = core.times;
    const idle = cur.idle - prev.idle;
    const total = (Object.keys(cur) as (keyof typeof cur)[]).reduce(
      (acc, clave) => acc + (cur[clave] - prev[clave]),
      0
    );
    idleDelta += idle;
    totalDelta += total;
  });
  cpuAnterior = actual;
  return totalDelta > 0 ? Math.max(0, Math.min(100, 100 - (idleDelta / totalDelta) * 100)) : 0;
}

// En Linux (Docker/Codespaces) MemAvailable descuenta el caché reclamable,
// más preciso que freemem(). Si no existe /proc/meminfo (Windows), cae al
// cálculo básico de Node — nunca revienta, solo es menos exacto.
function calcularRam(): { pct: number; usadaMb: number; totalMb: number } {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const total = Number(meminfo.match(/MemTotal:\s+(\d+)/)?.[1]) * 1024;
    const disponible = Number(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1]) * 1024;
    if (total > 0 && disponible >= 0) {
      return {
        pct: ((total - disponible) / total) * 100,
        usadaMb: (total - disponible) / 1e6,
        totalMb: total / 1e6,
      };
    }
  } catch {
    // no es Linux o /proc no está disponible
  }
  const total = totalmem();
  const libre = freemem();
  return { pct: ((total - libre) / total) * 100, usadaMb: (total - libre) / 1e6, totalMb: total / 1e6 };
}

function obtenerDiscoPct(): Promise<number | null> {
  return new Promise((resolve) => {
    execFile("df", ["-Pk", "/"], { timeout: 2000 }, (error, stdout) => {
      if (error) {
        resolve(null); // ej. "df" no existe en Windows — degrada sin romper
        return;
      }
      const linea = stdout.trim().split("\n")[1];
      const pct = linea?.split(/\s+/)[4]?.replace("%", "");
      resolve(pct ? Number(pct) : null);
    });
  });
}

async function verificarSaludDb(): Promise<{ ok: boolean; latenciaMs: number | null }> {
  const inicio = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latenciaMs: performance.now() - inicio };
  } catch {
    return { ok: false, latenciaMs: null };
  }
}

async function tomarSnapshot(): Promise<SnapshotMetricas> {
  const ram = calcularRam();
  const [discoPct, db] = await Promise.all([obtenerDiscoPct(), verificarSaludDb()]);
  return {
    timestamp: new Date().toISOString(),
    cpuPct: calcularCpuPct(),
    ramPct: ram.pct,
    ramUsadaMb: ram.usadaMb,
    ramTotalMb: ram.totalMb,
    discoPct,
    uptimeSeg: uptime(),
    dbOk: db.ok,
    dbLatenciaMs: db.latenciaMs,
  };
}

// El intervalo de transmisión arranca con el primer cliente conectado y se
// detiene con el último — nadie mira, nadie gasta ciclos de CPU/consultas.
export function agregarCliente(ws: WebSocket): void {
  clientes.add(ws);
  if (ultimoSnapshot) ws.send(JSON.stringify(ultimoSnapshot));

  if (!intervalo) {
    intervalo = setInterval(async () => {
      ultimoSnapshot = await tomarSnapshot();
      const payload = JSON.stringify(ultimoSnapshot);
      for (const cliente of clientes) {
        if (cliente.readyState === cliente.OPEN) cliente.send(payload);
      }
    }, INTERVALO_MS);
  }
}

export function quitarCliente(ws: WebSocket): void {
  clientes.delete(ws);
  if (clientes.size === 0 && intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
}
