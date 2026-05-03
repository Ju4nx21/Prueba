import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

// ─── Etapas ───────────────────────────────────────────────────────────────────
const ETAPAS = [
  { key: "MATERNIDAD",  label: "Maternidad",  color: "#f97316", dias_rec: 21,  icon: "fa-heart"                 },
  { key: "DESTETE",     label: "Destete",     color: "#06b6d4", dias_rec: 35,  icon: "fa-seedling"              },
  { key: "CRECIMIENTO", label: "Crecimiento", color: "#10b981", dias_rec: 40,  icon: "fa-arrow-up-right-dots"   },
  { key: "ENGORDE",     label: "Engorde",     color: "#8b5cf6", dias_rec: 90,  icon: "fa-weight-scale"          },
  { key: "REPRODUCTOR", label: "Reproductor", color: "#f59e0b", dias_rec: 999, icon: "fa-venus-mars"            },
];

const ESTADOS   = ["ACTIVO", "VENDIDO", "MUERTO", "ENFERMO", "CUARENTENA"];
const PAGE_SIZE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = d => {
  if (!d) return "—";
  const p = (d.split("T")[0] || d).split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
};

const diasDesde = fechaStr => {
  if (!fechaStr) return 0;
  const diff = Date.now() - new Date(fechaStr.split("T")[0]).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

const getEtapaInfo = key => ETAPAS.find(e => e.key === (key || "").toUpperCase()) || ETAPAS[2];

const getEstadoEtapa = (diasEnEtapa, diasRec) => {
  if (diasEnEtapa <= diasRec)        return { label: "Normal",           dot: "#22c55e", bg: "#f0fdf4", text: "#166534" };
  if (diasEnEtapa <= diasRec * 1.5)  return { label: "Por trasladar",    dot: "#f97316", bg: "#fff7ed", text: "#9a3412" };
  return                                    { label: "Urgente trasladar", dot: "#ef4444", bg: "#fef2f2", text: "#991b1b" };
};

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

// ─── Formulario ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  codigo_arete: "", nombre: "", fecha_nacimiento: "", sexo: "MACHO",
  raza: "", etapa: "CRECIMIENTO", peso_actual: "", lote: "",
  ubicacion: "", estado: "ACTIVO", observaciones: "",
};

const MOVE_FORM = { etapa_destino: "", lote: "", observaciones: "" };

const INPUT = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all";

