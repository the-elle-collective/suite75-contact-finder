import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a sponsorship intelligence analyst for Suite Seventy-Five — an invite-only cultural lounge experience hosted during BET Awards Weekend in Los Angeles (June 26, 2026) by The Suite Spot, produced by The Elle Collective. The event gathers 75 curated guests across entertainment, media, business, and culture. It honors Black Music Month and Juneteenth, rooted in amplifying underrepresented creatives. Confirmed partner: Crown Royal. Tiers: Cultural Curator ($12K, 1 slot), Experience Architect ($5,500, 4 slots), Creative Ally (in-kind).

Given a brand name, use your training knowledge to identify the best 1-3 people to contact for a cultural event sponsorship pitch. Focus on: Head of Partnerships, Brand Partnerships Manager, Experiential Marketing Director, VP of Marketing, Director of Multicultural Marketing, Cultural Marketing Lead, Sponsorships Lead.

Return ONLY raw JSON — no markdown, no backticks, no text before or after:
{
  "brand": "string",
  "website": "string or null",
  "brandSummary": "string",
  "fitScore": 80,
  "fitReason": "string",
  "recommendedTier": "string",
  "contacts": [
    {
      "name": "string or null",
      "title": "string",
      "department": "string",
      "linkedin": "string or null",
      "instagram": "string or null",
      "email": "string or null",
      "emailPattern": "string or null",
      "confidence": "High or Medium or Low",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string"
    }
  ],
  "generalInbox": "string or null",
  "sponsorshipHistory": "string",
  "approachTip": "string",
  "redFlags": "string or null",
  "dataNote": "string"
}`;

const fitColor = (s) => s >= 75 ? "#2db56a" : s >= 50 ? "#e8a020" : "#d94f38";
const confColor = { High: "#2db56a", Medium: "#e8a020", Low: "#b89d8a" };
const SUGGESTED = ["Hennessy", "SheaMoisture", "Cash App", "Amazon Music", "Spotify", "Fenty Beauty", "Patrón", "CIROC"];
const LOAD_MSGS = ["Analyzing brand profile…", "Mapping org structure…", "Identifying decision-makers…", "Building your pitch angle…"];

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(null);
  const inputRef = useRef(null);
  const loadTimer = useRef(null);
  const elapsedTimer = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      const h = sessionStorage.getItem("suite75_history");
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    clearInterval(loadTimer.current);
    clearInterval(elapsedTimer.current);
    setLoading(false);
    setElapsed(0);
  };

  const search = async (brandName) => {
    const q = (brandName || query).trim();
    if (!q || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveTab(0);
    setElapsed(0);

    let msgIdx = 0;
    setLoadMsg(LOAD_MSGS[0]);
    loadTimer.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOAD_MSGS.length;
      setLoadMsg(LOAD_MSGS[msgIdx]);
    }, 2500);

    let secs = 0;
    elapsedTimer.current = setInterval(() => { secs++; setElapsed(secs); }, 1000);

    const controller = new AbortController();
    abortRef.current = controller;
    const killswitch = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Research this brand for a sponsorship pitch: ${q}` }]
        })
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(raw?.error?.message || `Error ${res.status}`);

      const block = raw.content?.find((b) => b.type === "text");
      if (!block?.text) throw new Error("Empty response. Please try again.");

      const text = block.text.replace(/```json|```/g, "").trim();
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("Couldn't parse response. Please try again.");

      const parsed = JSON.parse(text.slice(s, e + 1));
      if (!parsed.brand || !parsed.contacts?.length) throw new Error("Incomplete result. Please try again.");

      setResult(parsed);
      const updated = [
        { brand: q, data: parsed },
        ...history.filter((h) => h.brand.toLowerCase() !== q.toLowerCase())
      ].slice(0, 8);
      setHistory(updated);
      try { sessionStorage.setItem("suite75_history", JSON.stringify(updated)); } catch {}

    } catch (e) {
      if (e.name === "AbortError") {
        setError("Timed out after 30 seconds. Please try again.");
      } else {
        setError(e.message || "Something went wrong. Please try again.");
      }
    } finally {
      clearTimeout(killswitch);
      clearInterval(loadTimer.current);
      clearInterval(elapsedTimer.current);
      setLoading(false);
      setElapsed(0);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const score = result?.fitScore || 0;

  return (
    <div style={{ fontFamily: "'Palatino Linotype', Palatino, Georgia, serif", background: "#0d0a06", minHeight: "100vh", color: "#fdf5ec" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg,#1f1108,#2c1a0e 50%,#1a0d05)", borderBottom: "1px solid rgba(201,169,110,0.18)", padding: "20px 28px 16px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 5, color: "#c9a96e", textTransform: "uppercase", marginBottom: 3 }}>The Suite Spot · Suite Seventy-Five · BET Weekend 2026</div>
            <div style={{ fontSize: 22, fontWeight: "bold", color: "#fdf5ec" }}>Sponsor Contact Finder</div>
            <div style={{ fontSize: 11, color: "#8a6b54", marginTop: 4 }}>Enter a brand — get the right person to pitch, not just the right company.</div>
          </div>
          <div style={{ fontSize: 10, color: "#4a3020", textAlign: "right", lineHeight: 1.8 }}>
            <div style={{ color: "#c9a96e" }}>✓ Crown Royal confirmed</div>
            <div>1 Curator · 4 Architect slots open</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px" }}>

        {/* Search bar */}
        <div style={{ background: "#1a1008", border: "1.5px solid rgba(201,169,110,0.3)", borderRadius: 12, display: "flex", overflow: "hidden", boxShadow: "0 6px 30px rgba(0,0,0,0.5)", marginBottom: 14 }}>
          <div style={{ padding: "13px 14px", color: "#c9a96e", fontSize: 15 }}>◎</div>
          <input ref={inputRef} value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && search()}
            placeholder="Brand name… e.g. Hennessy, Fenty Beauty, Cash App"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fdf5ec", fontSize: 14, fontFamily: "inherit", padding: "13px 4px" }} />
          {loading
            ? <button onClick={cancel} style={{ background: "#3a1a08", color: "#f09060", border: "none", padding: "0 20px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: "bold" }}>CANCEL</button>
            : <button onClick={() => search()} disabled={!query.trim()}
                style={{ background: !query.trim() ? "#1f1208" : "#c9a96e", color: !query.trim() ? "#4a3020" : "#1a0d05", border: "none", padding: "0 24px", fontSize: 12, fontWeight: "bold", cursor: !query.trim() ? "not-allowed" : "pointer", letterSpacing: 1.5, fontFamily: "inherit", transition: "all 0.2s" }}>
                FIND
              </button>
          }
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 26, alignItems: "center" }}>
          {history.length > 0 && <>
            <span style={{ fontSize: 9, color: "#4a3020", letterSpacing: 2, textTransform: "uppercase" }}>Recent:</span>
            {history.slice(0, 5).map((h) => <Chip key={h.brand} label={h.brand} color="#c9a96e" onClick={() => { setQuery(h.brand); setResult(h.data); setActiveTab(0); }} />)}
            <span style={{ color: "#2a1a08", margin: "0 2px" }}>|</span>
          </>}
          <span style={{ fontSize: 9, color: "#4a3020", letterSpacing: 2, textTransform: "uppercase" }}>Try:</span>
          {SUGGESTED.filter((s) => !history.find((h) => h.brand.toLowerCase() === s.toLowerCase())).slice(0, 5).map((s) => (
            <Chip key={s} label={s} color="#5a3520" onClick={() => { setQuery(s); search(s); }} />
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "52px 20px" }}>
            <div style={{ display: "inline-flex", gap: 6, marginBottom: 18 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a96e", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
            </div>
            <div style={{ color: "#c9a96e", fontSize: 14, marginBottom: 6 }}>{loadMsg}</div>
            <div style={{ color: "#4a3020", fontSize: 11, marginBottom: 20 }}>{elapsed}s elapsed · usually under 15s</div>
            <button onClick={cancel} style={{ background: "transparent", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 8, padding: "7px 18px", fontSize: 11, color: "#6b4c35", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <style>{`@keyframes pulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ background: "#1a0808", border: "1px solid #5a1a1a", borderRadius: 10, padding: "14px 18px", color: "#f0a0a0", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <span style={{ lineHeight: 1.6 }}>⚠ {error}</span>
            <button onClick={() => search()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 12px", color: "#f0a0a0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Retry</button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

            {/* Brand card */}
            <div style={{ background: "linear-gradient(145deg,#1c1108,#211408)", border: "1px solid rgba(201,169,110,0.22)", borderRadius: 14, padding: "22px 24px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#c9a96e", letterSpacing: 3, textTransform: "uppercase", marginBottom: 3 }}>Brand Intelligence</div>
                  <div style={{ fontSize: 21, fontWeight: "bold", color: "#fdf5ec", marginBottom: 4 }}>{result.brand}</div>
                  {result.website && <a href={result.website} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#6b4c35", display: "block", marginBottom: 8, textDecoration: "none" }}>↗ {result.website}</a>}
                  <div style={{ fontSize: 12, color: "#c9b8a8", lineHeight: 1.65, maxWidth: 480 }}>{result.brandSummary}</div>
                  {result.recommendedTier && (
                    <div style={{ marginTop: 10, display: "inline-block", background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 10, color: "#c9a96e" }}>
                      Recommended: {result.recommendedTier}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center", paddingTop: 4 }}>
                  <div style={{ fontSize: 9, color: "#4a3020", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Suite Fit</div>
                  <div style={{ width: 70, height: 70, borderRadius: "50%", background: `conic-gradient(${fitColor(score)} ${score * 3.6}deg,#2c1a0e 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#1c1108", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: "bold", color: fitColor(score), lineHeight: 1 }}>{score}</span>
                      <span style={{ fontSize: 8, color: "#4a3020" }}>/100</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <InfoRow color="#c9a96e" label="Why They Fit" text={result.fitReason} />
                {result.sponsorshipHistory && <InfoRow color="#2db56a" label="Sponsorship History" text={result.sponsorshipHistory} />}
                {result.approachTip && <InfoRow color="#5a8fc4" label="Approach Tip" text={result.approachTip} />}
                {result.redFlags && <InfoRow color="#d94f38" label="Heads Up" text={result.redFlags} />}
              </div>
            </div>

            {/* Contacts */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 9, color: "#4a3020", letterSpacing: 3, textTransform: "uppercase" }}>
                {result.contacts.length > 1 ? `${result.contacts.length} Contacts · Ranked by Confidence` : "Best Contact to Pitch"}
              </div>
              {result.contacts.length > 1 && (
                <div style={{ display: "flex", gap: 5 }}>
                  {result.contacts.map((c, i) => (
                    <button key={i} onClick={() => setActiveTab(i)}
                      style={{ background: activeTab === i ? "#c9a96e" : "#1c1108", color: activeTab === i ? "#1a0d05" : "#8a6b54", border: `1px solid ${activeTab === i ? "#c9a96e" : "rgba(201,169,110,0.15)"}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: activeTab === i ? "bold" : "normal" }}>
                      {i === 0 && "★ "}{c.name ? c.name.split(" ")[0] : `#${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {result.contacts.map((c, i) => (
              <div key={i} style={{ display: activeTab === i ? "block" : "none" }}>
                <div style={{ background: "linear-gradient(145deg,#1c1108,#221408)", border: "1px solid rgba(201,169,110,0.28)", borderRadius: 14, padding: "20px 22px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#2c1a0e", border: "2px solid #c9a96e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#c9a96e", fontWeight: "bold", flexShrink: 0 }}>
                        {c.name ? c.name[0].toUpperCase() : "?"}
                      </div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: "bold", color: "#fdf5ec" }}>{c.name || "Role Identified (Name TBD)"}</div>
                        <div style={{ fontSize: 12, color: "#c9a96e", marginTop: 1 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: "#6b4c35" }}>{c.department}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.2)", borderRadius: 20, padding: "4px 10px" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: confColor[c.confidence] || "#b89d8a" }} />
                      <span style={{ fontSize: 10, color: confColor[c.confidence] || "#b89d8a", letterSpacing: 1 }}>{c.confidence} Confidence</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, marginBottom: 14 }}>
                    {c.email && <DetailChip icon="✉" label="Email" value={c.email} copyKey={`e${i}`} copied={copied} onCopy={() => copy(c.email, `e${i}`)} />}
                    {!c.email && c.emailPattern && <DetailChip icon="✉" label="Likely Email Format" value={c.emailPattern} dim copyKey={`ep${i}`} copied={copied} onCopy={() => copy(c.emailPattern, `ep${i}`)} />}
                    {c.linkedin && <DetailChip icon="in" label="LinkedIn" value={c.linkedin} href={c.linkedin} copyKey={`li${i}`} copied={copied} onCopy={() => copy(c.linkedin, `li${i}`)} />}
                    {c.instagram && <DetailChip icon="◈" label="Instagram" value={`@${c.instagram.replace("@", "")}`} copyKey={`ig${i}`} copied={copied} onCopy={() => copy(`@${c.instagram.replace("@", "")}`, `ig${i}`)} />}
                  </div>

                  {!c.email && !c.linkedin && result.generalInbox && i === 0 && (
                    <div style={{ background: "rgba(201,169,110,0.05)", border: "1px dashed rgba(201,169,110,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 9, color: "#c9a96e", letterSpacing: 2, textTransform: "uppercase" }}>General Partnerships Inbox</div>
                        <div style={{ fontSize: 12, color: "#c9b8a8", marginTop: 2 }}>{result.generalInbox}</div>
                      </div>
                      <button onClick={() => copy(result.generalInbox, "inbox")} style={btn}>{copied === "inbox" ? "✓" : "Copy"}</button>
                    </div>
                  )}

                  <div style={{ background: "rgba(201,169,110,0.05)", borderLeft: "3px solid #c9a96e", borderRadius: "0 8px 8px 0", padding: "10px 14px", marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#c9a96e", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Why This Person</div>
                    <div style={{ fontSize: 12, color: "#c9b8a8", lineHeight: 1.65 }}>{c.whyTheyreTheOne}</div>
                  </div>

                  <div style={{ background: "rgba(45,181,106,0.05)", borderLeft: "3px solid #2db56a", borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#2db56a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Pitch Opener</div>
                        <div style={{ fontSize: 12, color: "#a0c8b0", lineHeight: 1.65, fontStyle: "italic" }}>"{c.pitchAngle}"</div>
                      </div>
                      <button onClick={() => copy(c.pitchAngle, `p${i}`)} style={{ ...btn, color: "#2db56a", borderColor: "rgba(45,181,106,0.25)", background: "rgba(45,181,106,0.08)" }}>
                        {copied === `p${i}` ? "✓" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {result.dataNote && (
              <div style={{ background: "#141008", border: "1px solid rgba(201,169,110,0.08)", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 8 }}>
                <span style={{ color: "#4a3020", fontSize: 12, flexShrink: 0 }}>ℹ</span>
                <div style={{ fontSize: 11, color: "#4a3020", lineHeight: 1.5 }}>{result.dataNote}</div>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => { setResult(null); setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{ background: "transparent", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 8, padding: "8px 20px", fontSize: 11, color: "#6b4c35", cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>
                ← Search Another Brand
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && !error && (
          <div style={{ textAlign: "center", padding: "52px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>◎</div>
            <div style={{ fontSize: 13, color: "#3a2510", marginBottom: 4 }}>Type any brand name to find their sponsorship decision-maker</div>
            <div style={{ fontSize: 11, color: "#2a1808" }}>Returns the right contact, role, pitch opener, and fit score for Suite Seventy-Five</div>
          </div>
        )}
      </div>
    </div>
  );
}

const btn = { background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#c9a96e", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 };

function Chip({ label, onClick, color }) {
  return <button onClick={onClick} style={{ background: "#1a1008", border: `1px solid ${color}40`, borderRadius: 20, padding: "3px 11px", fontSize: 11, color, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>;
}
function InfoRow({ color, label, text }) {
  return (
    <div style={{ background: `${color}08`, borderLeft: `3px solid ${color}`, borderRadius: "0 7px 7px 0", padding: "9px 13px" }}>
      <div style={{ fontSize: 9, color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#c9b8a8", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}
function DetailChip({ icon, label, value, href, copyKey, copied, onCopy, dim }) {
  return (
    <div style={{ background: "rgba(201,169,110,0.04)", border: "1px solid rgba(201,169,110,0.12)", borderRadius: 8, padding: "8px 11px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: dim ? "#4a3020" : "#c9a96e", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, color: "#4a3020", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
        {href
          ? <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#c9b8a8", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{value}</a>
          : <div style={{ fontSize: 11, color: dim ? "#5a4030" : "#c9b8a8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: dim ? "italic" : "normal" }}>{value}</div>
        }
      </div>
      <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", color: copied === copyKey ? "#2db56a" : "#4a3020", fontSize: 10, padding: 0, fontFamily: "inherit", flexShrink: 0 }}>
        {copied === copyKey ? "✓" : "Copy"}
      </button>
    </div>
  );
}
