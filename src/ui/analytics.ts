// Anonieme gebruikstelling: stuurt bij elk gestart potje een telletje naar de
// Cloudflare Worker. Geen persoonsgegevens — alleen een willekeurig apparaat-id.

// Vul hier de URL van je gedeployde Worker in (zonder slash op het eind),
// bv. "https://klaverjassen-stats.<jouw-subdomein>.workers.dev".
// Zolang dit leeg is, gebeurt er niets.
const STATS_URL: string = "";

function deviceId(): string {
  try {
    let id = localStorage.getItem("kj-device");
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
            });
      localStorage.setItem("kj-device", id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Tel een gestart potje (fire-and-forget; fouten worden genegeerd). */
export function trackGameStart(): void {
  if (!STATS_URL) return;
  try {
    fetch(`${STATS_URL}/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: deviceId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* stil falen — telling mag het spel nooit verstoren */
  }
}
