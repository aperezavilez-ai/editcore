import * as http from "http";
import * as net from "net";

const INJECTED_STYLE = `<style id="ec-sb">
::-webkit-scrollbar{width:6px!important;height:6px!important}
::-webkit-scrollbar-track{background:transparent!important}
::-webkit-scrollbar-thumb{background:rgba(121,121,121,.4)!important;border-radius:3px!important}
::-webkit-scrollbar-thumb:hover{background:rgba(121,121,121,.7)!important}
*{scrollbar-width:thin!important;scrollbar-color:rgba(121,121,121,.4) transparent!important}
</style>`;

/** Proxy servers keyed by target port. */
const servers = new Map<number, { server: http.Server; proxyPort: number }>();

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

function inject(html: string): string {
  if (html.includes("ec-sb")) return html; // already injected
  const idx = html.indexOf("</head>");
  if (idx !== -1) return html.slice(0, idx) + INJECTED_STYLE + html.slice(idx);
  return INJECTED_STYLE + html;
}

async function create(targetPort: number): Promise<number> {
  const proxyPort = await freePort();
  const server = http.createServer((req, res) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url ?? "/",
      method: req.method,
      headers: { ...req.headers, host: `localhost:${targetPort}` },
    };
    const upstream = http.request(options, (upRes) => {
      const ct = upRes.headers["content-type"] ?? "";
      if (ct.includes("text/html")) {
        const chunks: Buffer[] = [];
        upRes.on("data", (c: Buffer) => chunks.push(c));
        upRes.on("end", () => {
          const original = Buffer.concat(chunks).toString("utf8");
          const patched = inject(original);
          const buf = Buffer.from(patched, "utf8");
          const headers = { ...upRes.headers };
          delete headers["content-length"];
          delete headers["transfer-encoding"];
          headers["content-length"] = String(buf.byteLength);
          res.writeHead(upRes.statusCode ?? 200, headers);
          res.end(buf);
        });
      } else {
        res.writeHead(upRes.statusCode ?? 200, upRes.headers);
        upRes.pipe(res);
      }
    });
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream, { end: true });
  });
  server.listen(proxyPort, "127.0.0.1");
  servers.set(targetPort, { server, proxyPort });
  return proxyPort;
}

/** Returns the proxy URL for the given localhost URL, starting a proxy if needed. */
export async function proxied(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    return url; // only proxy local dev servers
  }
  const targetPort = parseInt(parsed.port || "80", 10);
  const existing = servers.get(targetPort);
  const proxyPort = existing ? existing.proxyPort : await create(targetPort);
  parsed.port = String(proxyPort);
  parsed.hostname = "127.0.0.1";
  return parsed.toString();
}

/** Stop all proxies (call on extension deactivate). */
export function disposeAll(): void {
  for (const { server } of servers.values()) {
    server.close();
  }
  servers.clear();
}
