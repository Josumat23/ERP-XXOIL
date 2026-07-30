import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { autenticarSolicitudWS } from "./src/lib/monitoreo/auth";
import { agregarCliente, quitarCliente } from "./src/lib/monitoreo/metricas";
import { ejecutarTareasPendientes } from "./src/lib/tareasProgramadas";

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const WS_PATH = "/api/monitoreo/ws";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url ?? "/", true)));
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parse(req.url ?? "/");
    if (pathname !== WS_PATH) {
      // Todo lo demás (HMR en desarrollo) queda a cargo del propio Next.
      app.getUpgradeHandler()(req, socket, head);
      return;
    }

    const auth = await autenticarSolicitudWS(req);
    if (!auth) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws) => {
    agregarCliente(ws);
    ws.on("close", () => quitarCliente(ws));
  });

  server.listen(port, () => {
    console.log(`> Listo en http://${hostname}:${port} (dev=${dev})`);
  });

  // Tareas programadas (equivalente reducido a System Agent): corren una vez
  // al levantar el proceso y luego cada hora. Cada tarea revisa internamente
  // si ya hizo lo que tenía que hacer (idempotente), así que el intervalo
  // solo existe para no perderse el momento (ej. el cambio de mes) mientras
  // el servidor sigue corriendo — nunca duplica un asiento ni un recargo.
  const correrTareas = () => {
    ejecutarTareasPendientes().catch((e) => console.error("Error en tareas programadas:", e));
  };
  correrTareas();
  setInterval(correrTareas, 60 * 60 * 1000);
});
