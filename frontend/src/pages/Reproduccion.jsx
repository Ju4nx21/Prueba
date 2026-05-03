import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
 
const PAGE_SIZE = 8;
 
const EMPTY_SERVICIO = {
  cerda_id: "", verraco_id: "", fecha_servicio: "",
  tipo_servicio: "MONTA_NATURAL", tecnico: "", observaciones: "",
};
const EMPTY_PARTO = {
  servicio_id: "", fecha_parto: "", lechones_nacidos_vivos: "",
  lechones_nacidos_muertos: "", lechones_momificados: "",
  peso_camada_kg: "", observaciones: "",
};
 
// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = d => {
  if (!d) return "—";
  const p = d.split("T")[0].split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
};
const fmtId = (prefix, id, fecha) =>
  `${prefix}-${(fecha || "2025-01-01").slice(0, 4)}-${String(id).padStart(3, "0")}`;
 
function diasParaParto(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha) - new Date()) / 86400000);
}
 
// ─── KPI ─────────────────────────────────────────────────────────────────────
function KPI({ label, value, icon, color = "orange" }) {
  return (
    <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-500 flex items-center justify-center text-sm`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
        <h3 className="text-lg font-black text-slate-700">{value ?? "—"}</h3>
      </div>
    </div>
  );
}
 
// ─── Badges ───────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const map = {
    GESTANTE:         { bg: "bg-emerald-50",  text: "text-emerald-600", label: "Gestante"         },
    CONFIRMADA:       { bg: "bg-blue-50",     text: "text-blue-600",   label: "Confirmada"       },
    PENDIENTE:        { bg: "bg-slate-100",   text: "text-slate-500",  label: "Por confirmar"    },
    FALLIDA:          { bg: "bg-red-50",      text: "text-red-600",    label: "Fallida"          },
    PARTO_REGISTRADO: { bg: "bg-orange-50",   text: "text-orange-600", label: "Parto registrado" },
  };
  const s = map[estado] || { bg: "bg-gray-100", text: "text-gray-600", label: estado };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
 
// ─── Input ────────────────────────────────────────────────────────────────────
const IC = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all";
 
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
 
// ─── Componente principal ─────────────────────────────────────────────────────
export default function Reproduccion() {
  const [tab,       setTab]       = useState("montas");
  const [servicios, setServicios] = useState([]);
  const [partos,    setPartos]    = useState([]);
  const [pigs,      setPigs]      = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
 
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [servicioForm, setServicioForm] = useState(EMPTY_SERVICIO);
  const [partoForm,    setPartoForm]    = useState(EMPTY_PARTO);
  const [saving,       setSaving]       = useState(false);
 
  const [viewRec, setViewRec] = useState(null);
 
  const [search,     setSearch]     = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [filterEst,  setFilterEst]  = useState("TODOS");
  const [fDesde,     setFDesde]     = useState("");
  const [fHasta,     setFHasta]     = useState("");
  const [page,       setPage]       = useState(1);
 
  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sv, pa, pg, st] = await Promise.all([
        apiGet("/reproduccion/servicios"),
        apiGet("/reproduccion/partos"),
        apiGet("/pigs"),
        apiGet("/reproduccion/stats"),
      ]);
      setServicios(Array.isArray(sv) ? sv : []);
      setPartos(Array.isArray(pa) ? pa : []);
      setPigs(Array.isArray(pg) ? pg : []);
      setStats(st);
    } catch (err) {
      toast.error("Error al cargar datos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => { fetchAll(); }, [fetchAll]);
 
  const hembras = useMemo(() => pigs.filter(p => p.sexo === "Hembra" || p.sexo === "H"), [pigs]);
  const machos  = useMemo(() => pigs.filter(p => p.sexo === "Macho"  || p.sexo === "M"), [pigs]);
 
  // ── Filtrado ────────────────────────────────────────────────────────────────
  const filteredServicios = useMemo(() => {
    let r = servicios;
    if (search)           r = r.filter(x => (x.cerda_arete || "").toLowerCase().includes(search.toLowerCase()) || (x.verraco_arete || "").toLowerCase().includes(search.toLowerCase()));
    if (filterTipo !== "TODOS") r = r.filter(x => x.tipo_servicio === filterTipo);
    if (filterEst  !== "TODOS") r = r.filter(x => x.estado === filterEst);
    if (fDesde)           r = r.filter(x => x.fecha_servicio >= fDesde);
    if (fHasta)           r = r.filter(x => x.fecha_servicio <= fHasta);
    return r;
  }, [servicios, search, filterTipo, filterEst, fDesde, fHasta]);
 
  const filteredPartos = useMemo(() => {
    let r = partos;
    if (search) r = r.filter(x => (x.cerda_arete || "").toLowerCase().includes(search.toLowerCase()));
    if (fDesde) r = r.filter(x => x.fecha_parto >= fDesde);
    if (fHasta) r = r.filter(x => x.fecha_parto <= fHasta);
    return r;
  }, [partos, search, fDesde, fHasta]);
 
  const gestantes = useMemo(() =>
    servicios.filter(s => s.estado === "GESTANTE" || s.estado === "CONFIRMADA"),
    [servicios]
  );
 
  const activeList = tab === "partos" ? filteredPartos : tab === "prenez" ? gestantes : filteredServicios;
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const rows       = activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
 
  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleServicioSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/reproduccion/servicios/${editingId}`, servicioForm);
        toast.success("Servicio actualizado ✓");
      } else {
        await apiPost("/reproduccion/servicios", servicioForm);
        toast.success("Servicio registrado ✓");
      }
      setShowForm(false); setEditingId(null); setServicioForm(EMPTY_SERVICIO);
      setTimeout(() => fetchAll(), 50);
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }
 
  async function handlePartoSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/reproduccion/partos/${editingId}`, partoForm);
        toast.success("Parto actualizado ✓");
      } else {
        await apiPost("/reproduccion/partos", partoForm);
        toast.success("Parto registrado ✓");
      }
      setShowForm(false); setEditingId(null); setPartoForm(EMPTY_PARTO);
      setTimeout(() => fetchAll(), 50);
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally { setSaving(false); }
  }
 
  async function handleDelete(type, id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await apiDelete(`/reproduccion/${type}/${id}`);
      toast.success("Eliminado");
      fetchAll();
    } catch (err) { toast.error(err.message); }
  }
 
  function openEditServicio(r) {
    setEditingId(r.id);
    setServicioForm({
      cerda_id:       r.pig_id,
      verraco_id:     r.verraco_pig_id || "",
      fecha_servicio: r.fecha_servicio?.split("T")[0] || "",
      tipo_servicio:  r.tipo_servicio,
      tecnico:        r.tecnico || "",
      observaciones:  r.observaciones || "",
    });
    setTab("montas"); setShowForm(true); setViewRec(null);
  }
 
  function clearFilters() {
    setSearch(""); setFilterTipo("TODOS"); setFilterEst("TODOS");
    setFDesde(""); setFHasta(""); setPage(1);
  }
 
  const hasFilters = search || filterTipo !== "TODOS" || filterEst !== "TODOS" || fDesde || fHasta;
 
  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans px-4">
 
      {/* ══ Header ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[1.8rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-orange-400 flex items-center justify-center shadow-lg" aria-hidden>
            <i className="fas fa-dna text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Reproducción — AgroFarm</h1>
            <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mt-1">Montas, preñez, partos y genética</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fetchAll()} className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-500 transition-all border border-gray-100" aria-label="Sincronizar">
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
          <button
            onClick={() => { setShowForm(s => !s); setEditingId(null); setServicioForm(EMPTY_SERVICIO); setPartoForm(EMPTY_PARTO); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-md transition-all text-xs uppercase tracking-widest">
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cerrar" : "Nuevo Registro"}
          </button>
        </div>
      </div>
 
      {/* ══ KPIs ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Montas"   value={stats?.montas}          icon="fa-venus-mars"  color="orange"  />
        <KPI label="Preñadas" value={stats?.gestantes}       icon="fa-egg"         color="emerald" />
        <KPI label="Partos"   value={stats?.partos_proximos} icon="fa-baby"        color="amber"   />
        <KPI label="Lechones" value={stats?.lechones}        icon="fa-piggy-bank"  color="blue"    />
      </div>
 
      {/* ══ Filtros ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-100 rounded-[1.8rem] p-5 shadow-sm">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-3">
          <i className="fas fa-magnifying-glass text-orange-400"></i> Búsqueda y Filtros
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <input type="text" placeholder="ID del animal..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 focus:bg-white outline-none transition-all min-w-[160px]" />
          <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none min-w-[160px]">
            <option value="TODOS">Todos los tipos</option>
            <option value="MONTA_NATURAL">Monta Natural</option>
            <option value="INSEMINACION">Inseminación</option>
          </select>
          <select value={filterEst} onChange={e => { setFilterEst(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none min-w-[150px]">
            <option value="TODOS">Todos los estados</option>
            <option value="GESTANTE">Gestante</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="PENDIENTE">Por confirmar</option>
            <option value="FALLIDA">Fallida</option>
            <option value="PARTO_REGISTRADO">Parto registrado</option>
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none" />
            <span className="text-gray-300 text-xs">→</span>
            <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-orange-500 outline-none" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-orange-500 underline hover:text-orange-600 font-black">
              Limpiar
            </button>
          )}
        </div>
      </div>
 
      {/* ══ Formulario ══════════════════════════════════════════════════════════ */}
      <div style={{ display: showForm ? "block" : "none" }}
        className="bg-white rounded-[1.8rem] border border-gray-200 shadow-xl p-6">
 
        <div className="flex gap-3 mb-5 pb-4 border-b border-gray-100">
          <button type="button" onClick={() => setTab("montas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === "montas" || tab === "prenez" ? "bg-slate-900 text-orange-400" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            <i className="fas fa-heart"></i> {editingId ? "Editar Servicio" : "Nuevo Servicio"}
          </button>
          <button type="button" onClick={() => setTab("partos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === "partos" ? "bg-slate-900 text-orange-400" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            <i className="fas fa-baby"></i> {editingId ? "Editar Parto" : "Nuevo Parto"}
          </button>
        </div>
 
        {/* Formulario Servicio */}
        {tab !== "partos" && (
          <form onSubmit={handleServicioSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Cerda" required>
                <select value={servicioForm.cerda_id}
                  onChange={e => setServicioForm(f => ({ ...f, cerda_id: e.target.value }))}
                  className={IC} required={showForm && tab !== "partos"}>
                  <option value="">Seleccione cerda...</option>
                  {hembras.map(p => <option key={p.id} value={p.id}>{p.codigo_arete} — {p.raza}</option>)}
                </select>
              </Field>
              <Field label="Verraco">
                <select value={servicioForm.verraco_id}
                  onChange={e => setServicioForm(f => ({ ...f, verraco_id: e.target.value }))}
                  className={IC}>
                  <option value="">Sin verraco (IA externa)</option>
                  {machos.map(p => <option key={p.id} value={p.id}>{p.codigo_arete} — {p.raza}</option>)}
                </select>
              </Field>
              <Field label="Fecha" required>
                <input type="date" value={servicioForm.fecha_servicio}
                  onChange={e => setServicioForm(f => ({ ...f, fecha_servicio: e.target.value }))}
                  className={IC} required={showForm && tab !== "partos"} />
              </Field>
              <Field label="Tipo">
                <select value={servicioForm.tipo_servicio}
                  onChange={e => setServicioForm(f => ({ ...f, tipo_servicio: e.target.value }))}
                  className={IC}>
                  <option value="MONTA_NATURAL">Monta Natural</option>
                  <option value="INSEMINACION">Inseminación Artificial</option>
                </select>
              </Field>
              <Field label="Técnico / Responsable">
                <input type="text" value={servicioForm.tecnico}
                  onChange={e => setServicioForm(f => ({ ...f, tecnico: e.target.value }))}
                  className={IC} placeholder="Nombre del técnico" />
              </Field>
              <Field label="Observaciones">
                <input type="text" value={servicioForm.observaciones}
                  onChange={e => setServicioForm(f => ({ ...f, observaciones: e.target.value }))}
                  className={IC} placeholder="Notas adicionales..." />
              </Field>
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-60">
                <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"} mr-2`}></i>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar Servicio"}
              </button>
            </div>
          </form>
        )}
 
        {/* Formulario Parto */}
        {tab === "partos" && (
          <form onSubmit={handlePartoSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Servicio asociado" required>
                <select value={partoForm.servicio_id}
                  onChange={e => setPartoForm(f => ({ ...f, servicio_id: e.target.value }))}
                  className={IC} required={showForm && tab === "partos"}>
                  <option value="">Seleccione servicio...</option>
                  {servicios.filter(s => s.estado === "GESTANTE" || s.estado === "CONFIRMADA").map(s => (
                    <option key={s.id} value={s.id}>
                      {s.cerda_arete} — {fmt(s.fecha_servicio)} ({s.tipo_servicio?.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha del parto" required>
                <input type="date" value={partoForm.fecha_parto}
                  onChange={e => setPartoForm(f => ({ ...f, fecha_parto: e.target.value }))}
                  className={IC} required={showForm && tab === "partos"} />
              </Field>
              <Field label="Lechones vivos" required>
                <input type="number" min="0" value={partoForm.lechones_nacidos_vivos}
                  onChange={e => setPartoForm(f => ({ ...f, lechones_nacidos_vivos: e.target.value }))}
                  className={IC} placeholder="0" required={showForm && tab === "partos"} />
              </Field>
              <Field label="Lechones muertos">
                <input type="number" min="0" value={partoForm.lechones_nacidos_muertos}
                  onChange={e => setPartoForm(f => ({ ...f, lechones_nacidos_muertos: e.target.value }))}
                  className={IC} placeholder="0" />
              </Field>
              <Field label="Momificados">
                <input type="number" min="0" value={partoForm.lechones_momificados}
                  onChange={e => setPartoForm(f => ({ ...f, lechones_momificados: e.target.value }))}
                  className={IC} placeholder="0" />
              </Field>
              <Field label="Peso camada (kg)">
                <input type="number" step="0.01" min="0" value={partoForm.peso_camada_kg}
                  onChange={e => setPartoForm(f => ({ ...f, peso_camada_kg: e.target.value }))}
                  className={IC} placeholder="0.00" />
              </Field>
              <div className="lg:col-span-3">
                <Field label="Observaciones">
                  <textarea value={partoForm.observaciones}
                    onChange={e => setPartoForm(f => ({ ...f, observaciones: e.target.value }))}
                    className={`${IC} h-24 resize-none`} placeholder="Notas adicionales..." />
                </Field>
              </div>
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-60">
                <i className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"} mr-2`}></i>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Registrar Parto"}
              </button>
            </div>
          </form>
        )}
      </div>
 
      {/* ══ Tabla ════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-sm overflow-hidden min-h-[320px]">
 
        {/* Tabs */}
        <div className="border-b border-gray-50 px-6 pt-4 flex gap-6 items-end">
          {[
            { key: "montas",   label: "Montas",   icon: "fa-venus-mars" },
            { key: "prenez",   label: "Preñez",   icon: "fa-egg"        },
            { key: "partos",   label: "Partos",   icon: "fa-baby"       },
            { key: "genetica", label: "Genética", icon: "fa-dna"        },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setShowForm(false); }}
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all duration-200 border-b-2 flex items-center gap-1.5 ${
                tab === t.key ? "border-orange-500 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              <i className={`fas ${t.icon} text-xs`}></i>{t.label}
            </button>
          ))}
          <span className="ml-auto pb-3 text-xs text-slate-400 font-bold">
            {activeList.length} registro{activeList.length !== 1 ? "s" : ""}
          </span>
        </div>
 
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl mb-3 block text-orange-400"></i>
            <p className="text-xs font-bold uppercase tracking-widest">Cargando datos...</p>
          </div>
        ) : rows.length === 0 && tab !== "genetica" ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
              <i className="fas fa-dna text-orange-400 text-2xl"></i>
            </div>
            <p className="text-slate-500 font-black text-sm">No hay registros</p>
            <p className="text-xs text-slate-400 mt-1 font-bold">Haz clic en "Nuevo Registro" para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
 
            {/* Tab Montas */}
            {tab === "montas" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {["ID Monta","Fecha","ID Hembra","ID Macho","Tipo","Responsable","Estado","Parto Est.","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => {
                    const dias = diasParaParto(r.fecha_probable_parto);
                    return (
                      <tr key={r.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3.5 text-sm font-black text-orange-500">{fmtId("M", r.id, r.fecha_servicio)}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{fmt(r.fecha_servicio)}</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{r.cerda_arete || `#${r.pig_id}`}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">{r.verraco_arete || "—"}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-500">{r.tipo_servicio?.replace("_", " ")}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">{r.tecnico || "—"}</td>
                        <td className="px-4 py-3.5"><EstadoBadge estado={r.estado} /></td>
                        <td className="px-4 py-3.5">
                          {r.fecha_probable_parto ? (
                            <div>
                              <span className="text-xs font-bold text-slate-500">{fmt(r.fecha_probable_parto)}</span>
                              {dias !== null && dias >= 0 && dias <= 15 && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-600">
                                  {dias === 0 ? "Hoy" : `${dias}d`}
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditServicio(r)} title="Editar"
                              className="w-8 h-8 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all inline-flex items-center justify-center">
                              <i className="fas fa-edit text-xs"></i>
                            </button>
                            <button onClick={() => setViewRec({ ...r, _type: "servicio" })} title="Ver detalle"
                              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all inline-flex items-center justify-center">
                              <i className="fas fa-eye text-xs"></i>
                            </button>
                            <button onClick={() => handleDelete("servicios", r.id)} title="Eliminar"
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
            )}
 
            {/* Tab Preñez */}
            {tab === "prenez" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {["Cerda","Fecha servicio","Tipo","Estado","Parto estimado","Días restantes","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => {
                    const dias = diasParaParto(r.fecha_probable_parto);
                    return (
                      <tr key={r.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{r.cerda_arete || `#${r.pig_id}`}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{fmt(r.fecha_servicio)}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-500">{r.tipo_servicio?.replace("_", " ")}</td>
                        <td className="px-4 py-3.5"><EstadoBadge estado={r.estado} /></td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-500">{fmt(r.fecha_probable_parto)}</td>
                        <td className="px-4 py-3.5">
                          {dias !== null ? (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              dias <= 7  ? "bg-red-50 text-red-600" :
                              dias <= 15 ? "bg-orange-50 text-orange-600" :
                              "bg-emerald-50 text-emerald-600"
                            }`}>
                              {dias <= 0 ? "Hoy / Vencido" : `${dias} días`}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setTab("partos"); setShowForm(true); setPartoForm(f => ({ ...f, servicio_id: String(r.id) })); }}
                              title="Registrar parto"
                              className="w-8 h-8 rounded-lg text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all inline-flex items-center justify-center">
                              <i className="fas fa-baby text-xs"></i>
                            </button>
                            <button onClick={() => setViewRec({ ...r, _type: "servicio" })} title="Ver detalle"
                              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all inline-flex items-center justify-center">
                              <i className="fas fa-eye text-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
 
            {/* Tab Partos */}
            {tab === "partos" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {["ID Parto","Cerda","Fecha","Vivos","Muertos","Momif.","Total","Peso camada","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3.5 text-sm font-black text-orange-500">{fmtId("P", r.id, r.fecha_parto)}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{r.cerda_arete || `#${r.pig_id}`}</td>
                      <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{fmt(r.fecha_parto)}</td>
                      <td className="px-4 py-3.5"><span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600">{r.lechones_nacidos_vivos}</span></td>
                      <td className="px-4 py-3.5"><span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-600">{r.lechones_nacidos_muertos || 0}</span></td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{r.lechones_momificados || 0}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{r.total_lechones || "—"}</td>
                      <td className="px-4 py-3.5 text-sm font-black text-emerald-600">
                        {r.peso_promedio_lechon ? `${parseFloat(r.peso_promedio_lechon).toFixed(2)} kg` : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewRec({ ...r, _type: "parto" })} title="Ver detalle"
                            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-eye text-xs"></i>
                          </button>
                          <button onClick={() => handleDelete("partos", r.id)} title="Eliminar"
                            className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all inline-flex items-center justify-center">
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
 
            {/* Tab Genética */}
            {tab === "genetica" && (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                  {[
                    {
                      label: "Promedio lechones/parto",
                      value: partos.length > 0
                        ? (partos.reduce((a, p) => a + (parseInt(p.lechones_nacidos_vivos) || 0), 0) / partos.length).toFixed(1)
                        : "—",
                      sub: `De ${partos.length} partos registrados`,
                    },
                    {
                      label: "Tasa de sobrevivencia",
                      value: partos.length > 0 ? (() => {
                        const vivos   = partos.reduce((a, p) => a + (parseInt(p.lechones_nacidos_vivos)   || 0), 0);
                        const muertos = partos.reduce((a, p) => a + (parseInt(p.lechones_nacidos_muertos) || 0), 0);
                        const total   = vivos + muertos;
                        return total > 0 ? `${((vivos / total) * 100).toFixed(1)}%` : "—";
                      })() : "—",
                      sub: "Lechones vivos vs total nacidos",
                    },
                    {
                      label: "Tipo servicio predominante",
                      value: servicios.length > 0 ? (() => {
                        const montas = servicios.filter(s => s.tipo_servicio === "MONTA_NATURAL").length;
                        const ia     = servicios.filter(s => s.tipo_servicio === "INSEMINACION").length;
                        return montas >= ia ? "Monta Natural" : "Inseminación";
                      })() : "—",
                      sub: `${servicios.filter(s => s.tipo_servicio === "MONTA_NATURAL").length} naturales · ${servicios.filter(s => s.tipo_servicio === "INSEMINACION").length} IA`,
                    },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{c.label}</p>
                      <p className="text-3xl font-black text-orange-500">{c.value}</p>
                      <p className="text-xs text-slate-400 mt-1 font-bold">{c.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 flex items-center justify-center">
                    <i className="fas fa-chart-bar text-orange-400 text-2xl"></i>
                  </div>
                  <p className="font-black text-slate-700 text-sm">Análisis genético detallado próximamente</p>
                  <p className="text-xs text-slate-400 mt-1 font-bold">Registro de líneas genéticas, índices de producción y más</p>
                </div>
              </div>
            )}
          </div>
        )}
 
        {/* Paginación */}
        {totalPages > 1 && tab !== "genetica" && (
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
            Servidor: reproduccion (Sincronizado) — {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
 
      {/* ══ Modal detalle ════════════════════════════════════════════════════════ */}
      {viewRec && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setViewRec(null); }}>
          <div className="bg-white rounded-[1.8rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <i className={`fas ${viewRec._type === "parto" ? "fa-baby" : "fa-heart"} text-orange-400`}></i>
                {viewRec._type === "parto" ? "Detalle del Parto" : "Detalle del Servicio"}
              </h3>
              <button onClick={() => setViewRec(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {viewRec._type === "servicio" ? [
                ["ID Servicio",    fmtId("M", viewRec.id, viewRec.fecha_servicio)],
                ["Cerda",          viewRec.cerda_arete   || "—"],
                ["Verraco",        viewRec.verraco_arete || "—"],
                ["Tipo",           viewRec.tipo_servicio?.replace("_", " ") || "—"],
                ["Fecha servicio", fmt(viewRec.fecha_servicio)],
                ["Estado",         viewRec.estado        || "—"],
                ["Parto estimado", fmt(viewRec.fecha_probable_parto)],
                ["Técnico",        viewRec.tecnico       || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{k}</dt>
                  <dd className="text-sm font-bold text-slate-700">{v}</dd>
                </div>
              )) : [
                ["ID Parto",      fmtId("P", viewRec.id, viewRec.fecha_parto)],
                ["Cerda",         viewRec.cerda_arete || "—"],
                ["Fecha parto",   fmt(viewRec.fecha_parto)],
                ["Vivos",         viewRec.lechones_nacidos_vivos  || 0],
                ["Muertos",       viewRec.lechones_nacidos_muertos || 0],
                ["Momificados",   viewRec.lechones_momificados    || 0],
                ["Total nacidos", viewRec.total_lechones           || "—"],
                ["Peso camada",   viewRec.peso_promedio_lechon ? `${parseFloat(viewRec.peso_promedio_lechon).toFixed(2)} kg` : "—"],
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
            <div className="px-5 pb-5">
              <button onClick={() => setViewRec(null)}
                className="w-full py-2.5 border border-gray-200 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest">
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
 