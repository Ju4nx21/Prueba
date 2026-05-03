import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, getUser } from "../services/api";
 
const TABS      = ["Tratamientos", "Vacunación", "Bioseguridad"];
const PAGE_SIZE = 8;
 
const EMPTY_FORM = {
  pig_id: "", tipo: "VACUNA", fecha: "", medicamento_vacuna: "",
  dosis: "", via_administracion: "INTRAMUSCULAR", veterinario: "",
  diagnostico: "", tratamiento: "", costo: "", proxima_aplicacion: "",
  observaciones: "", estado: "PENDIENTE",
};
 
// ─── Helpers de fecha ─────────────────────────────────────────────────────────
function isoDate(d) {
  if (!d) return null;
  return d.split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
 
// ─── Alertas dinámicas ────────────────────────────────────────────────────────
function buildAlertas(registros) {
  const hoy    = today();
  const en7    = addDays(hoy, 7);
  const alertas = [];
 
  const vencidos = registros.filter(
    r => r.proxima_aplicacion && isoDate(r.proxima_aplicacion) < hoy && r.estado !== "COMPLETADO"
  );
  if (vencidos.length > 0) {
    alertas.push({ id: "vencidos", nivel: "URGENTE", msg: `${vencidos.length} aplicación${vencidos.length > 1 ? "es" : ""} vencida${vencidos.length > 1 ? "s" : ""} sin completar` });
  }
 
  const pendientesFecha = registros.filter(r => r.estado === "PENDIENTE" && isoDate(r.fecha) < hoy);
  if (pendientesFecha.length > 0) {
    alertas.push({ id: "pendientes-fecha", nivel: "URGENTE", msg: `${pendientesFecha.length} registro${pendientesFecha.length > 1 ? "s" : ""} pendiente${pendientesFecha.length > 1 ? "s" : ""} con fecha vencida` });
  }
 
  const proximos = registros.filter(r => r.proxima_aplicacion && isoDate(r.proxima_aplicacion) >= hoy && isoDate(r.proxima_aplicacion) <= en7);
  if (proximos.length > 0) {
    alertas.push({ id: "proximos", nivel: "IMPORTANTE", msg: `${proximos.length} aplicación${proximos.length > 1 ? "es" : ""} programada${proximos.length > 1 ? "s" : ""} en los próximos 7 días` });
  }
 
  const enCurso = registros.filter(r => r.estado === "EN_CURSO");
  if (enCurso.length > 0) {
    alertas.push({ id: "en-curso", nivel: "IMPORTANTE", msg: `${enCurso.length} tratamiento${enCurso.length > 1 ? "s" : ""} en curso actualmente` });
  }
 
  const mesActual = hoy.slice(0, 7);
  const completadosMes = registros.filter(r => r.estado === "COMPLETADO" && isoDate(r.fecha)?.startsWith(mesActual));
  if (completadosMes.length > 0) {
    alertas.push({ id: "completados-mes", nivel: "INFORMACION", msg: `${completadosMes.length} registro${completadosMes.length > 1 ? "s" : ""} completado${completadosMes.length > 1 ? "s" : ""} este mes` });
  }
 
  if (alertas.length === 0) {
    alertas.push({ id: "ok", nivel: "INFORMACION", msg: "Todo al día — sin alertas sanitarias pendientes" });
  }
 
  return alertas;
}
 
// ─── Bioseguridad dinámica ────────────────────────────────────────────────────
function buildBio(registros) {
  if (registros.length === 0) return { general: 0, items: [] };
  const completados  = registros.filter(r => r.estado === "COMPLETADO").length;
  const vacunas      = registros.filter(r => r.tipo === "VACUNA");
  const vacComp      = vacunas.filter(r => r.estado === "COMPLETADO").length;
  const desparasit   = registros.filter(r => r.tipo === "DESPARASITACION");
  const despaComp    = desparasit.filter(r => r.estado === "COMPLETADO").length;
  const tratamientos = registros.filter(r => r.tipo === "TRATAMIENTO");
  const tratComp     = tratamientos.filter(r => r.estado === "COMPLETADO").length;
  const pct = (n, total) => total === 0 ? 100 : Math.round((n / total) * 100);
  return {
    general: pct(completados, registros.length),
    items: [
      { label: "Vacunación al día",        pct: pct(vacComp,   vacunas.length)      },
      { label: "Desparasitación al día",   pct: pct(despaComp, desparasit.length)   },
      { label: "Tratamientos completados", pct: pct(tratComp,  tratamientos.length) },
    ],
  };
}
 
// ─── Badges ───────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }) {
  const map = {
    VACUNA:          { bg: "bg-blue-50",   text: "text-blue-600",   label: "Vacuna"         },
    TRATAMIENTO:     { bg: "bg-orange-50", text: "text-orange-600", label: "Tratamiento"    },
    DESPARASITACION: { bg: "bg-emerald-50",text: "text-emerald-600",label: "Desparasitante" },
    DIAGNOSTICO:     { bg: "bg-amber-50",  text: "text-amber-600",  label: "Diagnóstico"    },
  };
  const s = map[tipo] || { bg: "bg-gray-100", text: "text-gray-600", label: tipo };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
 
function EstadoBadge({ estado }) {
  const map    = { COMPLETADO: "bg-emerald-500 text-white", EN_CURSO: "bg-orange-500 text-white", PENDIENTE: "bg-slate-200 text-slate-600" };
  const labels = { COMPLETADO: "Completado", EN_CURSO: "En curso", PENDIENTE: "Pendiente" };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${map[estado] || "bg-gray-100 text-gray-600"}`}>
      {labels[estado] || estado}
    </span>
  );
}
 
function AlertaBadge({ nivel }) {
  const map = {
    URGENTE:     { bg: "bg-red-500",    label: "Urgente"     },
    IMPORTANTE:  { bg: "bg-orange-500", label: "Importante"  },
    INFORMACION: { bg: "bg-blue-400",   label: "Información" },
  };
  const s = map[nivel] || { bg: "bg-gray-400", label: nivel };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black text-white whitespace-nowrap uppercase tracking-widest ${s.bg}`}>
      {s.label}
    </span>
  );
}
 
