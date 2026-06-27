// Cloudflare Worker: telt gespeelde potjes + unieke apparaten (anoniem).
// - POST /hit   { device: "<uuid>" }  -> telt een potje; nieuw device = unieke +1
// - GET  /stats                        -> { games, devices } (JSON)
// - GET  /                             -> mini-dashboard (HTML)
//
// Opslag in KV-namespace gebonden als `STATS`.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const num = (v) => parseInt(v ?? "0", 10) || 0;

async function readStats(env) {
  const [games, devices] = await Promise.all([env.STATS.get("games"), env.STATS.get("devices")]);
  return { games: num(games), devices: num(devices) };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method === "POST" && url.pathname === "/hit") {
      let device = "";
      try {
        const body = await request.json();
        if (body && typeof body.device === "string") device = body.device.slice(0, 64);
      } catch {
        /* lege/ongeldige body is ok */
      }

      let games = num(await env.STATS.get("games")) + 1;
      await env.STATS.put("games", String(games));

      let devices = num(await env.STATS.get("devices"));
      if (device) {
        const seen = await env.STATS.get("dev:" + device);
        if (!seen) {
          await env.STATS.put("dev:" + device, "1");
          devices += 1;
          await env.STATS.put("devices", String(devices));
        }
      }

      return new Response(JSON.stringify({ games, devices }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (url.pathname === "/stats") {
      return new Response(JSON.stringify(await readStats(env)), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Mini-dashboard
    const { games, devices } = await readStats(env);
    const html = `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Klaverjassen — statistieken</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f1713;color:#e8efe9;margin:0;
       min-height:100vh;display:flex;align-items:center;justify-content:center}
  .wrap{text-align:center}
  h1{font-size:1.1rem;font-weight:600;color:#9fb3a6;margin-bottom:28px}
  .stat{margin:18px 0}
  .n{font-size:3.4rem;font-weight:800;color:#ffd24a;line-height:1}
  .l{color:#cfe0d5;font-size:.95rem}
</style></head><body><div class="wrap">
  <h1>🃏 Klaverjassen oefenen — statistieken</h1>
  <div class="stat"><div class="n">${games}</div><div class="l">potjes gespeeld</div></div>
  <div class="stat"><div class="n">${devices}</div><div class="l">unieke apparaten</div></div>
</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } });
  },
};
