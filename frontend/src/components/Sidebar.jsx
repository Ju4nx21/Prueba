// src/components/Sidebar.jsx — Menú lateral premium con sección VIP
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../services/api"; // <-- Importamos getUser

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  const navigate = useNavigate();
  
  // ── LÓGICA DE ROLES ──
  const usuario = getUser();
  const esSuperAdmin = usuario?.role === "SUPERADMIN" || usuario?.role === "ADMIN";

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const links = [
    { to: "/dashboard", label: "Panel Principal", icon: "fa-chart-pie", end: true },
    { to: "/dashboard/sanidad", label: "Sanidad", icon: "fa-heart-pulse" },
    { to: "/dashboard/reproduccion", label: "Reproducción", icon: "fa-dna" },
    { to: "/dashboard/produccion", label: "Producción", icon: "fa-chart-line" },
    { to: "/dashboard/nutricion", label: "Nutrición", icon: "fa-apple-whole" },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo original AGROFARM */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <img src="/logo2.png" alt="AGROFARM" className="w-16 h-16 rounded-xl object-cover shadow-2xl" />
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">AGROFARM</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Gestión Porcina</p>
          </div>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        
        {/* SECCIÓN VIP: SOLO PARA TI Y TUS COMPAÑEROS ADMINS */}
        {esSuperAdmin && (
          <div className="mb-6">
            <p className="px-3 mb-3 text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-crown text-[8px]"></i> Administración
            </p>
            <NavLink
              to="/administracion"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300
                ${isActive
                  ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10"
                  : "text-amber-200/60 hover:bg-amber-500/10 hover:text-amber-300"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-300
                    ${isActive
                      ? "bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-md shadow-amber-500/40"
                      : "bg-slate-800 text-amber-500/70 border border-amber-500/20"
                    }`}>
                    <i className="fas fa-globe"></i>
                  </div>
                  <span>Panel Global</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse"></div>
                  )}
                </>
              )}
            </NavLink>
          </div>
        )}

        <p className="px-3 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Módulos</p>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
                ? "bg-gradient-to-r from-emerald-500/20 to-green-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10 border border-emerald-500/20"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200
                  ${isActive
                    ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                  }`}>
                  <i className={`fas ${link.icon}`}></i>
                </div>
                <span>{link.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></div>
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-4 mt-4 border-t border-slate-700/50">
          <p className="px-3 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cuenta</p>
          <NavLink
            to="/dashboard/perfil"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
                ? "bg-gradient-to-r from-emerald-500/20 to-green-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200
                  ${isActive ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md" : "bg-slate-800 text-slate-400"}`}>
                  <i className="fas fa-user"></i>
                </div>
                <span>Mi Perfil</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-xs">
            <i className="fas fa-right-from-bracket text-red-400"></i>
          </div>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-[260px] bg-slate-900 border-r border-slate-800 min-h-screen flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCloseMobile}></div>
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-slate-900 shadow-2xl">
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}