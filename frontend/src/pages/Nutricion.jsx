// src/pages/Nutricion.jsx
/**
 * AGROFARM - Nutricion.jsx
 * Versión: 14.5.0 - Formulario Inteligente para Consumos agregado
 * Autor: Kevin (adaptado y mejorado)
 *
 * Cambios:
 * - Se agregó la lógica y el formulario para registrar Consumos de Alimento.
 * - El botón superior ahora es contextual (cambia según la pestaña activa).
 * - Código anterior INTACTO (0 líneas eliminadas).
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import toast from "react-hot-toast";

// ── Servicios de red y auth ───────────────────────────────────────
import { apiGet, apiPost, apiPut, apiDelete, getUser } from "../services/api";

async function fetchAllData() {
  const [alimentos, consumos, pigs] = await Promise.all([
    apiGet("/nutricion/alimentos").catch(() => []),
    apiGet("/nutricion/consumos").catch(() => []),
    apiGet("/pigs").catch(() => []),
  ]);
  return {
    alimentos: Array.isArray(alimentos) ? alimentos : [],
    consumos:  Array.isArray(consumos)  ? consumos  : [],
    pigs:      Array.isArray(pigs)      ? pigs      : [],
  };
}

/**
 * normalizePayload — v13.1.0
 */
function normalizePayload(form) {
  const toFloatOrNull = (val) => {
    if (val === "" || val === undefined || val === null) return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };

  const toIntOrNull = (val) => {
    if (val === "" || val === undefined || val === null) return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  };

  return {
    nombre_alimento:     (form.nombre_alimento || "").trim(),
    tipo:                (form.tipo || "Grano").trim(),
    proteina_porcentaje: toFloatOrNull(form.proteina_porcentaje),
    costo_por_kg:        toFloatOrNull(form.costo_por_kg),
    stock_kg:            toFloatOrNull(form.stock_kg),
    proveedor:           form.proveedor ? form.proveedor.trim() : null,
    observaciones:       form.observaciones ? form.observaciones.trim() : null,
    granjas_id:           (() => {
      const user = getUser();
      const raw  = user?.granjas_id ?? null;
      if (raw === null || raw === undefined) return null;
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? null : parsed;
    })(),
  };
}

function validateAlimento(form) {
  if (!form.nombre_alimento || form.nombre_alimento.trim() === "") {
    return { valid: false, error: "Nombre del alimento es obligatorio" };
  }
  if (form.stock_kg !== "" && form.stock_kg !== null && form.stock_kg !== undefined) {
    if (Number(form.stock_kg) < 0) {
      return { valid: false, error: "Stock debe ser un número válido (>= 0)" };
    }
  }
  if (form.proteina_porcentaje !== "" && form.proteina_porcentaje !== null && form.proteina_porcentaje !== undefined) {
    if (Number(form.proteina_porcentaje) < 0 || Number(form.proteina_porcentaje) > 100) {
      return { valid: false, error: "Proteína debe estar entre 0 y 100" };
    }
  }
  return { valid: true };
}

/* ============================
   Utilidades
   ============================ */
function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function formatCurrency(n) {
  if (n == null || isNaN(n)) return "$0.00";
  return `$${Number(n).toFixed(2)}`;
}

/* ============================
   Componente principal
   ============================ */
