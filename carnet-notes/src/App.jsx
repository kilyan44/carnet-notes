import { useState, useCallback, useEffect, useRef } from "react";
 
const SUPABASE_URL = "https://bjdnxygflefkbblalzsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZG54eWdmbGVma2JibGFsenNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDE3OTEsImV4cCI6MjA5NjQ3Nzc5MX0.QDWD2CXNCKHF4IkNS3AyDOS8FMr0gNjDs0rDDABCRYw";
 
async function loadFromSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notes?select=*&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  });
  const rows = await res.json();
  if (rows && rows.length > 0 && rows[0].data && rows[0].data.semesters) {
    return rows[0].data;
  }
  return null;
}
 
async function saveToSupabase(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/notes?id=not.is.null`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
}
 
function clamp(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n > 20) return "20";
  if (n < 0) return "0";
  return val;
}
 
function applyCC4Rule(cc1, cc2, cc3, cc4) {
  const toVal = (v) => v !== "" && !isNaN(parseFloat(v)) ? parseFloat(v) : 0;
  const c4 = toVal(cc4);
  const rep = (v) => { const n = toVal(v); return cc4 !== "" && n < c4 ? c4 : n; };
  return [rep(cc1), rep(cc2), rep(cc3), c4];
}
 
function computeSubjectAvg(s) {
  if (![s.cc1, s.cc2, s.cc3, s.cc4].some((v) => v !== "")) return null;
  const [v1, v2, v3, v4] = applyCC4Rule(s.cc1, s.cc2, s.cc3, s.cc4);
  const ws = [
    { v: v1, p: parseFloat(s.p1) }, { v: v2, p: parseFloat(s.p2) },
    { v: v3, p: parseFloat(s.p3) }, { v: v4, p: parseFloat(s.p4) },
  ].filter((x) => !isNaN(x.p) && x.p > 0);
  if (!ws.length) return null;
  const tp = ws.reduce((a, x) => a + x.p, 0);
  return ws.reduce((a, x) => a + x.v * x.p, 0) / tp;
}
 
// Moyenne pondérée par ECTS
function computeSemAvg(subjects) {
  const entries = subjects
    .map((s) => ({ avg: computeSubjectAvg(s), ects: parseFloat(s.ects) || 0 }))
    .filter((x) => x.avg !== null && x.ects > 0);
  if (!entries.length) {
    // fallback sans ECTS
    const avgs = subjects.map((s) => computeSubjectAvg(s)).filter((x) => x !== null);
    if (!avgs.length) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  }
  const totalEcts = entries.reduce((a, x) => a + x.ects, 0);
  return entries.reduce((a, x) => a + x.avg * x.ects, 0) / totalEcts;
}
 
// Total ECTS validés (avg >= 10, ou ADJ avec avg >= 9) pour tous les semestres
function computeTotalEcts(semesters) {
  return semesters.reduce((total, sem) => {
    return total + sem.subjects.reduce((t, s) => {
      const avg = computeSubjectAvg(s);
      const ects = parseFloat(s.ects) || 0;
      const ok = avg !== null && (avg >= 10 || (s.jury && avg >= 9));
      return t + (ok ? ects : 0);
    }, 0);
  }, 0);
}
 
// Total ECTS inscrits (toutes matières avec ECTS renseignés)
function computeTotalEctsInscrit(semesters) {
  return semesters.reduce((total, sem) => {
    return total + sem.subjects.reduce((t, s) => {
      return t + (parseFloat(s.ects) || 0);
    }, 0);
  }, 0);
}
 
function fmt(v) { return v == null ? "—" : v.toFixed(2); }
 
function isValidated(s, avg) {
  if (avg == null) return false;
  if (avg >= 10) return true;
  return !!s.jury && avg >= 9;
}
 
function nc(v) {
  if (v == null) return "#94a3b8";
  if (v >= 14) return "#059669";
  if (v >= 10) return "#2563eb";
  return "#e11d48";
}
 
function nb(v) {
  if (v == null) return { bg: "#f8fafc", border: "#e2e8f0" };
  if (v >= 14) return { bg: "#f0fdf4", border: "#86efac" };
  if (v >= 10) return { bg: "#eff6ff", border: "#93c5fd" };
  return { bg: "#fff1f2", border: "#fda4af" };
}
 
// Programme officiel de la Licence d'Informatique (180 ECTS)
// lane = "couloir" (voie de progression), level = niveau (1 à 4), utilisés pour l'affichage en arbre
const CURRICULUM = [
  // Maths : 4 UE x 6 ECTS = 24
  { id: "math1-al", name: "Math1.AL", category: "Mathématiques", ects: 6, lane: 0, level: 1 },
  { id: "math1-bases2", name: "Math1.Bases2", category: "Mathématiques", ects: 6, lane: 1, level: 1 },
  { id: "math1-calc1", name: "Math1.Calc1", category: "Mathématiques", ects: 6, lane: 2, level: 1 },
  { id: "math2-bases3", name: "Math2.Bases3", category: "Mathématiques", ects: 6, lane: 1, level: 2 },
 
  // Info : 18 UE x 6 ECTS = 108
  { id: "info1-ds1", name: "Info1.DS1", category: "Informatique", ects: 6, lane: 0, level: 1 },
  { id: "info2-ds2", name: "Info2.DS2", category: "Informatique", ects: 6, lane: 0, level: 2 },
  { id: "info3-ds3", name: "Info3.DS3", category: "Informatique", ects: 6, lane: 0, level: 3 },
  { id: "info4-ia", name: "Info4.IA", category: "Informatique", ects: 6, lane: 0, level: 4 },
 
  { id: "info1-algo1", name: "Info1.Algo1", category: "Informatique", ects: 6, lane: 1, level: 1 },
  { id: "info2-algo2", name: "Info2.Algo2", category: "Informatique", ects: 6, lane: 1, level: 2 },
  { id: "info3-algo3", name: "Info3.Algo3", category: "Informatique", ects: 6, lane: 1, level: 3 },
  { id: "info4-projet", name: "Info4.Projet", category: "Informatique", ects: 6, lane: 1, level: 4 },
 
  { id: "info2-ilu1", name: "Info2.ILU1", category: "Informatique", ects: 6, lane: 2, level: 2 },
  { id: "info3-ilu2", name: "Info3.ILU2", category: "Informatique", ects: 6, lane: 2, level: 3 },
  { id: "info4-ilu3", name: "Info4.ILU3", category: "Informatique", ects: 6, lane: 2, level: 4 },
 
  { id: "info2-progc", name: "Info2.progC", category: "Informatique", ects: 6, lane: 3, level: 2 },
  { id: "info3-archi", name: "Info3.Archi", category: "Informatique", ects: 6, lane: 3, level: 3 },
 
  { id: "info1-bas", name: "Info1.BAS", category: "Informatique", ects: 6, lane: 4, level: 1 },
  { id: "info3-sr1", name: "Info3.SR1", category: "Informatique", ects: 6, lane: 4, level: 3 },
  { id: "info4-sr2", name: "Info4.SR2", category: "Informatique", ects: 6, lane: 4, level: 4 },
 
  { id: "info3-bd", name: "Info3.BD", category: "Informatique", ects: 6, lane: 5, level: 3 },
 
  // Synthèse finale (bilan de l'expérience)
  { id: "info5-be", name: "Info5.BE", category: "Informatique", ects: 6, lane: -1, level: 5 },
 
  // Choix Info : 2 UE x 6 ECTS = 12
  { id: "info3-is", name: "Info3.IS", category: "Choix Info", ects: 6, lane: 0, level: 1 },
  { id: "info5-securite", name: "Info5.Sécurité", category: "Choix Info", ects: 6, lane: 1, level: 1 },
  { id: "info5-parallelisme", name: "Info5.Parallélisme", category: "Choix Info", ects: 6, lane: 2, level: 1 },
  { id: "info4-ilu4", name: "Info4.ILU4", category: "Choix Info", ects: 6, lane: 3, level: 1 },
  { id: "info4-ds4", name: "Info4.DS4", category: "Choix Info", ects: 6, lane: 4, level: 1 },
 
  // Langues : 5 UE x 3 ECTS = 15 (chaîne séquentielle)
  { id: "langue1", name: "Langue1", category: "Langues", ects: 3, lane: 0, level: 1 },
  { id: "langue2-1", name: "Langue2.1", category: "Langues", ects: 3, lane: 0, level: 2 },
  { id: "langue2-2", name: "Langue2.2", category: "Langues", ects: 3, lane: 0, level: 3 },
  { id: "langue3-1", name: "Langue3.1", category: "Langues", ects: 3, lane: 0, level: 4 },
  { id: "langue3-2", name: "Langue3.2", category: "Langues", ects: 3, lane: 0, level: 5 },
 
  // DVE : 3 ECTS
  { id: "dve", name: "DVE", category: "Autre", ects: 3, lane: 0, level: 1 },
 
  // Choix libre : 18 ECTS (regroupé)
  { id: "choix-libre", name: "Modules à choix libre", category: "Autre", ects: 18, lane: 1, level: 1 },
];
 
const CURRICULUM_CATEGORIES = ["Mathématiques", "Informatique", "Choix Info", "Langues", "Autre"];
// Cible ECTS par catégorie (si différente de la somme de tous les modules affichés).
// "Choix Info" : 5 options affichées mais seulement 12 ECTS à valider (2 UE sur 5).
const CATEGORY_TARGET = { "Choix Info": 12 };
 
const findCurriculumModule = (id) => CURRICULUM.find((m) => m.id === id);
 
let _nid = 20;
const newId = () => ++_nid;
const newSubject = () => ({ id: newId(), name: "", cc1: "", cc2: "", cc3: "", cc4: "", p1: "25", p2: "25", p3: "25", p4: "25", ects: "3", moduleId: "", jury: false });
const newSemester = (name) => ({ id: newId(), name: name || "", subjects: [newSubject()] });
 
function SubjectCard({ subject, onChange, onDelete }) {
  const [v1, v2, v3, v4] = applyCC4Rule(subject.cc1, subject.cc2, subject.cc3, subject.cc4);
  const isRep = (orig, ap) => orig !== "" && parseFloat(orig) !== ap;
  const avg = computeSubjectAvg(subject);
  const { bg, border } = nb(avg);
  const totalPct = [subject.p1, subject.p2, subject.p3, subject.p4].map(Number).filter((x) => !isNaN(x)).reduce((a, b) => a + b, 0);
  const upd = (key, raw) => {
    const val = ["cc1","cc2","cc3","cc4"].includes(key) ? clamp(raw) : raw;
    onChange({ ...subject, [key]: val });
  };
  const onModuleChange = (moduleId) => {
    const mod = findCurriculumModule(moduleId);
    const updates = { ...subject, moduleId };
    if (mod) {
      if (!subject.name.trim()) updates.name = mod.name;
      updates.ects = String(mod.ects);
    }
    onChange(updates);
  };
  const cols = [
    { k: "cc1", lbl: "CC1", v: subject.cc1, pk: "p1", pv: subject.p1, ap: v1, star: false },
    { k: "cc2", lbl: "CC2", v: subject.cc2, pk: "p2", pv: subject.p2, ap: v2, star: false },
    { k: "cc3", lbl: "CC3", v: subject.cc3, pk: "p3", pv: subject.p3, ap: v3, star: false },
    { k: "cc4", lbl: "CC4", v: subject.cc4, pk: "p4", pv: subject.p4, ap: v4, star: true },
  ];
  return (
    <div style={{ background: "#fff", border: "1.5px solid " + border, borderRadius: 16, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="text" placeholder="Nom de la matière…" value={subject.name}
          onChange={(e) => upd("name", e.target.value)}
          style={{ flex: 1, minWidth: 120, background: "transparent", border: "none", borderBottom: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 500, padding: "4px 2px", outline: "none", color: "#0f172a" }} />
        {/* Lien avec le programme officiel */}
        <select
          value={subject.moduleId || ""}
          onChange={(e) => onModuleChange(e.target.value)}
          style={{ background: subject.moduleId ? "#eef2ff" : "#f8fafc", border: "1.5px solid " + (subject.moduleId ? "#a5b4fc" : "#e2e8f0"), borderRadius: 8, color: subject.moduleId ? "#4f46e5" : "#94a3b8", fontSize: 11, fontWeight: 600, padding: "5px 6px", outline: "none", maxWidth: 130 }}
        >
          <option value="">Lier au programme…</option>
          {CURRICULUM_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {CURRICULUM.filter((m) => m.category === cat).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {/* ECTS input */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 8, padding: "4px 8px" }}>
          <input
            type="number" min={1} max={12} step={1}
            value={subject.ects ?? "3"}
            onChange={(e) => upd("ects", e.target.value)}
            style={{ width: 28, background: "transparent", border: "none", fontSize: 13, fontWeight: 700, color: "#059669", textAlign: "center", outline: "none" }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>ECTS</span>
        </div>
        {/* Validation jury (ADJ) */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, background: subject.jury ? "#fffbeb" : "#f8fafc", border: "1.5px solid " + (subject.jury ? "#fde68a" : "#e2e8f0"), borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: subject.jury ? "#d97706" : "#94a3b8", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={!!subject.jury} onChange={(e) => upd("jury", e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "#d97706", cursor: "pointer" }} />
          ADJ
        </label>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 24, background: nb(avg).bg, color: nc(avg), border: "1px solid " + nb(avg).border }}>{fmt(avg)} / 20</span>
        <button onClick={onDelete} style={{ background: "#fff5f5", border: "1.5px solid #fecdd3", borderRadius: 8, color: "#e11d48", cursor: "pointer", padding: "5px 10px", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {cols.map(function(col) {
          var k = col.k, lbl = col.lbl, v = col.v, pk = col.pk, pv = col.pv, ap = col.ap, star = col.star;
          var replaced = !star && isRep(v, ap);
          return (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center", padding: "10px 4px", background: star ? "#eef2ff" : "#f8fafc", borderRadius: 12, border: "1.5px solid " + (star ? "#c7d2fe" : "#e2e8f0"), minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: star ? "#4f46e5" : "#64748b", whiteSpace: "nowrap" }}>{star ? "★ CC4" : lbl}</p>
              <input type="number" min={0} max={20} step={0.25} value={v}
                onChange={(e) => upd(k, e.target.value)}
                onBlur={(e) => upd(k, clamp(e.target.value))}
                placeholder="—"
                style={{ width: "100%", padding: "6px 2px", border: "1.5px solid " + (replaced ? "#fcd34d" : star ? "#a5b4fc" : "#e2e8f0"), borderRadius: 8, background: replaced ? "#fffbeb" : "#fff", color: replaced ? "#d97706" : "#0f172a", fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input type="number" min={0} max={100} step={1} value={pv}
                  onChange={(e) => upd(pk, e.target.value)}
                  style={{ width: 38, padding: "4px 2px", border: "1.5px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", color: "#64748b", fontSize: 11, fontWeight: 500, textAlign: "center", outline: "none" }} />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>%</span>
              </div>
              {replaced && (
                <span style={{ fontSize: 9, color: "#d97706", fontWeight: 700, background: "#fffbeb", padding: "1px 4px", borderRadius: 4, whiteSpace: "nowrap" }}>
                  {v}→{parseFloat(subject.cc4).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {totalPct !== 100 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#e11d48", fontWeight: 500 }}>⚠ Total des poids : {totalPct}% (doit être 100%)</div>
      )}
    </div>
  );
}
 
function SubjectRowView({ subject }) {
  const avg = computeSubjectAvg(subject);
  const validated = isValidated(subject, avg);
  const adj = subject.jury && avg !== null && avg >= 9 && avg < 10;
  const vc = adj ? "#d97706" : nc(avg);
  const { bg, border } = adj ? { bg: "#fffbeb", border: "#fde68a" } : nb(avg);
  const [v1, v2, v3, v4] = applyCC4Rule(subject.cc1, subject.cc2, subject.cc3, subject.cc4);
  const isRep = (orig, ap) => orig !== "" && parseFloat(orig) !== ap;
  const bar = avg !== null ? (avg / 20) * 100 : 0;
  const ects = parseFloat(subject.ects) || 0;
  const ectsValidated = validated && ects > 0;
  const ccCols = [
    { lbl: "CC1", v: subject.cc1, ap: v1, pv: subject.p1, star: false },
    { lbl: "CC2", v: subject.cc2, ap: v2, pv: subject.p2, star: false },
    { lbl: "CC3", v: subject.cc3, ap: v3, pv: subject.p3, star: false },
    { lbl: "CC4", v: subject.cc4, ap: v4, pv: subject.p4, star: true },
  ];
  return (
    <div style={{ background: "#fff", border: "1.5px solid " + border, borderRadius: 18, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: vc, flexShrink: 0, boxShadow: "0 0 0 3px " + bg }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            {subject.name || <em style={{ color: "#94a3b8", fontWeight: 400 }}>Sans nom</em>}
          </p>
          {/* Badge ECTS */}
          {ects > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: ectsValidated ? "#f0fdf4" : avg === null ? "#f8fafc" : "#fff1f2",
              color: ectsValidated ? "#059669" : avg === null ? "#94a3b8" : "#e11d48",
              border: "1.5px solid " + (ectsValidated ? "#86efac" : avg === null ? "#e2e8f0" : "#fda4af"),
            }}>
              {ectsValidated ? "✓" : avg === null ? "" : "✗"} {ects} ECTS
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <span style={{ fontSize: 34, fontWeight: 800, color: vc, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(avg)}</span>
            <span style={{ fontSize: 14, color: "#94a3b8", marginLeft: 3 }}>/20</span>
          </div>
          <div style={{ padding: "6px 12px", borderRadius: 20, background: bg, border: "1.5px solid " + border, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
            <span style={{ fontSize: 15 }}>{avg === null ? "—" : validated ? (adj ? "⚖️" : "✅") : "❌"}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: vc, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {avg === null ? "—" : adj ? "ADJ" : validated ? "Validé" : "Non validé"}
            </span>
          </div>
        </div>
      </div>
      <div style={{ background: "#f1f5f9", borderRadius: 20, height: 5, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ width: bar + "%", height: "100%", background: "linear-gradient(90deg, " + vc + "88, " + vc + ")", borderRadius: 20, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {ccCols.map(function(col) {
          var lbl = col.lbl, v = col.v, ap = col.ap, pv = col.pv, star = col.star;
          var rep = !star && isRep(v, ap);
          var displayVal = ap != null ? ap.toFixed(2) : "0.00";
          return (
            <div key={lbl} style={{ background: star ? "#eef2ff" : "#f8fafc", borderRadius: 10, padding: "10px 4px", textAlign: "center", border: "1.5px solid " + (star ? "#c7d2fe" : rep ? "#fde68a" : "#e2e8f0"), minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, fontWeight: 700, color: star ? "#4f46e5" : "#64748b", whiteSpace: "nowrap" }}>{star ? "★ CC4" : lbl}</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: rep ? "#d97706" : star ? "#4f46e5" : v === "" ? "#cbd5e1" : "#1e293b", lineHeight: 1 }}>
                {v === "" && !star ? "—" : displayVal}
              </p>
              <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 4 }}>{pv}%</p>
              {rep && (
                <p style={{ fontSize: 9, color: "#d97706", fontWeight: 700, marginTop: 3, background: "#fffbeb", padding: "1px 4px", borderRadius: 4, display: "inline-block", whiteSpace: "nowrap" }}>
                  {v}→{parseFloat(subject.cc4).toFixed(2)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
 
function CurriculumNode({ m, progressMap }) {
  const p = progressMap[m.id];
 
  if (m.id === "choix-libre") {
    const pv = p?.poolValidated || 0;
    const done = pv >= m.ects;
    const started = pv > 0 && !done;
    let bg = "#fff", border = "#e2e8f0", color = "#334155";
    if (done) { bg = "#f0fdf4"; border = "#86efac"; color = "#059669"; }
    else if (started) { bg = "#fffbeb"; border = "#fde68a"; color = "#d97706"; }
    return (
      <div style={{ background: bg, border: "1.5px solid " + border, borderRadius: 12, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3, minWidth: 92, flex: "1 1 92px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{m.name}</span>
          {done && <span style={{ fontSize: 12, color, flexShrink: 0 }}>✓</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{pv} / {m.ects} ECTS</span>
        </div>
      </div>
    );
  }
 
  const done = p?.done;
  const started = p?.started && !done;
  let bg = "#fff", border = "#e2e8f0", color = "#334155", icon = null;
  if (done) { bg = "#f0fdf4"; border = "#86efac"; color = "#059669"; icon = "✓"; }
  else if (started) { bg = "#fff1f2"; border = "#fda4af"; color = "#e11d48"; icon = "✗"; }
  return (
    <div style={{ background: bg, border: "1.5px solid " + border, borderRadius: 12, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3, minWidth: 92, flex: "1 1 92px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{m.name}</span>
        {icon && <span style={{ fontSize: 12, color, flexShrink: 0 }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#94a3b8" }}>{m.ects} ECTS</span>
        {p?.started && <span style={{ fontSize: 10, fontWeight: 700, color }}>{fmt(p.avg)}/20</span>}
      </div>
    </div>
  );
}
 
function CategoryTree({ modules, progressMap }) {
  const levels = [...new Set(modules.map((m) => m.level))].sort((a, b) => a - b);
  // lanes "principales" (>=0) affichées en grille, lane -1 = synthèse finale affichée à part
  const main = modules.filter((m) => m.lane >= 0);
  const finalNodes = modules.filter((m) => m.lane < 0);
  const lanes = [...new Set(main.map((m) => m.lane))].sort((a, b) => a - b);
 
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {levels.filter((lvl) => main.some((m) => m.level === lvl)).map((lvl, idx) => (
          <div key={lvl}>
            {idx > 0 && (
              <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 14, lineHeight: 1, margin: "2px 0" }}>↓</div>
            )}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {lanes.map((lane) => {
                const m = main.find((x) => x.lane === lane && x.level === lvl);
                if (!m) return <div key={lane} style={{ flex: "1 1 92px", minWidth: 92 }} />;
                return <CurriculumNode key={m.id} m={m} progressMap={progressMap} />;
              })}
            </div>
          </div>
        ))}
      </div>
      {finalNodes.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "center" }}>
          {finalNodes.map((m) => (
            <div key={m.id} style={{ maxWidth: 220, width: "100%" }}>
              <CurriculumNode m={m} progressMap={progressMap} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
 
function ProgressionView({ semesters }) {
  // Construit une map moduleId -> { avg, ects, done, started }
  const progressMap = {};
  let choixLibreValidated = 0;
  let choixLibreStarted = false;
  semesters.forEach((sem) => {
    sem.subjects.forEach((s) => {
      if (!s.moduleId) return;
      const avg = computeSubjectAvg(s);
      const done = isValidated(s, avg);
      const started = avg !== null;
      if (s.moduleId === "choix-libre") {
        if (started) choixLibreStarted = true;
        if (done) choixLibreValidated += parseFloat(s.ects) || 0;
        return;
      }
      progressMap[s.moduleId] = { avg, done, started, subjectName: s.name };
    });
  });
  choixLibreValidated = Math.min(choixLibreValidated, 18);
  progressMap["choix-libre"] = {
    avg: null,
    done: choixLibreValidated >= 18,
    started: choixLibreStarted,
    poolValidated: choixLibreValidated,
  };
 
  const totalEcts = CURRICULUM_CATEGORIES.reduce((a, cat) => {
    const modules = CURRICULUM.filter((m) => m.category === cat);
    const sum = modules.reduce((s, m) => s + m.ects, 0);
    return a + (CATEGORY_TARGET[cat] ?? sum);
  }, 0);
  const validatedEcts = CURRICULUM_CATEGORIES.reduce((a, cat) => {
    const modules = CURRICULUM.filter((m) => m.category === cat);
    const done = modules.reduce((s, m) => {
      if (m.id === "choix-libre") return s + (progressMap[m.id]?.poolValidated || 0);
      const p = progressMap[m.id];
      return s + (p && p.done ? m.ects : 0);
    }, 0);
    const target = CATEGORY_TARGET[cat];
    return a + (target != null ? Math.min(done, target) : done);
  }, 0);
 
  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Avancement de la licence</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "#4f46e5" }}>{validatedEcts}</span>
          <span style={{ fontSize: 16, color: "#94a3b8" }}>/ {totalEcts} ECTS</span>
        </div>
        <div style={{ marginTop: 10, background: "#f1f5f9", borderRadius: 20, height: 8, overflow: "hidden" }}>
          <div style={{ width: (validatedEcts / totalEcts) * 100 + "%", height: "100%", background: "linear-gradient(90deg,#34d399,#059669)", borderRadius: 20, transition: "width 0.4s ease" }} />
        </div>
      </div>
 
      {CURRICULUM_CATEGORIES.map((cat) => {
        const modules = CURRICULUM.filter((m) => m.category === cat);
        const sumEcts = modules.reduce((a, m) => a + m.ects, 0);
        const catEcts = CATEGORY_TARGET[cat] ?? sumEcts;
        const catDoneRaw = modules.reduce((a, m) => {
          if (m.id === "choix-libre") return a + (progressMap[m.id]?.poolValidated || 0);
          return a + (progressMap[m.id]?.done ? m.ects : 0);
        }, 0);
        const catDone = Math.min(catDoneRaw, catEcts);
        return (
          <div key={cat} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{cat}</h2>
              <span style={{ fontSize: 12, fontWeight: 700, color: catDone === catEcts ? "#059669" : "#94a3b8" }}>{catDone} / {catEcts} ECTS</span>
            </div>
            {cat === "Choix Info" && (
              <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>2 UE à choisir parmi les 5 (12 ECTS)</p>
            )}
            <CategoryTree modules={modules} progressMap={progressMap} />
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.6 }}>
        💡 Pour faire apparaître une matière ici, lie-la au programme via le menu déroulant "Lier au programme…" en mode édition.
      </p>
    </div>
  );
}
 
export default function App() {
  const [semesters, setSemesters] = useState([newSemester("Semestre 1")]);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState("semester"); // "semester" | "progression"
  const [newSemName, setNewSemName] = useState("");
  const [showAddSem, setShowAddSem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);
 
  useEffect(() => {
    loadFromSupabase().then((data) => {
      if (data && data.semesters && data.semesters.length > 0) {
        setSemesters(data.semesters);
        setActiveId(data.semesters[0].id);
        const maxId = data.semesters.reduce((max, sem) => {
          const semMax = sem.subjects.reduce((m, s) => Math.max(m, s.id || 0), sem.id || 0);
          return Math.max(max, semMax);
        }, 0);
        _nid = Math.max(_nid, maxId + 1);
      } else {
        const s = newSemester("Semestre 1");
        setSemesters([s]);
        setActiveId(s.id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
 
  const scheduleSave = useCallback((newSemesters) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await saveToSupabase({ semesters: newSemesters });
      setSaving(false);
      setLastSaved(new Date());
    }, 1500);
  }, []);
 
  const activeSem = semesters.find((s) => s.id === activeId) || semesters[0];
 
  const updateSemester = useCallback((updated) => {
    setSemesters((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);
 
  const addSemester = () => {
    if (!newSemName.trim()) return;
    const s = newSemester(newSemName.trim());
    setSemesters((prev) => {
      const next = [...prev, s];
      scheduleSave(next);
      return next;
    });
    setActiveId(s.id);
    setNewSemName("");
    setShowAddSem(false);
    setEditing(false);
  };
 
  const deleteSemester = (id) => {
    setSemesters((prev) => {
      const next = prev.filter((s) => s.id !== id);
      scheduleSave(next);
      return next;
    });
    if (activeId === id) setActiveId(semesters.find((s) => s.id !== id)?.id ?? null);
  };
 
  // Moyenne générale pondérée par ECTS sur tous les semestres
  const globalAvg = (function() {
    const entries = semesters.flatMap((sem) =>
      sem.subjects
        .map((s) => ({ avg: computeSubjectAvg(s), ects: parseFloat(s.ects) || 0 }))
        .filter((x) => x.avg !== null && x.ects > 0)
    );
    if (!entries.length) {
      const avgs = semesters.flatMap((sem) => sem.subjects.map(computeSubjectAvg).filter((x) => x !== null));
      if (!avgs.length) return null;
      return avgs.reduce((a, b) => a + b, 0) / avgs.length;
    }
    const totalEcts = entries.reduce((a, x) => a + x.ects, 0);
    return entries.reduce((a, x) => a + x.avg * x.ects, 0) / totalEcts;
  })();
 
  const semAvg = activeSem ? computeSemAvg(activeSem.subjects) : null;
  const totalEctsValidated = computeTotalEcts(semesters);
  const totalEctsInscrit = computeTotalEctsInscrit(semesters);
 
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTop: "4px solid #4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Chargement des notes…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
 
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
 
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1d4ed8 100%)", padding: "24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, boxShadow: "0 4px 24px rgba(30,27,75,0.25)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>📚 Carnet de Notes</h1>
          <p style={{ fontSize: 12, color: "#a5b4fc", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            Suivi des moyennes • Règle CC4
            {saving && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#818cf8" }}>
              <span style={{ width: 10, height: 10, border: "2px solid #818cf8", borderTop: "2px solid transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }}></span>
              Sauvegarde…
            </span>}
            {!saving && lastSaved && <span style={{ color: "#6ee7b7" }}>✓ Sauvegardé</span>}
          </p>
        </div>
 
        {/* Stats header droite */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* ECTS validés */}
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center", minWidth: 100 }}>
            <p style={{ fontSize: 10, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>ECTS validés</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: totalEctsValidated >= 60 ? "#6ee7b7" : totalEctsValidated > 0 ? "#fbbf24" : "#a5b4fc" }}>
                {totalEctsValidated}
              </span>
              <span style={{ fontSize: 13, color: "#a5b4fc" }}>/180</span>
            </div>
            {/* Barre de progression */}
            <div style={{ marginTop: 6, background: "rgba(255,255,255,0.15)", borderRadius: 10, height: 4, overflow: "hidden", width: "100%" }}>
              <div style={{
                width: Math.min((totalEctsValidated / 180) * 100, 100) + "%",
                height: "100%",
                background: totalEctsValidated >= 60 ? "#6ee7b7" : "#fbbf24",
                borderRadius: 10,
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>
 
          {/* Moyenne générale */}
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 20px", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Moyenne générale</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
              <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: globalAvg == null ? "#a5b4fc" : globalAvg >= 10 ? "#6ee7b7" : "#fca5a5" }}>{fmt(globalAvg)}</span>
              <span style={{ fontSize: 14, color: "#a5b4fc" }}>/20</span>
            </div>
            <p style={{ fontSize: 10, color: "#818cf8", marginTop: 3 }}>pondérée ECTS</p>
          </div>
        </div>
      </div>
 
      {/* Onglets semestres */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 16px", display: "flex", alignItems: "center", overflowX: "auto", gap: 0 }}>
        {semesters.map((s) => {
          const a = computeSemAvg(s.subjects);
          const isActive = s.id === activeId;
          return (
            <div key={s.id} onClick={() => { setActiveId(s.id); setEditing(false); }}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "14px 16px", cursor: "pointer", whiteSpace: "nowrap", borderBottom: "3px solid " + (isActive ? "#4f46e5" : "transparent"), color: isActive ? "#4f46e5" : "#64748b", fontWeight: isActive ? 700 : 400, fontSize: 13, userSelect: "none" }}>
              <span>{s.name}</span>
              {a !== null && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: isActive ? "#eef2ff" : "#f8fafc", color: isActive ? "#4f46e5" : "#94a3b8" }}>{fmt(a)}</span>
              )}
              {semesters.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); deleteSemester(s.id); }}
                  style={{ fontSize: 11, color: "#e2e8f0", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#e11d48"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#e2e8f0"; }}>✕</span>
              )}
            </div>
          );
        })}
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {showAddSem ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input autoFocus type="text" value={newSemName}
                onChange={(e) => setNewSemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSemester(); }}
                placeholder="Nom…"
                style={{ border: "1.5px solid #a5b4fc", borderRadius: 8, fontSize: 13, padding: "5px 8px", outline: "none", width: 120 }} />
              <button onClick={addSemester} style={{ background: "#4f46e5", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}>OK</button>
              <button onClick={() => { setShowAddSem(false); setNewSemName(""); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddSem(true)} style={{ background: "transparent", border: "1.5px dashed #a5b4fc", borderRadius: 8, color: "#4f46e5", fontSize: 12, fontWeight: 500, padding: "5px 12px", cursor: "pointer" }}>+ Semestre</button>
          )}
        </div>
      </div>
 
      {/* Onglets vue : Semestre / Progression */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", gap: 8 }}>
        <button onClick={() => setView("semester")}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1.5px solid " + (view === "semester" ? "#4f46e5" : "#e2e8f0"), background: view === "semester" ? "#eef2ff" : "#fff", color: view === "semester" ? "#4f46e5" : "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          📊 Semestre
        </button>
        <button onClick={() => { setView("progression"); setEditing(false); }}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1.5px solid " + (view === "progression" ? "#4f46e5" : "#e2e8f0"), background: view === "progression" ? "#eef2ff" : "#fff", color: view === "progression" ? "#4f46e5" : "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          🎓 Progression
        </button>
      </div>
 
      {/* Contenu */}
      <div style={{ padding: "20px 16px 100px", maxWidth: 860, margin: "0 auto" }}>
 
        {view === "progression" && <ProgressionView semesters={semesters} />}
 
        {view === "semester" && (
        <>
        {/* Bouton flottant */}
        <button onClick={() => setEditing((e) => !e)}
          style={{ position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: "50%", background: editing ? "linear-gradient(135deg,#0f172a,#1e293b)" : "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", boxShadow: "0 6px 20px rgba(79,70,229,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          {editing ? "✕" : "✏"}
        </button>
 
        {/* Vue semestre */}
        {!editing && activeSem && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "12px 16px", marginBottom: 16, background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2, fontWeight: 600 }}>Moy. semestre</p>
                <span style={{ fontSize: 20, fontWeight: 700, color: nc(semAvg) }}>{fmt(semAvg)}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}> / 20</span>
              </div>
              <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
              <div>
                <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2, fontWeight: 600 }}>Matières</p>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#334155" }}>{activeSem.subjects.filter((s) => s.name).length}</span>
              </div>
              <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
              <div>
                <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2, fontWeight: 600 }}>ECTS ce sem.</p>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>
                  {computeTotalEcts([activeSem])}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}> / {activeSem.subjects.reduce((t, s) => t + (parseFloat(s.ects) || 0), 0)}</span>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                Appuie sur <strong style={{ color: "#4f46e5" }}>✏</strong> pour modifier
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeSem.subjects.filter((s) => s.name || computeSubjectAvg(s) !== null).map((s) => (
                <SubjectRowView key={s.id} subject={s} />
              ))}
              {!activeSem.subjects.some((s) => s.name || computeSubjectAvg(s) !== null) && (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8", fontSize: 14, background: "#fff", borderRadius: 18, border: "1.5px dashed #e2e8f0" }}>
                  <p style={{ fontSize: 28, marginBottom: 10 }}>📝</p>
                  Aucune matière — appuie sur <strong style={{ color: "#4f46e5" }}>✏</strong> pour commencer.
                </div>
              )}
            </div>
            {semesters.length > 1 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tous les semestres</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {semesters.map((s) => {
                    const a = computeSemAvg(s.subjects);
                    const ects = computeTotalEcts([s]);
                    const ectsTotal = s.subjects.reduce((t, sub) => t + (parseFloat(sub.ects) || 0), 0);
                    const isActive = s.id === activeId;
                    return (
                      <div key={s.id} onClick={() => setActiveId(s.id)}
                        style={{ background: isActive ? "#eef2ff" : "#fff", border: "1.5px solid " + (isActive ? "#a5b4fc" : "#e2e8f0"), borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                        <span style={{ fontSize: 14, color: isActive ? "#4f46e5" : "#334155", fontWeight: isActive ? 700 : 500 }}>{s.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{ects}/{ectsTotal} ECTS</span>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: nc(a) }}>{fmt(a)}</span>
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>/20</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
 
        {/* Mode édition */}
        {editing && activeSem && (
          <div>
            <div style={{ background: "linear-gradient(135deg,#eef2ff,#f5f3ff)", border: "1.5px solid #c7d2fe", borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>✏ {activeSem.name}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Notes max 20 · Renseigne les ECTS de chaque matière · ✕ pour revenir à la vue</p>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: nc(semAvg) }}>{fmt(semAvg)}</span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>/20</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeSem.subjects.map((s, idx) => (
                <SubjectCard key={s.id} subject={s}
                  onChange={(updated) => {
                    const subjects = activeSem.subjects.map((x, i) => (i === idx ? updated : x));
                    updateSemester({ ...activeSem, subjects });
                  }}
                  onDelete={() => {
                    const subjects = activeSem.subjects.filter((_, i) => i !== idx);
                    updateSemester({ ...activeSem, subjects });
                  }} />
              ))}
            </div>
            <button onClick={() => updateSemester({ ...activeSem, subjects: [...activeSem.subjects, newSubject()] })}
              style={{ marginTop: 12, width: "100%", padding: 12, background: "#fff", border: "1.5px dashed #a5b4fc", borderRadius: 14, color: "#4f46e5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              + Ajouter une matière
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
