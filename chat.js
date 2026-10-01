// API route (backend): key Groq tertanam di sini. Jangan upload file ini ke repo PUBLIK.
export const config = { maxDuration: 60 };

const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
const SYSTEM = "Kamu adalah AI asisten yang ramah. Jawab dengan bahasa yang dipakai pengguna.";
const hits = new Map();

// Batas sederhana: 20 permintaan per menit per IP (mencegah key disalahgunakan)
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > 20;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

  const key = process.env.GROQ_API_KEY || "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";
  if (!key) {
    return res.status(500).json({ ok: false, message: "GROQ_API_KEY belum diatur di Vercel (Settings > Environment Variables)." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "x").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ ok: false, message: "Terlalu banyak permintaan. Coba lagi sebentar." });

  try {
    const body = req.body || {};
    const model = MODELS.includes(body.model) ? body.model : MODELS[0];
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
    if (!messages.length) return res.status(400).json({ ok: false, message: "Pesan kosong" });

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM }, ...messages],
        temperature: 0.7,
        max_tokens: 1500,
        stream: false,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      let msg = t;
      try { msg = JSON.parse(t).error.message; } catch {}
      if (r.status === 401) msg = "API key di server tidak valid atau sudah dicabut. Ganti GROQ_API_KEY di Vercel.";
      return res.status(r.status).json({ ok: false, message: msg });
    }

    const data = await r.json();
    return res.status(200).json({ ok: true, reply: data.choices?.[0]?.message?.content ?? "", usage: data.usage });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}