export default function Produccion() {
  const [pigs,         setPigs]         = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading,      setLoading]      = useState(true);

  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData,  setFormData]  = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);

  const [moveId,   setMoveId]   = useState(null);
  const [moveData, setMoveData] = useState(MOVE_FORM);
  const [moving,   setMoving]   = useState(false);

  const [viewId,    setViewId]    = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [viewMode,  setViewMode]  = useState("list");

  const [search,  setSearch]  = useState("");
  const [fEtapa,  setFEtapa]  = useState("TODAS");
  const [fEstado, setFEstado] = useState("TODOS");
  const [fSexo,   setFSexo]   = useState("TODOS");
  const [page,    setPage]    = useState(1);

  // ── Carga ───────────────────────────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [pigsData, statsData] = await Promise.all([
        apiGet("/pigs"),
        apiGet("/produccion/estadisticas").catch(() => null),
      ]);
      setPigs(Array.isArray(pigsData) ? pigsData : []);
      setEstadisticas(statsData);
    } catch (err) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = pigs.filter(p => p.estado === "ACTIVO").length;
    const porEtapa = {};
    ETAPAS.forEach(e => {
      porEtapa[e.key] = pigs.filter(p => (p.etapa || "").toUpperCase() === e.key && p.estado === "ACTIVO").length;
    });
    return { total, porEtapa };
  }, [pigs]);

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = pigs;
    if (search.trim())
      r = r.filter(p =>
        (p.codigo_arete || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.nombre       || "").toLowerCase().includes(search.toLowerCase())
      );
    if (fEtapa  !== "TODAS") r = r.filter(p => (p.etapa  || "").toUpperCase() === fEtapa);
    if (fEstado !== "TODOS") r = r.filter(p => (p.estado || "").toUpperCase() === fEstado);
    if (fSexo   !== "TODOS") r = r.filter(p => (p.sexo   || "").toUpperCase() === fSexo);
    return r;
  }, [pigs, search, fEtapa, fEstado, fSexo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const viewPig    = pigs.find(p => p.id === viewId);
  const movePig    = pigs.find(p => p.id === moveId);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, peso_actual: formData.peso_actual ? parseFloat(formData.peso_actual) : null };
      if (editingId) {
        await apiPut(`/pigs/${editingId}`, payload);
        toast.success("Animal actualizado ✓");
      } else {
        await apiPost("/pigs", payload);
        toast.success("Animal registrado ✓");
      }
      setShowForm(false); setEditingId(null); setFormData(EMPTY_FORM); setPage(1);
      fetchAll();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p) {
    setEditingId(p.id);
    setFormData({
      codigo_arete:     p.codigo_arete     || "",
      nombre:           p.nombre           || "",
      fecha_nacimiento: p.fecha_nacimiento?.split("T")[0] || "",
      sexo:             p.sexo             || "MACHO",
      raza:             p.raza             || "",
      etapa:            p.etapa            || "CRECIMIENTO",
      peso_actual:      p.peso_actual      || "",
      lote:             p.lote             || "",
      ubicacion:        p.ubicacion        || "",
      estado:           p.estado           || "ACTIVO",
      observaciones:    p.observaciones    || "",
    });
    setShowForm(true); setViewId(null);
  }

  async function handleMove(e) {
    e.preventDefault();
    setMoving(true);
    try {
      await apiPut(`/pigs/${moveId}`, {
        etapa:         moveData.etapa_destino,
        lote:          moveData.lote || movePig?.lote,
        observaciones: moveData.observaciones || null,
      });
      toast.success(`Animal movido a ${moveData.etapa_destino} ✓`);
      setMoveId(null); setMoveData(MOVE_FORM); fetchAll();
    } catch (err) {
      toast.error(err.message || "Error al mover animal");
    } finally {
      setMoving(false);
    }
  }

  async function confirmDelete() {
    try {
      await apiDelete(`/pigs/${confirmId}`);
      toast.success("Animal eliminado");
      setPigs(prev => prev.filter(p => p.id !== confirmId));
    } catch (err) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setConfirmId(null);
    }
  }

  function exportCSV() {
    const headers = ["ID","Nombre","Fecha Nac.","Edad (días)","Sexo","Etapa","Peso (kg)","Lote","Estado"];
    const csvRows = [
      headers.join(","),
      ...filtered.map(p => [
        p.codigo_arete, p.nombre || "", fmtDate(p.fecha_nacimiento), diasDesde(p.fecha_nacimiento),
        p.sexo, p.etapa, p.peso_actual || "", p.lote || "", p.estado
      ].join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "produccion_animales.csv";
    a.click();
    toast.success("CSV exportado ✓");
  }

  const set  = k => e => setFormData(f => ({ ...f, [k]: e.target.value }));
  const setM = k => e => setMoveData(f => ({ ...f, [k]: e.target.value }));

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans px-4">

      {/* ══ Header ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[1.8rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-orange-400 flex items-center justify-center shadow-lg" aria-hidden>
            <i className="fas fa-chart-line text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Producción — AgroFarm</h1>
            <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mt-1">Ciclo de vida, etapas y gestión de animales</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchAll()} className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-500 transition-all border border-gray-100" aria-label="Sincronizar">
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setFormData(EMPTY_FORM); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-md transition-all text-xs uppercase tracking-widest">
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cerrar" : "Registrar Animal"}
          </button>
          <button onClick={() => setMoveId("bulk")}
            className="px-4 py-2 border-2 border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-500 font-black rounded-xl transition-all text-xs uppercase tracking-widest">
            <i className="fas fa-right-left mr-2"></i>Mover Animales
          </button>
        </div>
      </div>

      {/* ══ KPIs ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Total Activos"  value={stats.total}                    icon="fa-piggy-bank"  color="orange"  />
        <KPI label="Crecimiento"    value={stats.porEtapa["CRECIMIENTO"] || 0} icon="fa-arrow-up-right-dots" color="emerald" />
        <KPI label="Engorde"        value={stats.porEtapa["ENGORDE"]      || 0} icon="fa-weight-scale"        color="purple"  />
        <KPI label="Reproductores"  value={stats.porEtapa["REPRODUCTOR"]  || 0} icon="fa-venus-mars"          color="amber"   />
      </div>

      {/* ══ Panel de Etapas ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-100 rounded-[1.8rem] p-5 shadow-sm">
        <div className="flex flex-wrap items-stretch gap-0 divide-x divide-gray-100">
          <div className="flex flex-col justify-center pr-8 min-w-[140px]">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Animales</p>
            <p className="text-5xl font-black text-slate-800 leading-none">{stats.total}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">Activos en producción</p>
          </div>
          <div className="flex flex-wrap gap-6 pl-8 flex-1">
            {ETAPAS.slice(0, 4).map(e => (
              <div key={e.key} className="flex flex-col justify-center min-w-[80px]">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{e.label}</p>
                <p className="text-3xl font-black" style={{ color: e.color }}>
                  {stats.porEtapa[e.key] || 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Formulario Registro ══════════════════════════════════════════════════ */}
      {showForm && (
        <div className="bg-white rounded-[1.8rem] border border-gray-200 shadow-xl p-6">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 uppercase tracking-widest">
            <i className="fas fa-paw text-orange-400"></i>
            {editingId ? "Editar Animal" : "Registrar Nuevo Animal"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Código Arete *</label>
                <input type="text" value={formData.codigo_arete} onChange={set("codigo_arete")} className={INPUT} placeholder="CRD-001" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                <input type="text" value={formData.nombre} onChange={set("nombre")} className={INPUT} placeholder="Nombre del animal" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fecha de Nacimiento *</label>
                <input type="date" value={formData.fecha_nacimiento} onChange={set("fecha_nacimiento")} className={INPUT} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sexo *</label>
                <select value={formData.sexo} onChange={set("sexo")} className={INPUT} required>
                  <option value="MACHO">Macho</option>
                  <option value="HEMBRA">Hembra</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Raza</label>
                <input type="text" value={formData.raza} onChange={set("raza")} className={INPUT} placeholder="Yorkshire, Duroc..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Etapa *</label>
                <select value={formData.etapa} onChange={set("etapa")} className={INPUT} required>
                  {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Peso Actual (kg)</label>
                <input type="number" step="0.1" min="0" value={formData.peso_actual} onChange={set("peso_actual")} className={INPUT} placeholder="0.0" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lote</label>
                <input type="text" value={formData.lote} onChange={set("lote")} className={INPUT} placeholder="Lote A, Grupo 1..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Estado</label>
                <select value={formData.estado} onChange={set("estado")} className={INPUT}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ubicación</label>
                <input type="text" value={formData.ubicacion} onChange={set("ubicacion")} className={INPUT} placeholder="Corral 3, Galpón B..." />
              </div>
              <div className="lg:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observaciones</label>
                <textarea value={formData.observaciones} onChange={set("observaciones")} className={`${INPUT} h-24 resize-none`} placeholder="Notas adicionales..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-60">
                <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"} mr-2`}></i>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Registrar Animal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ Filtros ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-100 rounded-[1.8rem] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-magnifying-glass text-orange-400"></i> Búsqueda y Filtros
          </h2>
          <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
            <button onClick={() => setViewMode("list")}
              className={`px-2 py-1 rounded text-xs font-black transition-all ${viewMode === "list" ? "bg-slate-900 text-orange-400" : "text-gray-500 hover:text-slate-700"}`}>
              <i className="fas fa-list"></i>
            </button>
            <button onClick={() => setViewMode("grid")}
              className={`px-2 py-1 rounded text-xs font-black transition-all ${viewMode === "grid" ? "bg-slate-900 text-orange-400" : "text-gray-500 hover:text-slate-700"}`}>
              <i className="fas fa-grip"></i>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <input type="text" placeholder="ID o nombre del animal..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 focus:bg-white outline-none transition-all min-w-[200px]" />
          <select value={fEtapa} onChange={e => setFEtapa(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none">
            <option value="TODAS">Todas las etapas</option>
            {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none">
            <option value="TODOS">Estado</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fSexo} onChange={e => setFSexo(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none">
            <option value="TODOS">Todos los sexos</option>
            <option value="MACHO">Macho</option>
            <option value="HEMBRA">Hembra</option>
          </select>
          <button onClick={() => setPage(1)}
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all uppercase tracking-widest">
            <i className="fas fa-filter mr-2"></i>Filtrar
          </button>
          {(search || fEtapa !== "TODAS" || fEstado !== "TODOS" || fSexo !== "TODOS") && (
            <button onClick={() => { setSearch(""); setFEtapa("TODAS"); setFEstado("TODOS"); setFSexo("TODOS"); setPage(1); }}
              className="text-xs text-orange-500 underline hover:text-orange-600 font-black">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ══ Tabla / Grid ═════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-sm overflow-hidden min-h-[320px]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-list text-orange-400"></i>
            Listado de Animales
            <span className="ml-1 text-slate-400 normal-case font-bold text-xs">({filtered.length})</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-500 text-xs font-black rounded-lg transition-all uppercase tracking-widest">
              <i className="fas fa-file-export text-[10px]"></i> Exportar
            </button>
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-black rounded-lg hover:bg-gray-50 transition-all uppercase tracking-widest">
              <i className="fas fa-print text-[10px]"></i> Imprimir
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl text-orange-400 mb-3 block"></i>
            <p className="text-xs font-black uppercase tracking-widest">Cargando animales...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
              <i className="fas fa-paw text-orange-400 text-2xl"></i>
            </div>
            <p className="text-slate-500 font-black text-sm">No hay animales registrados</p>
            <p className="text-xs text-slate-400 mt-1 font-bold">Haz clic en "Registrar Animal" para comenzar</p>
          </div>
        ) : viewMode === "list" ? (

          /* ── Vista Lista ── */
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {["ID","Nombre","Fecha Nacimiento","Edad (días)","Sexo","Etapa","Días en Etapa","Peso (kg)","Estado","Acciones"].map(h => (
                    <th key={h} className="px-4 py-3 last:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(p => {
                  const edadDias    = diasDesde(p.fecha_nacimiento);
                  const etapaInfo   = getEtapaInfo(p.etapa);
                  const diasEtapa   = diasDesde(p.fecha_nacimiento);
                  const estadoEtapa = getEstadoEtapa(diasEtapa, etapaInfo.dias_rec);
                  return (
                    <tr key={p.id} className="hover:bg-orange-50/30 transition-colors duration-150">
                      <td className="px-4 py-3.5 text-sm font-black text-orange-500">{p.codigo_arete}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{p.nombre || <span className="text-gray-200">—</span>}</td>
                      <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{fmtDate(p.fecha_nacimiento)}</td>
                      <td className="px-4 py-3.5 text-sm font-black text-slate-700">{edadDias}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-500">{(p.sexo || "").charAt(0).toUpperCase()}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                          style={{ background: etapaInfo.color + "22", color: etapaInfo.color }}>
                          {etapaInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        <span className="font-black">{diasEtapa}</span>
                        <span className="text-slate-300 ml-1">({etapaInfo.dias_rec} rec.)</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-black text-emerald-600">
                        {p.peso_actual ? `${parseFloat(p.peso_actual).toFixed(1)}` : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                          style={{ background: estadoEtapa.bg, color: estadoEtapa.text }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: estadoEtapa.dot }}></span>
                          {estadoEtapa.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(p)} title="Editar"
                            className="w-8 h-8 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                          <button onClick={() => { setMoveId(p.id); setMoveData({ ...MOVE_FORM, etapa_destino: p.etapa }); }} title="Mover etapa"
                            className="w-8 h-8 rounded-lg text-amber-400 hover:bg-amber-50 hover:text-amber-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-right-left text-xs"></i>
                          </button>
                          <button onClick={() => setViewId(p.id)} title="Ver detalle"
                            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-eye text-xs"></i>
                          </button>
                          <button onClick={() => setConfirmId(p.id)} title="Eliminar"
                            className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Vista Grid ── */
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rows.map(p => {
              const edadDias    = diasDesde(p.fecha_nacimiento);
              const etapaInfo   = getEtapaInfo(p.etapa);
              const estadoEtapa = getEstadoEtapa(edadDias, etapaInfo.dias_rec);
              return (
                <div key={p.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-orange-100 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-black text-orange-500">{p.codigo_arete}</p>
                      <p className="text-xs text-slate-400 font-bold">{p.nombre || "Sin nombre"}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ background: etapaInfo.color + "22", color: etapaInfo.color }}>
                      {etapaInfo.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between text-slate-500"><span className="font-bold">Edad:</span><span className="font-black text-slate-700">{edadDias} días</span></div>
                    <div className="flex justify-between text-slate-500"><span className="font-bold">Peso:</span><span className="font-black text-slate-700">{p.peso_actual ? `${parseFloat(p.peso_actual).toFixed(1)} kg` : "—"}</span></div>
                    <div className="flex justify-between text-slate-500"><span className="font-bold">Sexo:</span><span className="font-black text-slate-700">{p.sexo}</span></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ background: estadoEtapa.bg, color: estadoEtapa.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoEtapa.dot }}></span>
                      {estadoEtapa.label}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg text-blue-400 hover:bg-blue-50 transition-all inline-flex items-center justify-center"><i className="fas fa-edit text-[10px]"></i></button>
                      <button onClick={() => { setMoveId(p.id); setMoveData({ ...MOVE_FORM, etapa_destino: p.etapa }); }} className="w-7 h-7 rounded-lg text-amber-400 hover:bg-amber-50 transition-all inline-flex items-center justify-center"><i className="fas fa-right-left text-[10px]"></i></button>
                      <button onClick={() => setViewId(p.id)} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 transition-all inline-flex items-center justify-center"><i className="fas fa-eye text-[10px]"></i></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
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
            Servidor: produccion (Sincronizado) — {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ══ PORTALS ══════════════════════════════════════════════════════════════ */}

      {/* Modal Mover Animal */}
      {moveId && moveId !== "bulk" && movePig && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setMoveId(null); }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <i className="fas fa-right-left text-orange-400"></i>
                Mover Animal — {movePig.codigo_arete}
              </h3>
              <button onClick={() => setMoveId(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleMove} className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">
                  Etapa actual: <span className="font-black" style={{ color: getEtapaInfo(movePig.etapa).color }}>{getEtapaInfo(movePig.etapa).label}</span>
                </p>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Etapa Destino *</label>
                <select value={moveData.etapa_destino} onChange={setM("etapa_destino")} className={INPUT} required>
                  <option value="">Seleccione etapa...</option>
                  {ETAPAS.filter(e => e.key !== (movePig.etapa || "").toUpperCase()).map(e => (
                    <option key={e.key} value={e.key}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nuevo Lote</label>
                <input type="text" value={moveData.lote} onChange={setM("lote")} className={INPUT} placeholder={movePig.lote || "Mismo lote actual"} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Motivo / Observaciones</label>
                <textarea value={moveData.observaciones} onChange={setM("observaciones")} className={`${INPUT} h-20 resize-none`} placeholder="Razón del traslado..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={moving}
                  className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-all uppercase tracking-widest">
                  <i className={`fas ${moving ? "fa-spinner fa-spin" : "fa-right-left"} mr-2`}></i>
                  {moving ? "Moviendo..." : "Confirmar Traslado"}
                </button>
                <button type="button" onClick={() => setMoveId(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Mover Masivo */}
      {moveId === "bulk" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setMoveId(null); }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-md p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
              <i className="fas fa-right-left text-orange-400 text-lg"></i>
            </div>
            <h3 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-widest">Mover Animales</h3>
            <p className="text-sm text-slate-400 mb-5 font-bold">Selecciona un animal de la tabla y usa su botón <i className="fas fa-right-left text-amber-500 mx-1"></i> para moverlo de etapa individualmente.</p>
            <button onClick={() => setMoveId(null)}
              className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all uppercase tracking-widest">
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Detalle */}
      {viewPig && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setViewId(null); }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-lg overflow-y-auto" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <i className="fas fa-paw text-orange-400"></i>
                Detalle — {viewPig.codigo_arete}
              </h3>
              <button onClick={() => setViewId(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                ["Código Arete",  viewPig.codigo_arete],
                ["Nombre",        viewPig.nombre       || "—"],
                ["Fecha Nac.",    fmtDate(viewPig.fecha_nacimiento)],
                ["Edad",          `${diasDesde(viewPig.fecha_nacimiento)} días`],
                ["Sexo",          viewPig.sexo         || "—"],
                ["Raza",          viewPig.raza         || "—"],
                ["Etapa",         getEtapaInfo(viewPig.etapa).label],
                ["Peso Actual",   viewPig.peso_actual ? `${parseFloat(viewPig.peso_actual).toFixed(1)} kg` : "—"],
                ["Lote",          viewPig.lote         || "—"],
                ["Ubicación",     viewPig.ubicacion    || "—"],
                ["Estado",        viewPig.estado       || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{k}</dt>
                  <dd className="text-sm font-bold text-slate-700">{v}</dd>
                </div>
              ))}
              {viewPig.observaciones && (
                <div className="col-span-2">
                  <dt className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Observaciones</dt>
                  <dd className="text-sm text-slate-600">{viewPig.observaciones}</dd>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { openEdit(viewPig); setViewId(null); }}
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

      {/* Confirm Eliminar */}
      {confirmId && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
              <i className="fas fa-trash text-red-400 text-lg"></i>
            </div>
            <h3 className="text-sm font-black text-slate-800 mb-1 uppercase tracking-widest">¿Eliminar animal?</h3>
            <p className="text-sm text-slate-400 mb-5 font-bold">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest">
                Cancelar
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-500 text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}