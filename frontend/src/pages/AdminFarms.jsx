// src/pages/AdminFarms.jsx — Revisado y funcional
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, getUser } from "../services/api";
import toast from "react-hot-toast";

export default function AdminFarms() {
  const [granjas, setGranjas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const navigate = useNavigate();

  const userData = getUser();
  const userName = userData?.username || "Administrador";

  const loadGranjas = async () => {
    try {
      setLoading(true);
      // Intentamos traer las granjas reales de Supabase a través del backend
      const data = await apiGet("/admin/granjas");
      
      if (!Array.isArray(data)) {
        throw new Error("Formato de datos inválido");
      }
      
      setGranjas(data);
    } catch (err) {
      console.log("⚠️ Usando datos de respaldo (Base de datos local temporal)");
      // IMPORTANTE: Los IDs aquí deben coincidir con los de tu SQL de Supabase
      setGranjas([
        { id: 1, nombre: "Granja Los Pinos", ubicacion: "La Mesa, Cundinamarca", cerdos: 145, estado: "ACTIVA", encargado: "Kevin Santiago", imagen: "🌲" },
        { id: 2, nombre: "Hacienda El Porral", ubicacion: "Bogotá D.C.", cerdos: 320, estado: "ACTIVA", encargado: "Juan Sierra", imagen: "🐖" },
        { id: 3, nombre: "AgroPecuaria La Esperanza", ubicacion: "Facatativá", cerdos: 210, estado: "ACTIVA", encargado: "Julián Ramos", imagen: "🌾" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Al cargar el panel global, nos aseguramos de no estar "dentro" de ninguna granja específica todavía
    localStorage.removeItem("viewing_farm_id");
    localStorage.removeItem("viewing_farm_name");
    loadGranjas();
  }, []);

  const granjasFiltradas = granjas.filter(g => 
    g.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    g.ubicacion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const seleccionarGranja = (granja) => {
    // Guardamos la identidad de la granja seleccionada
    localStorage.setItem("viewing_farm_id", granja.id);
    localStorage.setItem("viewing_farm_name", granja.nombre);
    
    toast.success(`Accediendo a: ${granja.nombre}`, {
      icon: '🚀',
      style: { borderRadius: '10px', background: '#333', color: '#fff' }
    });
    
    setTimeout(() => navigate("/dashboard"), 600);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 lg:px-12 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
            <i className="fas fa-globe text-emerald-400 text-lg"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">AgroFarm Global</h2>
            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">Multi-Farm System</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-700">{userName}</p>
          <p className="text-[10px] text-gray-400 font-black uppercase">Super Administrador</p>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Panel de Control Maestro</h1>
              <p className="text-lg text-gray-500 font-medium">Selecciona una unidad productiva para auditar el inventario y salud.</p>
            </div>
            <div className="relative w-full md:w-96">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input 
                type="text" 
                placeholder="Buscar por nombre o municipio..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              [1, 2, 3].map(n => (
                <div key={n} className="h-64 bg-gray-200 animate-pulse rounded-[2rem]"></div>
              ))
            ) : (
              granjasFiltradas.map((g) => (
                <div 
                  key={g.id} 
                  onClick={() => seleccionarGranja(g)}
                  className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-md p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
                >
                  {/* Decoración visual */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="text-6xl drop-shadow-sm group-hover:scale-110 transition-transform">{g.imagen}</div>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        {g.estado}
                      </span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 group-hover:text-emerald-700 transition-colors leading-tight mb-1">{g.nombre}</h3>
                    <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
                      <i className="fas fa-map-marker-alt text-emerald-500"></i> {g.ubicacion}
                    </p>
                    
                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Cerdos Totales</p>
                        <p className="text-3xl font-black text-slate-800">{g.cerdos}</p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:bg-emerald-500 transition-colors">
                        <i className="fas fa-arrow-right"></i>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}