export default function Nutricion({ mode = "A" }) {
  // UI state
  const [uiMode, setUiMode]   = useState(mode === "B" ? "B" : "A");
  const [tab, setTab]         = useState("alimentos");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]   = useState("");
  const debouncedSearch       = useDebounced(search, 250);

  // Data
  const [alimentos, setAlimentos] = useState([]);
  const [consumos, setConsumos]   = useState([]);
  const [pigs, setPigs]           = useState([]);

  // Editing
  const [editingId, setEditingId] = useState(null);

  /**
   * initialForm: refleja exactamente los campos editables del esquema.
   */
  const initialForm = {
    nombre_alimento:     "",
    tipo:                "Grano",
    proteina_porcentaje: "",   
    costo_por_kg:        "",   
    stock_kg:            "",   
    proveedor:           "",
    observaciones:       "",
  };
  const [form, setForm] = useState(initialForm);

  // ── NUEVO ESTADO PARA EL FORMULARIO DE CONSUMO ──
  const initialConsumoForm = {
    pigs_id: "",
    alimentacion_id: "",
    cantidad_kg: "",
    fecha: new Date().toISOString().split('T')[0], // Fecha de hoy por defecto
    lote: "",
    observaciones: ""
  };
  const [consumoForm, setConsumoForm] = useState(initialConsumoForm);
  const [isSubmittingConsumo, setIsSubmittingConsumo] = useState(false);

  // Pagination & sorting
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(10);
  const [sortBy, setSortBy]     = useState({ key: "nombre_alimento", dir: "asc" });

  // Calculadora
  const [calc, setCalc]         = useState({ etapa: "CRECIMIENTO", cantidad: 10, dias: 30 });
  const [resCalc, setResCalc]   = useState(null);
  const [calcDetails, setCalcDetails] = useState(null);

  // Optimistic operations tracking
  const optimisticRef = useRef({});

  // Refs
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ============================
     Carga inicial y recarga
     ============================ */
  const load = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const { alimentos, consumos, pigs } = await fetchAllData();
      if (!mountedRef.current) return;
      setAlimentos(alimentos);
      setConsumos(consumos);
      setPigs(pigs);
      if (showToast) toast.success("Datos sincronizados");
    } catch (err) {
      console.error("Load error:", err);
      toast.error("No se pudo sincronizar datos");
      setAlimentos([]);
      setConsumos([]);
      setPigs([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ============================
     CRUD con Optimistic UI (Alimentos)
     ============================ */
  const optimisticUpdateLocal = (type, id, payload) => {
    if (type === "create") {
      setAlimentos((s) => [payload, ...s]);
    } else if (type === "update") {
      setAlimentos((s) => s.map((a) => (a.id === id ? { ...a, ...payload } : a)));
    } else if (type === "delete") {
      setAlimentos((s) => s.filter((a) => a.id !== id));
    }
  };

  const rollbackOptimistic = (id) => {
    const meta = optimisticRef.current[id];
    if (!meta) return;
    if (meta.type === "create") {
      setAlimentos((s) => s.filter((a) => a.id !== id));
    } else if (meta.type === "update") {
      setAlimentos((s) => s.map((a) => (a.id === id ? meta.prev : a)));
    } else if (meta.type === "delete") {
      setAlimentos((s) => [meta.prev, ...s]);
    }
    delete optimisticRef.current[id];
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    const v = validateAlimento(form);
    if (!v.valid) { toast.error(v.error); return; }
    setLoading(true);
    try {
      const payload = normalizePayload(form);
      if (editingId) {
        const prev = alimentos.find((a) => a.id === editingId);
        optimisticRef.current[editingId] = { prev: prev ? { ...prev } : null, type: "update" };
        optimisticUpdateLocal("update", editingId, payload);
        await apiPut(`/nutricion/alimentos/${editingId}`, payload);
        toast.success("Insumo actualizado");
      } else {
        const tempId = `temp-${Date.now()}`;
        const optimisticItem = { id: tempId, ...payload };
        optimisticRef.current[tempId] = { prev: null, type: "create" };
        optimisticUpdateLocal("create", tempId, optimisticItem);
        const created = await apiPost("/nutricion/alimentos", payload);
        setAlimentos((s) => s.map((a) => (a.id === tempId ? (created?.id ? created : { ...a, id: created?.id || tempId }) : a)));
        toast.success("Nuevo insumo registrado");
      }
      resetForm();
      load();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Error al procesar la solicitud");
      if (editingId) {
        rollbackOptimistic(editingId);
      } else {
        const temp = Object.keys(optimisticRef.current).find((k) => optimisticRef.current[k].type === "create");
        if (temp) rollbackOptimistic(temp);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro permanentemente?")) return;
    const prev = alimentos.find((a) => a.id === id);
    optimisticRef.current[id] = { prev: prev ? { ...prev } : null, type: "delete" };
    optimisticUpdateLocal("delete", id, null);
    try {
      await apiDelete(`/nutricion/alimentos/${id}`);
      toast.success("Registro eliminado");
      delete optimisticRef.current[id];
      load();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("No se pudo eliminar");
      rollbackOptimistic(id);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  // ── NUEVA FUNCIÓN: GUARDAR CONSUMO ──
  const handleConsumoSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!consumoForm.pigs_id || !consumoForm.alimentacion_id || !consumoForm.cantidad_kg) {
      toast.error("Cerdo, Alimento y Cantidad son obligatorios");
      return;
    }
    
    setIsSubmittingConsumo(true);
    try {
      const user = getUser();
      const payload = {
        pigs_id: parseInt(consumoForm.pigs_id, 10),
        alimentacion_id: parseInt(consumoForm.alimentacion_id, 10),
        cantidad_kg: parseFloat(consumoForm.cantidad_kg),
        fecha: consumoForm.fecha,
        lote: consumoForm.lote ? consumoForm.lote.trim() : null,
        observaciones: consumoForm.observaciones ? consumoForm.observaciones.trim() : null,
        granjas_id: user?.granjas_id ? parseInt(user.granjas_id, 10) : null
      };

      await apiPost("/nutricion/consumos", payload);
      toast.success("¡Consumo registrado exitosamente!");
      setConsumoForm(initialConsumoForm);
      setShowForm(false);
      load(); // Recargamos para que aparezca en el historial y se actualice el stock
    } catch (err) {
      console.error("Error al registrar consumo:", err);
      toast.error("No se pudo registrar el consumo");
    } finally {
      setIsSubmittingConsumo(false);
    }
  };

  /* ============================
     Calculadora avanzada
     ============================ */
  const handleCalculadora = (e) => {
    e && e.preventDefault && e.preventDefault();
    const factores = { CRECIMIENTO: 1.85, ENGORDE: 2.65, LACTANCIA: 5.80, GESTACION: 2.25 };
    const factor   = factores[calc.etapa] || 0;
    const cantidad = Number(calc.cantidad || 0);
    const dias     = Number(calc.dias || 0);
    const total    = factor * cantidad * dias;
    const details  = {
      factor,
      cantidad,
      dias,
      total:     Number(total.toFixed(2)),
      perDay:    Number((factor * cantidad).toFixed(2)),
      perAnimal: Number((factor * dias).toFixed(2)),
      timestamp: new Date().toISOString(),
    };
    setCalcDetails(details);
    setResCalc(details.total);
    toast.success("Proyección calculada", { icon: "📈" });
  };

  /* ============================
     Derived data
     ============================ */
  const filtered = useMemo(() => {
    const q = (debouncedSearch || "").toLowerCase().trim();
    let list = alimentos.slice();
    if (q) {
      list = list.filter((a) =>
        (a.nombre_alimento || "").toLowerCase().includes(q) ||
        (a.proveedor       || "").toLowerCase().includes(q) ||
        (a.tipo            || "").toLowerCase().includes(q)
      );
    }
    list.sort((x, y) => {
      const a = (x[sortBy.key] || "").toString().toLowerCase();
      const b = (y[sortBy.key] || "").toString().toLowerCase();
      if (a < b) return sortBy.dir === "asc" ? -1 : 1;
      if (a > b) return sortBy.dir === "asc" ?  1 : -1;
      return 0;
    });
    return list;
  }, [alimentos, debouncedSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const toggleSort = (key) => {
    setSortBy((s) => {
      if (s.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
  };

  /* ============================
     Accesibilidad — Ctrl+N / Cmd+N
     ============================ */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") setShowForm((s) => !s);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ============================
     KPI component
     ============================ */
  const inputClass = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all";

  function KPI({ label, value, icon, color = "orange" }) {
    return (
      <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-500 flex items-center justify-center text-sm`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
          <h3 className="text-lg font-black text-slate-700">{loading ? "..." : value}</h3>
        </div>
      </div>
    );
  }

  /* ============================
     Render
     ============================ */
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[1.8rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-orange-400 flex items-center justify-center shadow-lg" aria-hidden>
            <i className="fas fa-utensils text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Alimentación — AgroFarm</h1>
            <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mt-1">Inventario, consumos y simulador nutricional</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button onClick={() => load(true)} className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-500 transition-all border border-gray-100" aria-label="Sincronizar">
              <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
            </button>
            
            {/* BOTÓN INTELIGENTE: Cambia de color y texto según la pestaña */}
            <button 
              onClick={() => setShowForm((s) => !s)} 
              className={`px-4 py-2 text-white font-black rounded-xl shadow-md transition-all text-xs uppercase tracking-widest ${tab === "consumos" ? "bg-purple-600 hover:bg-purple-700" : "bg-orange-500 hover:bg-orange-600"}`}
              aria-pressed={showForm}
            >
              {showForm ? "Cerrar" : (tab === "consumos" ? "Registrar Consumo" : "Nuevo Insumo")}
            </button>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Modo</label>
            <select value={uiMode} onChange={(e) => setUiMode(e.target.value)} className="px-3 py-2 rounded-md border">
              <option value="A">Compacto</option>
              <option value="B">Avanzado</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Stock Total (Kg)" value={alimentos.reduce((acc, a) => acc + Number(a.stock_kg || 0), 0).toLocaleString()} icon="fa-warehouse" color="orange" />
        <KPI label="Sujetos"          value={pigs.length}      icon="fa-piggy-bank" color="emerald" />
        <KPI label="Fórmulas"         value={alimentos.length} icon="fa-flask"      color="blue"    />
        <KPI label="Registros Consumo" value={consumos.length} icon="fa-history"    color="purple"  />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          {["alimentos", "consumos", "calculos"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setShowForm(false); }}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              {t === "alimentos" ? "Catálogo" : t === "consumos" ? "Historial" : "Calculadora"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-transparent focus-within:border-orange-200">
            <i className="fas fa-search text-slate-300"></i>
            <input aria-label="Buscar" placeholder="Buscar insumo, proveedor o tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent outline-none text-sm" />
          </div>
          <div className="text-xs text-slate-400">Resultados: <strong className="text-slate-700">{filtered.length}</strong></div>
        </div>
      </div>

      {/* ── CONTENEDOR DE FORMULARIOS ── */}
      <div className={showForm ? "block animate-fade-in-up" : "hidden"}>
        <div className="bg-white rounded-[1.8rem] border border-gray-200 shadow-xl p-6 mb-6">
          
          {/* FORMULARIO 1: CREAR ALIMENTO (Se muestra solo en la pestaña Catálogo) */}
          {tab === "alimentos" && (
            <form onSubmit={handleSubmit} className={uiMode === "A" ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "space-y-6"}>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nombre Alimento</label>
                <input type="text" value={form.nombre_alimento} onChange={(e) => setForm({ ...form, nombre_alimento: e.target.value })} className={inputClass} required />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Categoría</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputClass}>
                  <option value="Grano">Grano</option>
                  <option value="Concentrado">Concentrado</option>
                  <option value="Suplemento">Suplemento</option>
                  <option value="Mezcla">Mezcla</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Stock (Kg)</label>
                <input type="number" value={form.stock_kg} onChange={(e) => setForm({ ...form, stock_kg: e.target.value })} className={inputClass} />
              </div>

              {uiMode === "B" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Proteína (%)</label>
                    <input type="number" step="0.01" value={form.proteina_porcentaje} onChange={(e) => setForm({ ...form, proteina_porcentaje: e.target.value })} className={inputClass} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Costo por Kg ($)</label>
                    <input type="number" step="0.01" value={form.costo_por_kg} onChange={(e) => setForm({ ...form, costo_por_kg: e.target.value })} className={inputClass} />
                  </div>

                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Proveedor</label>
                    <input type="text" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className={inputClass} />
                  </div>

                  <div className="space-y-1 md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Observaciones</label>
                    <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                </>
              )}

              <div className="md:col-span-3 flex gap-3 justify-end">
                {editingId && (
                  <button type="button" onClick={() => { setForm(initialForm); setEditingId(null); }} className="px-4 py-2 border rounded-md">
                    Cancelar
                  </button>
                )}
                <button type="submit" className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-orange-600 transition-all">
                  {editingId ? "Actualizar" : "Guardar Insumo"}
                </button>
              </div>
            </form>
          )}

          {/* FORMULARIO 2: REGISTRAR CONSUMO (Se muestra solo en la pestaña Historial) */}
          {tab === "consumos" && (
            <form onSubmit={handleConsumoSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Seleccionar Cerdo</label>
                <select value={consumoForm.pigs_id} onChange={(e) => setConsumoForm({...consumoForm, pigs_id: e.target.value})} className={inputClass} required>
                  <option value="">-- Elija un sujeto --</option>
                  {pigs.map(p => <option key={p.id} value={p.id}>{p.codigo_arete || `ID: ${p.id}`} {p.nombre ? `- ${p.nombre}` : ''}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Seleccionar Fórmula</label>
                <select value={consumoForm.alimentacion_id} onChange={(e) => setConsumoForm({...consumoForm, alimentacion_id: e.target.value})} className={inputClass} required>
                  <option value="">-- Elija un alimento --</option>
                  {alimentos.map(a => <option key={a.id} value={a.id}>{a.nombre_alimento} (Quedan: {a.stock_kg || 0} kg)</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Cantidad Suministrada (Kg)</label>
                <input type="number" step="0.01" min="0.01" value={consumoForm.cantidad_kg} onChange={(e) => setConsumoForm({...consumoForm, cantidad_kg: e.target.value})} className={inputClass} required />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Fecha del Consumo</label>
                <input type="date" value={consumoForm.fecha} onChange={(e) => setConsumoForm({...consumoForm, fecha: e.target.value})} className={inputClass} required />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Lote (Opcional)</label>
                <input type="text" placeholder="Ej. Lote A" value={consumoForm.lote} onChange={(e) => setConsumoForm({...consumoForm, lote: e.target.value})} className={inputClass} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Observaciones</label>
                <input type="text" placeholder="Alguna nota..." value={consumoForm.observaciones} onChange={(e) => setConsumoForm({...consumoForm, observaciones: e.target.value})} className={inputClass} />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button type="submit" disabled={isSubmittingConsumo} className="px-6 py-2 bg-purple-600 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50">
                  {isSubmittingConsumo ? "Guardando..." : "Guardar Registro de Consumo"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Contenido dinámico */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-sm overflow-hidden min-h-[320px]">

        {/* Catálogo */}
        <div className={tab === "alimentos" ? "block" : "hidden"}>
          <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <h2 className="font-black text-slate-700 uppercase text-xs tracking-widest">Inventario de Alimentación</h2>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400">Mostrar</label>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-1 border rounded">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-3 cursor-pointer" onClick={() => toggleSort("nombre_alimento")}>Insumo {sortBy.key === "nombre_alimento" ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}</th>
                  <th className="px-6 py-3 cursor-pointer" onClick={() => toggleSort("tipo")}>Categoría {sortBy.key === "tipo" ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}</th>
                  <th className="px-6 py-3">Proteína</th>
                  <th className="px-6 py-3 cursor-pointer" onClick={() => toggleSort("stock_kg")}>Stock {sortBy.key === "stock_kg" ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}</th>
                  <th className="px-6 py-3">Costo/kg</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((a) => (
                  <tr key={a.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700">{a.nombre_alimento}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase text-slate-500">{a.tipo}</span></td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{a.proteina_porcentaje ?? "—"}%</td>
                    <td className="px-6 py-4 font-black text-slate-800">{Number(a.stock_kg || 0).toLocaleString()} <span className="text-[10px] text-slate-300">kg</span></td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(a.costo_por_kg)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          const { id, created_at, updated_at, ...editableFields } = a;
                          setForm({ ...initialForm, ...editableFields });
                          setEditingId(id);
                          setShowForm(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600"
                        aria-label={`Editar ${a.nombre_alimento}`}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="p-2 text-red-400 hover:text-red-600" aria-label={`Eliminar ${a.nombre_alimento}`}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No hay insumos que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-slate-500">Página {page} de {totalPages}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(1)}                                          disabled={page === 1}          className="px-3 py-1 border rounded disabled:opacity-50">Primera</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}                 disabled={page === 1}          className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))}        disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Siguiente</button>
              <button onClick={() => setPage(totalPages)}                                disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Última</button>
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className={tab === "consumos" ? "block" : "hidden"}>
          <div className="p-4 border-b">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Registro de Consumos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-6">Cerdo (pigs_id)</th>
                  <th className="px-8 py-6">Alimento (alimentacion_id)</th>
                  <th className="px-8 py-6">Cantidad (kg)</th>
                  <th className="px-8 py-6">Lote</th>
                  <th className="px-8 py-6">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {consumos.map((c) => {
                  // Pequeño extra visual: Buscamos los nombres para que no se vean solo los números aburridos
                  const cerdo = pigs.find(p => p.id === c.pigs_id);
                  const alimento = alimentos.find(a => a.id === c.alimentacion_id);
                  
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-8 py-4 font-black text-slate-700 tabular-nums">
                        {cerdo ? (cerdo.codigo_arete || cerdo.nombre || c.pigs_id) : (c.pigs_id ?? <span className="text-slate-300 italic text-xs">—</span>)}
                      </td>
                      <td className="px-8 py-4 text-xs font-bold text-slate-500 tabular-nums">
                        {alimento ? alimento.nombre_alimento : (c.alimentacion_id ?? <span className="text-slate-300 italic">—</span>)}
                      </td>
                      <td className="px-8 py-4 font-black text-purple-600">
                        {parseFloat(c.cantidad_kg).toFixed(2)} kg
                      </td>
                      <td className="px-8 py-4 text-xs text-slate-400">
                        {c.lote ?? <span className="text-slate-200 italic">—</span>}
                      </td>
                      <td className="px-8 py-4 text-[10px] font-bold text-slate-300 uppercase">
                        {c.fecha ? new Date(c.fecha).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  )
                })}
                {consumos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400">No hay registros de consumo. Presione "Registrar Consumo" arriba para comenzar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculadora */}
        <div className={tab === "calculos" ? "grid grid-cols-1 md:grid-cols-2" : "hidden"}>
          <div className="p-8 border-r border-gray-100">
            <h3 className="text-lg font-black text-slate-800 mb-4 italic">Simulador de Ración Pro</h3>
            <form onSubmit={handleCalculadora} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Etapa Productiva</label>
                <select value={calc.etapa} onChange={(e) => setCalc({ ...calc, etapa: e.target.value })} className={inputClass}>
                  <option value="CRECIMIENTO">Crecimiento (1.85 kg/día)</option>
                  <option value="ENGORDE">Engorde (2.65 kg/día)</option>
                  <option value="LACTANCIA">Lactancia (5.80 kg/día)</option>
                  <option value="GESTACION">Gestación (2.25 kg/día)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Cerdos</label>
                  <input type="number" value={calc.cantidad} onChange={(e) => setCalc({ ...calc, cantidad: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Días</label>
                  <input type="number" value={calc.dias} onChange={(e) => setCalc({ ...calc, dias: e.target.value })} className={inputClass} />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-orange-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg">Proyectar Demanda</button>
            </form>
          </div>

          <div className="p-8 bg-slate-900 text-white flex flex-col justify-center items-center text-center">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4">Requerimiento Total</p>
            <h2 className="text-6xl font-black">{resCalc ?? "0.0"}</h2>
            <div className="mt-6 w-full max-w-xs h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: resCalc ? `${Math.min(100, (resCalc / Math.max(1, alimentos.reduce((acc, a) => acc + Number(a.stock_kg || 0), 0))) * 100)}%` : "0%" }} />
            </div>

            {calcDetails && (
              <div className="mt-6 p-4 bg-white/5 rounded-md w-full max-w-md">
                <p className="text-xs text-slate-200 font-bold">Detalles</p>
                <ul className="text-sm text-slate-200 mt-2 space-y-1">
                  <li>Factor por animal: <strong>{calcDetails.factor} kg/día</strong></li>
                  <li>Consumo por día (lote): <strong>{calcDetails.perDay} kg/día</strong></li>
                  <li>Consumo por animal (periodo): <strong>{calcDetails.perAnimal} kg</strong></li>
                  <li>Total proyectado: <strong>{calcDetails.total} kg</strong></li>
                  <li className="text-xs text-slate-400">Calculado: {new Date(calcDetails.timestamp).toLocaleString()}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-center pt-6">
        <div className="px-6 py-2 bg-white border border-gray-100 rounded-full flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">
            Servidor: alimentacion (Sincronizado) — {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================
   End of file
   ============================ */