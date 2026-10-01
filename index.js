import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Square, Copy, Check, RefreshCw, Plus, Sparkles } from "lucide-react";

const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
const IDEAS = ["Jelaskan cara kerja blockchain dengan sederhana", "Buatkan caption Instagram untuk jualan kopi", "Tulis fungsi JavaScript untuk menghitung diskon"];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [copied, setCopied] = useState(-1);
  const [ready, setReady] = useState(false);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("groqchat_v1") || "{}");
      if (Array.isArray(s.messages)) setMessages(s.messages);
      if (MODELS.includes(s.model)) setModel(s.model);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("groqchat_v1", JSON.stringify({ messages, model })); } catch {}
  }, [messages, model, ready]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  async function ask(history) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ model, messages: history }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.message || "Permintaan gagal");
      setMessages([...history, { role: "assistant", content: d.reply || "(jawaban kosong)" }]);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function send(text) {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    const history = [...messages, { role: "user", content: t }];
    setMessages(history);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    ask(history);
  }

  function regenerate() {
    if (loading || !messages.length) return;
    const last = messages[messages.length - 1];
    const history = last.role === "assistant" ? messages.slice(0, -1) : messages;
    setMessages(history);
    ask(history);
  }

  async function copy(i, text) {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(t);
    }
    setCopied(i);
    setTimeout(() => setCopied(-1), 1400);
  }

  const lastIsAI = messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <>
      <Head>
        <title>AI Chat - Powered by Groq</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b0d12" />
      </Head>

      <div className="app">
        <header>
          <div className="brand"><span className="logo"><Sparkles size={16} /></span> AI Chat</div>
          <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="icon" onClick={() => { if (!loading) { setMessages([]); setError(""); } }} aria-label="Chat baru" title="Chat baru"><Plus size={19} /></button>
        </header>

        <main>
          <div className="wrap">
            {messages.length === 0 && !loading && (
              <div className="empty">
                <span className="logo big"><Sparkles size={26} /></span>
                <h1>Mau ngobrol apa hari ini?</h1>
                <p>Ditenagai Groq. Pilih ide di bawah atau tulis sendiri.</p>
                <div className="ideas">{IDEAS.map((t) => <button key={t} onClick={() => send(t)}>{t}</button>)}</div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="row right" key={i}><div className="bubble user">{m.content}</div></div>
              ) : (
                <div className="row" key={i}>
                  <div className="ai">
                    <div className="bubble md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                    <button className="mini" onClick={() => copy(i, m.content)}>
                      {copied === i ? <Check size={14} /> : <Copy size={14} />} {copied === i ? "Tersalin" : "Copy"}
                    </button>
                  </div>
                </div>
              )
            )}

            {loading && <div className="row"><div className="bubble dots" aria-label="AI sedang mengetik"><span /><span /><span /></div></div>}
            {error && <div className="err">{error}{messages.length > 0 && !loading && <button onClick={regenerate}>Coba lagi</button>}</div>}
            {lastIsAI && !loading && <button className="regen" onClick={regenerate}><RefreshCw size={14} /> Regenerate</button>}
            <div ref={endRef} />
          </div>
        </main>

        <footer>
          <div className="box">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              placeholder="Tulis pesan... (Enter kirim, Shift+Enter baris baru)"
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            />
            {loading
              ? <button className="send stop" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square size={16} fill="currentColor" /></button>
              : <button className="send" onClick={() => send()} disabled={!input.trim()} aria-label="Kirim"><Send size={18} /></button>}
          </div>
        </footer>
      </div>

      <style jsx global>{`
        :root { color-scheme: dark; --bg:#0b0d12; --sf:#12151c; --ln:#262b38; --tx:#eceef5; --mu:#8d94aa; --ac:#f97316; }
        * { box-sizing: border-box; }
        html, body, #__next { height: 100%; margin: 0; }
        body { background: var(--bg); color: var(--tx); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
        button, select, textarea { font: inherit; color: inherit; }
        .app { height: 100dvh; display: flex; flex-direction: column; }
        header { display: flex; align-items: center; gap: .6rem; padding: .65rem .85rem; border-bottom: 1px solid var(--ln); padding-top: max(.65rem, env(safe-area-inset-top)); }
        .brand { display: flex; align-items: center; gap: .5rem; font-weight: 800; flex: 1; letter-spacing: -.01em; }
        .logo { width: 28px; height: 28px; border-radius: 9px; background: var(--ac); color: #fff; display: grid; place-items: center; }
        .logo.big { width: 52px; height: 52px; border-radius: 16px; margin: 0 auto; }
        header select { max-width: 52%; background: var(--sf); border: 1px solid var(--ln); border-radius: 10px; padding: .45rem .5rem; font-size: .8rem; }
        .icon { background: var(--sf); border: 1px solid var(--ln); border-radius: 10px; width: 36px; height: 36px; display: grid; place-items: center; cursor: pointer; }
        main { flex: 1; min-height: 0; overflow-y: auto; }
        .wrap { max-width: 760px; margin: 0 auto; padding: 1rem .9rem; }
        .empty { text-align: center; margin-top: 12vh; }
        .empty h1 { font-size: 1.6rem; margin: 1rem 0 .3rem; letter-spacing: -.02em; }
        .empty p { color: var(--mu); margin: 0 0 1.2rem; }
        .ideas { display: grid; gap: .5rem; }
        .ideas button { background: var(--sf); border: 1px solid var(--ln); border-radius: 12px; padding: .75rem .9rem; text-align: left; cursor: pointer; }
        .ideas button:hover { border-color: var(--ac); }
        .row { display: flex; margin: .9rem 0; }
        .row.right { justify-content: flex-end; }
        .bubble { padding: .65rem .95rem; border-radius: 18px; max-width: 100%; overflow-wrap: anywhere; line-height: 1.6; }
        .bubble.user { background: var(--ac); color: #fff; max-width: 85%; border-bottom-right-radius: 6px; white-space: pre-wrap; }
        .ai { min-width: 0; max-width: 94%; }
        .ai .bubble { background: var(--sf); border: 1px solid var(--ln); border-bottom-left-radius: 6px; }
        .mini { margin: .35rem 0 0 .2rem; background: none; border: 0; color: var(--mu); display: inline-flex; gap: .3rem; align-items: center; font-size: .78rem; cursor: pointer; padding: .25rem .4rem; border-radius: 8px; }
        .mini:hover { background: var(--sf); }
        .regen { background: none; border: 1px solid var(--ln); color: var(--tx); border-radius: 10px; padding: .4rem .7rem; font-size: .8rem; display: inline-flex; gap: .4rem; align-items: center; cursor: pointer; }
        .err { margin: .9rem 0; padding: .7rem .9rem; border-radius: 12px; background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.4); color: #fca5a5; font-size: .9rem; }
        .err button { background: none; border: 0; color: inherit; text-decoration: underline; cursor: pointer; margin-left: .5rem; }
        .dots { display: flex; gap: 6px; align-items: center; background: var(--sf); border: 1px solid var(--ln); color: var(--mu); }
        .dots span { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .3; animation: bl 1.1s infinite; }
        .dots span:nth-child(2) { animation-delay: .18s; } .dots span:nth-child(3) { animation-delay: .36s; }
        @keyframes bl { 0%,80%,100% { opacity: .25; transform: none; } 40% { opacity: 1; transform: translateY(-3px); } }
        footer { padding: .6rem .8rem calc(.6rem + env(safe-area-inset-bottom)); border-top: 1px solid var(--ln); }
        .box { max-width: 760px; margin: 0 auto; display: flex; gap: .5rem; align-items: flex-end; background: var(--sf); border: 1.5px solid var(--ln); border-radius: 18px; padding: .45rem; }
        .box:focus-within { border-color: var(--ac); }
        textarea { flex: 1; min-height: 40px; max-height: 180px; resize: none; background: transparent; border: 0; outline: none; padding: .55rem .5rem; font-size: 1rem; }
        .send { width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: var(--ac); color: #fff; display: grid; place-items: center; cursor: pointer; }
        .send:disabled { opacity: .4; cursor: default; }
        .send.stop { background: #e5e7eb; color: #111; }
        .md > *:first-child { margin-top: 0; } .md > *:last-child { margin-bottom: 0; }
        .md p { margin: .5em 0; } .md ul { list-style: disc; padding-left: 1.3rem; } .md ol { list-style: decimal; padding-left: 1.3rem; }
        .md h1, .md h2, .md h3 { margin: .9em 0 .4em; line-height: 1.3; } .md h1 { font-size: 1.2rem; } .md h2 { font-size: 1.1rem; } .md h3 { font-size: 1rem; }
        .md a { color: #fb923c; text-decoration: underline; }
        .md code { font-size: .86em; padding: .1em .38em; border-radius: 6px; background: rgba(140,140,160,.22); }
        .md pre { background: rgba(0,0,0,.45); padding: .8rem 1rem; border-radius: 12px; overflow-x: auto; }
        .md pre code { background: none; padding: 0; }
        .md table { display: block; overflow-x: auto; border-collapse: collapse; } .md th, .md td { border: 1px solid var(--ln); padding: .3rem .6rem; }
        .md blockquote { border-left: 3px solid var(--ac); margin: .6em 0; padding-left: .8rem; color: var(--mu); }
        @media (prefers-reduced-motion: reduce) { .dots span { animation: none; opacity: .7; } }
      `}</style>
    </>
  );
}
