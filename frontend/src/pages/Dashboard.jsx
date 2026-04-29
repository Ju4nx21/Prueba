// src/pages/Dashboard.jsx — Versión Estable (Anti-Bucle)
import { useState, useEffect, useCallback, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import PigForm from "../components/PigForm";
import PigList from "../components/PigList";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, getUser } from "../services/api";

export default function Dashboard() {
  // ── 1. ESTADOS PRINCIPALES ──
  const [pigs, setPigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ── 2. ESTADOS DE FORMULARIO ──
  const [showPigForm, setShowPigForm] = useState(false);
  const [editingPig, setEditingPig] = useState(null);
  
  // ── 3. ESTADOS DE FILTROS ──
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS"); 
  const [filtroSexo, setFiltroSexo] = useState("TODOS");     

  const location = useLocation();
  const navigate = useNavigate();
  const isNested = location.pathname !== "/dashboard";

  // ── 4. MEMORIZACIÓN DE DATOS DE USUARIO (PARA EVITAR BUCLES) ──
  const userData = useMemo(() => getUser(), []);
  const farmIdSeleccionado = localStorage.getItem("viewing_farm_id");
  const farmName = localStorage.getItem("viewing_farm_name");
  const currentFarmId = farmIdSeleccionado || userData?.granja_id;

  // ── 5. LÓGICA DE CARGA (MEMORIZADA) ──
  const loadPigs = useCallback(async () => {
    if (!currentFarmId && !userData) return;
    try { 
      setLoading(true); 
      const url = currentFarmId ? `/pigs?granja_id=${currentFarmId}` : "/pigs";
      const data = await apiGet(url); 
      setPigs(Array.isArray(data) ? data : []); 
    }
    catch (err) { 
      setError(err.message || "Error de conexión");
    }
    finally { 
      setLoading(false); 
    }
  }, [currentFarmId, userData]);

  useEffect(() => { 
    if (!userData && !farmIdSeleccionado) {
      navigate("/login");
    } else {
      loadPigs(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFarmId]); // Solo se dispara si cambia la granja

  // ── 6. LÓGICA DE FILTRADO ──
  const cerdosFiltrados = pigs.filter(cerdo => {
    const coincideTexto = 
      cerdo.codigo_arete?.toLowerCase().includes(busqueda.toLowerCase()) ||
      cerdo.raza?.toLowerCase().includes(busqueda.toLowerCase());
    const coincideEstado = filtroEstado === "TODOS" ? true : cerdo.estado === filtroEstado;
    const coincideSexo = filtroSexo === "TODOS" ? true :
      (filtroSexo === "HEMBRA" ? ["H", "Hembra", "F"].includes(cerdo.sexo) : ["M", "Macho"].includes(cerdo.sexo));
    return coincideTexto && coincideEstado && coincideSexo;
  });

  // ── 7. CRUD ──
  const handleAddPig = async (nuevoCerdo) => {
    try { 
      const payload = { ...nuevoCerdo, granja_id: currentFarmId };
      if (editingPig) {
        await apiPut(`/pigs/${editingPig.id}`, payload); 
        toast.success("Actualizado"); 
        setEditingPig(null);
      } else {
        await apiPost("/pigs", payload); 
        toast.success("Registrado"); 
      }
      setShowPigForm(false); 
      loadPigs(); 
    }
    catch (err) { toast.error("Error al guardar"); }
  };

  const handleEditPig = (pig) => {
    setEditingPig(pig);
    setShowPigForm(true);
  };

  const handleDeletePig = async (id) => {
    if (!window.confirm("¿Eliminar cerdo?")) return;
    try {
      await apiDelete(`/pigs/${id}`);
      toast.success("Eliminado");
      loadPigs();
    } catch (err) { toast.error("Error al eliminar"); }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "ACTIVO" ? "INACTIVO" : "ACTIVO";
      await apiPatch(`/pigs/${id}/status`, { estado: newStatus });
      toast.success(`Estado: ${newStatus}`); 
      loadPigs();
    } catch (err) { toast.error("Error al actualizar"); }
  };

  // ── 8. HERRAMIENTAS ──
  const handleExportExcel = () => toast.success("Exportando...");
  const handlePrintReport = () => window.print();

  // ── 9. UI DINÁMICA ──
  const getSectionTitle = () => {
    const path = location.pathname.split("/").pop();
    const map = { sanidad: "Sanidad", reproduccion: "Reproducción", produccion: "Producción", nutricion: "Nutrición", perfil: "Perfil" };
    return map[path] || "Panel Principal";
  };

  const userName = userData?.username || "Usuario";
  const activePigs = pigs.filter(p => p.estado === "ACTIVO").length;
  const femalePigs = pigs.filter(p => ["H", "Hembra", "F"].includes(p.sexo)).length;
  const avgWeight = pigs.length > 0 
    ? (pigs.reduce((sum, p) => sum + (parseFloat(p.peso_actual) || 0), 0) / pigs.length).toFixed(1) 
    : 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar isMobileOpen={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="sticky top-0 z-10 h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><i className="fas fa-bars"></i></button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md"><i className="fas fa-chart-pie text-white text-sm"></i></div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{farmName || getSectionTitle()}</h2>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-tighter">Agrofarm · {farmIdSeleccionado ? 'Auditoría' : 'Gestión'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {farmIdSeleccionado && (
              <button onClick={() => { localStorage.removeItem("viewing_farm_id"); navigate("/administracion"); }} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-all">
                <i className="fas fa-arrow-left"></i> Salir de Global
              </button>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-sm font-semibold text-slate-700">{userName}</p>
              <p className="text-[11px] text-emerald-600 font-semibold uppercase">{userData?.role || 'Granjero'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md">{userName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {isNested ? <Outlet context={{ currentFarmId }} /> : (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800">{farmIdSeleccionado ? `Monitoreando: ${farmName}` : `¡Hola, ${userName}!`} 👋</h1>
                  <p className="text-gray-500 mt-1">Gestión integral de producción porcina.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: "Total Cerdos", value: pigs.length, color: "emerald", icon: "fa-paw" },
                  { label: "Activos", value: activePigs, color: "blue", icon: "fa-check-circle" },
                  { label: "Hembras", value: femalePigs, color: "pink", icon: "fa-venus" },
                  { label: "Peso Promedio", value: `${avgWeight} kg`, color: "amber", icon: "fa-weight-hanging" }
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 group hover:-translate-y-1 transition-all duration-300">
                    <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center mb-4 transition-colors group-hover:bg-${s.color}-600 group-hover:text-white`}>
                      <i className={`fas ${s.icon}`}></i>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-800">{loading ? "..." : s.value}</p>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-white">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md"><i className="fas fa-list text-emerald-400"></i></div>
                      <div><h3 className="text-lg font-bold text-slate-800">Inventario General</h3><p className="text-xs text-gray-400 font-bold">ID GRANJA: {currentFarmId || '0'}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                      <div className="relative flex-1 min-w-[200px]">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input type="text" placeholder="Buscar arete..." className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                      </div>
                      <select className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-600" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                        <option value="TODOS">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option>
                      </select>
                      <select className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-600" value={filtroSexo} onChange={e => setFiltroSexo(e.target.value)}>
                        <option value="TODOS">Ambos Sexos</option><option value="HEMBRA">Hembras</option><option value="MACHO">Machos</option>
                      </select>
                      <button onClick={handleExportExcel} className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-emerald-600 transition-colors"><i className="fas fa-file-excel"></i></button>
                      <button onClick={handlePrintReport} className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 transition-colors"><i className="fas fa-print"></i></button>
                      <button onClick={() => { setShowPigForm(!showPigForm); setEditingPig(null); }} className="ml-auto xl:ml-0 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg hover:scale-105 transition-all">
                        {showPigForm ? "Cancelar" : "+ Nuevo Registro"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {showPigForm && (
                    <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <i className="fas fa-plus-circle text-emerald-600"></i> {editingPig ? "Editar Cerdo" : "Nuevo Cerdo"}
                      </h3>
                      <PigForm onAddPig={handleAddPig} initialData={editingPig} />
                    </div>
                  )}

                  {loading && <div className="space-y-4 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl"></div>)}</div>}
                  {error && <div className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center font-bold">Error: {error}</div>}
                  {!loading && !error && cerdosFiltrados.length === 0 && <div className="text-center py-16 text-slate-400 font-bold">No se encontraron resultados</div>}
                  {!loading && !error && cerdosFiltrados.length > 0 && <PigList pigs={cerdosFiltrados} onToggleStatus={handleToggleStatus} onEdit={handleEditPig} onDelete={handleDeletePig} />}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}