// ─── Círculo bioseguridad ─────────────────────────────────────────────────────
function CircularProgress({ pct }) {
  const r = 32, circ = 2 * Math.PI * r;
  const color = pct >= 80 ? "#f97316" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex-shrink-0 w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * pct / 100} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-slate-800">{pct}%</span>
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">General</span>
      </div>
    </div>
  );
}
 
// ─── Campo formulario ─────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
 
const INPUT_CLS = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all";
 
// ─── KPI ─────────────────────────────────────────────────────────────────────
function KPI({ label, value, icon, color = "orange" }) {
  return (
    <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-500 flex items-center justify-center text-sm`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
        <h3 className="text-lg font-black text-slate-700">{value}</h3>
      </div>
    </div>
  );
}
 
// ─── Componente principal ─────────────────────────────────────────────────────
export default function Sanidad() {
  const user = getUser();
 
  const [registros, setRegistros] = useState([]);
  const [pigs,      setPigs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
 
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData,  setFormData]  = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
 
  const [viewId, setViewId] = useState(null);
 
  const [searchId,   setSearchId]   = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [fDesde,     setFDesde]     = useState("");
  const [fHasta,     setFHasta]     = useState("");
 
  const [tab,  setTab]  = useState("Tratamientos");
  const [page, setPage] = useState(1);
 
  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [san, pigsData] = await Promise.all([apiGet("/sanidad"), apiGet("/pigs")]);
      setRegistros(san);
      setPigs(pigsData);
    } catch (err) {
      toast.error("Error al cargar datos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => { fetchAll(); }, [fetchAll]);
 
  const alertas = useMemo(() => buildAlertas(registros), [registros]);
  const bio     = useMemo(() => buildBio(registros),     [registros]);
 
  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        pig_id:             parseInt(formData.pig_id),
        costo:              formData.costo              ? parseFloat(formData.costo) : null,
        dosis:              formData.dosis              || null,
        veterinario:        formData.veterinario        || null,
        diagnostico:        formData.diagnostico        || null,
        tratamiento:        formData.tratamiento        || null,
        proxima_aplicacion: formData.proxima_aplicacion || null,
        observaciones:      formData.observaciones      || null,
        medicamento_vacuna: formData.medicamento_vacuna || null,
      };
 
      const isEditing = !!editingId;
      if (isEditing) {
        await apiPut(`/sanidad/${editingId}`, payload);
      } else {
        await apiPost("/sanidad", payload);
      }
 
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      setPage(1);
 
      setTimeout(() => {
        toast.success(isEditing ? "Registro actualizado ✓" : "Registro creado ✓");
        fetchAll();
      }, 80);
 
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }
 
  function openEdit(r) {
    setEditingId(r.id);
    setFormData({
      pig_id:             r.pig_id,
      tipo:               r.tipo,
      fecha:              isoDate(r.fecha)              || "",
      medicamento_vacuna: r.medicamento_vacuna          || "",
      dosis:              r.dosis                       || "",
      via_administracion: r.via_administracion          || "INTRAMUSCULAR",
      veterinario:        r.veterinario                 || "",
      diagnostico:        r.diagnostico                 || "",
      tratamiento:        r.tratamiento                 || "",
      costo:              r.costo                       || "",
      proxima_aplicacion: isoDate(r.proxima_aplicacion) || "",
      observaciones:      r.observaciones               || "",
      estado:             r.estado                      || "PENDIENTE",
    });
    setShowForm(true);
    setViewId(null);
  }
 
  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await apiDelete(`/sanidad/${id}`);
      toast.success("Registro eliminado");
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error(err.message || "Error al eliminar");
    }
  }
 
  function openNew() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(s => !s);
    setViewId(null);
  }
 
  // ── Filtrado ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = registros;
    if (searchId.trim())    r = r.filter(x => (x.codigo_arete || "").toLowerCase().includes(searchId.toLowerCase()));
    if (filterTipo !== "TODOS") r = r.filter(x => x.tipo === filterTipo);
    if (fDesde) r = r.filter(x => isoDate(x.fecha) >= fDesde);
    if (fHasta) r = r.filter(x => isoDate(x.fecha) <= fHasta);
    if (tab === "Vacunación")   r = r.filter(x => x.tipo === "VACUNA");
    if (tab === "Bioseguridad") r = r.filter(x => x.tipo === "DESPARASITACION");
    return r;
  }, [registros, searchId, filterTipo, fDesde, fHasta, tab]);
 
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const viewRec    = registros.find(r => r.id === viewId);
 
  const fmtDate = d => {
    const s = isoDate(d);
    if (!s) return "—";
    const [y, m, dd] = s.split("-");
    return `${dd}/${m}/${y}`;
  };
  const fmtId = r =>
    `T-${(isoDate(r.fecha) || "2025-01-01").slice(0, 4)}-${String(r.id).padStart(3, "0")}`;
 
  const set = k => e => setFormData(f => ({ ...f, [k]: e.target.value }));
 
  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans px-4">
 
      {/* ══ Header ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[1.8rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-orange-400 flex items-center justify-center shadow-lg" aria-hidden>
            <i className="fas fa-shield-heart text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Sanidad — AgroFarm</h1>
            <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mt-1">Tratamientos, vacunación y bioseguridad</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fetchAll()} className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-500 transition-all border border-gray-100" aria-label="Sincronizar">
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
          <button onClick={openNew}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-md transition-all text-xs uppercase tracking-widest">
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cerrar" : "Nuevo Tratamiento"}
          </button>
          <button className="px-4 py-2 border-2 border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-500 font-black rounded-xl transition-all text-xs uppercase tracking-widest">
            <i className="fas fa-calendar-check mr-2"></i>Plan de Sanidad
          </button>
        </div>
      </div>
 
      {/* ══ KPIs ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Total Registros"   value={registros.length}                                              icon="fa-file-medical"        color="orange"  />
        <KPI label="Pendientes"        value={registros.filter(r => r.estado === "PENDIENTE").length}        icon="fa-clock"               color="amber"   />
        <KPI label="En Curso"          value={registros.filter(r => r.estado === "EN_CURSO").length}         icon="fa-spinner"             color="blue"    />
        <KPI label="Completados"       value={registros.filter(r => r.estado === "COMPLETADO").length}       icon="fa-circle-check"        color="emerald" />
      </div>
 
      {/* ══ Alertas + Bioseguridad ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
 
        {/* Alertas */}
        <div className="bg-white border border-gray-100 rounded-[1.8rem] p-6 shadow-sm">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
            <i className="fas fa-triangle-exclamation text-orange-400"></i> Alertas Sanitarias
          </h2>
          {loading ? (
            <p className="text-xs text-slate-400">Calculando alertas...</p>
          ) : (
            <div className="space-y-3">
              {alertas.map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <AlertaBadge nivel={a.nivel} />
                  <span className="flex-1 text-xs text-slate-600 font-semibold">{a.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
 
        {/* Bioseguridad */}
        <div className="bg-white border border-gray-100 rounded-[1.8rem] p-6 shadow-sm">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
            <i className="fas fa-shield-halved text-orange-400"></i> Estado Bioseguridad
          </h2>
          {loading ? (
            <p className="text-xs text-slate-400">Calculando...</p>
          ) : (
            <div className="flex gap-6 items-center">
              <CircularProgress pct={bio.general} />
              <div className="flex-1 space-y-3">
                {bio.items.map(it => (
                  <div key={it.label}>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      <span>{it.label}</span>
                      <span className={it.pct >= 80 ? "text-emerald-500" : it.pct >= 50 ? "text-amber-500" : "text-red-500"}>
                        {it.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${it.pct}%`, backgroundColor: it.pct >= 80 ? "#f97316" : it.pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
 
      {/* ══ Formulario ══════════════════════════════════════════════════════════ */}
      <div style={{ display: showForm ? "block" : "none" }}
        className="bg-white rounded-[1.8rem] border border-gray-200 shadow-xl p-6 mb-6">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 uppercase tracking-widest">
          <i className="fas fa-file-medical text-orange-400"></i>
          {editingId ? "Editar Registro Sanitario" : "Nuevo Registro Sanitario"}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 
            <Field label="Animal / Grupo" required>
              <select value={formData.pig_id} onChange={set("pig_id")} className={INPUT_CLS} required={showForm}>
                <option value="">Seleccione un cerdo...</option>
                {pigs.map(p => <option key={p.id} value={p.id}>{p.codigo_arete} — {p.raza} ({p.sexo})</option>)}
              </select>
            </Field>
 
            <Field label="Tipo" required>
              <select value={formData.tipo} onChange={set("tipo")} className={INPUT_CLS}>
                <option value="VACUNA">🩺 Vacuna</option>
                <option value="TRATAMIENTO">💊 Tratamiento</option>
                <option value="DESPARASITACION">🛡️ Desparasitación</option>
                <option value="DIAGNOSTICO">🔬 Diagnóstico</option>
              </select>
            </Field>
 
            <Field label="Fecha" required>
              <input type="date" value={formData.fecha} onChange={set("fecha")} className={INPUT_CLS} required={showForm} />
            </Field>
 
            <Field label="Medicamento / Vacuna">
              <input type="text" value={formData.medicamento_vacuna} onChange={set("medicamento_vacuna")} className={INPUT_CLS} placeholder="Nombre del medicamento" />
            </Field>
 
            <Field label="Dosis">
              <input type="text" value={formData.dosis} onChange={set("dosis")} className={INPUT_CLS} placeholder="Ej: 5ml, 1ml/33kg" />
            </Field>
 
            <Field label="Vía de Administración">
              <select value={formData.via_administracion} onChange={set("via_administracion")} className={INPUT_CLS}>
                <option value="INTRAMUSCULAR">Intramuscular</option>
                <option value="SUBCUTANEA">Subcutánea</option>
                <option value="ORAL">Oral</option>
                <option value="TOPICA">Tópica</option>
                <option value="INTRAVENOSA">Intravenosa</option>
              </select>
            </Field>
 
            <Field label="Responsable / Veterinario">
              <input type="text" value={formData.veterinario} onChange={set("veterinario")} className={INPUT_CLS} placeholder="Dr. ..." />
            </Field>
 
            <Field label="Estado">
              <select value={formData.estado} onChange={set("estado")} className={INPUT_CLS}>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_CURSO">En curso</option>
                <option value="COMPLETADO">Completado</option>
              </select>
            </Field>
 
            <Field label="Costo ($)">
              <input type="number" step="0.01" min="0" value={formData.costo} onChange={set("costo")} className={INPUT_CLS} placeholder="0.00" />
            </Field>
 
            <Field label="Próxima Aplicación">
              <input type="date" value={formData.proxima_aplicacion} onChange={set("proxima_aplicacion")} className={INPUT_CLS} />
            </Field>
 
            <Field label="Diagnóstico">
              <input type="text" value={formData.diagnostico} onChange={set("diagnostico")} className={INPUT_CLS} placeholder="Diagnóstico clínico" />
            </Field>
 
            <div className="lg:col-span-3">
              <Field label="Observaciones">
                <textarea value={formData.observaciones} onChange={set("observaciones")} className={`${INPUT_CLS} h-24 resize-none`} placeholder="Notas adicionales..." />
              </Field>
            </div>
          </div>
 
          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 justify-end">
            <button type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setFormData(EMPTY_FORM); }}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-black text-gray-500 hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-60">
              <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"} mr-2`}></i>
              {saving ? "Guardando..." : editingId ? "Actualizar Registro" : "Guardar Registro"}
            </button>
          </div>
        </form>
      </div>
 
      {/* ══ Filtros ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-100 rounded-[1.8rem] p-5 shadow-sm">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-3">
          <i className="fas fa-magnifying-glass text-orange-400"></i> Búsqueda y Filtros
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <input type="text" placeholder="ID del animal..." value={searchId}
            onChange={e => setSearchId(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 focus:bg-white outline-none transition-all min-w-[160px]" />
 
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none transition-all min-w-[160px]">
            <option value="TODOS">Todos los tipos</option>
            <option value="VACUNA">Vacuna</option>
            <option value="TRATAMIENTO">Tratamiento</option>
            <option value="DESPARASITACION">Desparasitación</option>
            <option value="DIAGNOSTICO">Diagnóstico</option>
          </select>
 
          <div className="flex items-center gap-2">
            <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none transition-all" />
            <span className="text-gray-300 text-xs">→</span>
            <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none transition-all" />
          </div>
 
          <button onClick={() => setPage(1)}
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all uppercase tracking-widest">
            <i className="fas fa-filter mr-2"></i>Filtrar
          </button>
 
          {(searchId || filterTipo !== "TODOS" || fDesde || fHasta) && (
            <button onClick={() => { setSearchId(""); setFilterTipo("TODOS"); setFDesde(""); setFHasta(""); setPage(1); }}
              className="text-xs text-orange-500 underline hover:text-orange-600 font-black">
              Limpiar
            </button>
          )}
        </div>
      </div>
 
      {/* ══ Tabla ════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-sm overflow-hidden min-h-[320px]">
 
        <div className="border-b border-gray-50 px-6 pt-4 flex gap-6 items-end">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all duration-200 border-b-2 ${
                tab === t ? "border-orange-500 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t}
            </button>
          ))}
          <span className="ml-auto pb-3 text-xs text-slate-400 font-bold">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
 
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl mb-3 block text-orange-400"></i>
            <p className="text-xs font-bold uppercase tracking-widest">Cargando registros...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
              <i className="fas fa-heart-pulse text-orange-400 text-2xl"></i>
            </div>
            <p className="text-slate-500 font-black text-sm">No hay registros sanitarios</p>
            <p className="text-xs text-slate-400 mt-1 font-bold">Haz clic en "Nuevo Tratamiento" para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {["ID Tratamiento","Fecha","ID Animal/Grupo","Tipo","Medicamento","Dosis","Responsable","Estado","Acciones"].map(h => (
                    <th key={h} className="px-4 py-3 last:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-orange-50/30 transition-colors duration-150">
                    <td className="px-4 py-3.5 text-sm font-black text-orange-500">{fmtId(r)}</td>
                    <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{fmtDate(r.fecha)}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{r.codigo_arete || `#${r.pig_id}`}</td>
                    <td className="px-4 py-3.5"><TipoBadge tipo={r.tipo} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{r.medicamento_vacuna || <span className="text-gray-200">—</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{r.dosis || <span className="text-gray-200">—</span>}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{r.veterinario || <span className="text-gray-200">—</span>}</td>
                    <td className="px-4 py-3.5"><EstadoBadge estado={r.estado || "PENDIENTE"} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(r)} title="Editar"
                          className="w-8 h-8 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all inline-flex items-center justify-center">
                          <i className="fas fa-edit text-xs"></i>
                        </button>
                        <button onClick={() => { setViewId(r.id); setShowForm(false); }} title="Ver detalle"
                          className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all inline-flex items-center justify-center">
                          <i className="fas fa-eye text-xs"></i>
                        </button>
                        <button onClick={() => handleDelete(r.id)} title="Eliminar"
                          className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all inline-flex items-center justify-center">
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50">
            <div className="text-sm text-slate-500 font-bold">Página {page} de {totalPages}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all">Anterior</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${n === page ? "bg-slate-900 text-white shadow" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 border rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all">Siguiente</button>
            </div>
          </div>
        )}
      </div>
 
      {/* Footer */}
      <div className="flex justify-center pt-2">
        <div className="px-6 py-2 bg-white border border-gray-100 rounded-full flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">
            Servidor: sanidad (Sincronizado) — {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
 
      {/* ══ Modal detalle — Portal ════════════════════════════════════════════════ */}
      {viewRec && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setViewId(null); }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <i className="fas fa-file-medical text-orange-400"></i>
                Detalle del Registro
              </h3>
              <button onClick={() => setViewId(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                ["ID Tratamiento",     fmtId(viewRec)],
                ["Animal/Grupo",       viewRec.codigo_arete || `#${viewRec.pig_id}`],
                ["Tipo",               viewRec.tipo],
                ["Fecha",              fmtDate(viewRec.fecha)],
                ["Medicamento",        viewRec.medicamento_vacuna || "—"],
                ["Dosis",              viewRec.dosis              || "—"],
                ["Vía administración", viewRec.via_administracion || "—"],
                ["Responsable",        viewRec.veterinario        || "—"],
                ["Estado",             viewRec.estado             || "PENDIENTE"],
                ["Costo",              viewRec.costo ? `$${parseFloat(viewRec.costo).toLocaleString()}` : "—"],
                ["Próxima aplicación", fmtDate(viewRec.proxima_aplicacion)],
                ["Diagnóstico",        viewRec.diagnostico        || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{k}</dt>
                  <dd className="text-sm font-bold text-slate-700">{v}</dd>
                </div>
              ))}
              {viewRec.observaciones && (
                <div className="col-span-2">
                  <dt className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Observaciones</dt>
                  <dd className="text-sm text-slate-600">{viewRec.observaciones}</dd>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { openEdit(viewRec); setViewId(null); }}
                className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all uppercase tracking-widest">
                <i className="fas fa-edit mr-2"></i>Editar
              </button>
              <button onClick={() => setViewId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest">
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}