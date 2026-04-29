// src/pages/Login.jsx — Portal Unificado Anti-Bugs (Versión Definitiva con granja_id y Roles)
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login, register, getUser } from "../services/api"; 
import toast from "react-hot-toast";

/**
 * ============================================================================
 * PORTAL DE AUTENTICACIÓN MAESTRO - AGROFARM
 * ============================================================================
 * Diseño Premium conservado 100%. 
 * Lógica de renderizado estático con CSS ('hidden' / 'block') para evitar 
 * el error de React "Failed to execute 'removeChild'".
 * Incluye selector de Rol en el Registro y nomenclatura estricta 'granja_id'.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── 1. ESTADO MAESTRO DE VISTA ──
  const [isLoginMode, setIsLoginMode] = useState(location.pathname !== "/register");

  // ── 2. ESTADOS DE FORMULARIO ──
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    granja_id: "", // <--- CORREGIDO: Nomenclatura exacta de BD
    role: "USUARIO",
    acceptTerms: false,
    rememberMe: false
  });

  // ── 3. ESTADOS DE CONTROL Y UX ──
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // ── 4. EFECTOS DE LIMPIEZA ──
  useEffect(() => {
    localStorage.removeItem("viewing_farm_id");
  }, []);

  // Medidor de fuerza de contraseña interactivo
  useEffect(() => {
    if (!isLoginMode) {
      const pass = formData.password || "";
      let strength = 0;
      if (pass.length > 5) strength += 25;
      if (/[A-Z]/.test(pass)) strength += 25;
      if (/[0-9]/.test(pass)) strength += 25;
      if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
      setPasswordStrength(strength);
    }
  }, [formData.password, isLoginMode]);

  // ── 5. MANEJADOR UNIVERSAL DE INPUTS ──
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // Alternador de vistas con limpieza de estado 
  const toggleMode = () => {
    setIsLoginMode(prev => !prev);
    setFormData({
      username: "", email: "", password: "", confirmPassword: "", 
      granja_id: "", role: "USUARIO", acceptTerms: false, rememberMe: false
    });
    setShowPassword(false);
  };

  // ==========================================================================
  // ── 6. LÓGICA DE INICIO DE SESIÓN
  // ==========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password || !formData.granja_id) {
      toast.error("Todos los campos, incluido el ID de Granja, son obligatorios.");
      return;
    }

    setLoading(true);

    try { 
      await login({ username: formData.username, password: formData.password }); 
      
      const usuario = getUser();
      const userRole = usuario?.role?.trim().toUpperCase();
      const esKevin = usuario?.email === "kevinsantiagocardenaslozano@gmail.com";
      
      // Validación estricta de Granja usando la nomenclatura correcta
      if (!esKevin && usuario?.granja_id && parseInt(formData.granja_id) !== usuario.granja_id) {
        throw new Error("El ID de Granja ingresado no corresponde a tu perfil asignado.");
      }

      toast.success(`¡Acceso exitoso! Bienvenido, ${usuario.username}`, {
        icon: '🔑',
        style: { borderRadius: '15px', background: '#1e293b', color: '#fff' }
      });

      localStorage.setItem("current_farm_id", formData.granja_id);

      // Redirección inteligente
      if (esKevin || userRole === "SUPERADMIN") navigate("/administracion");
      else navigate("/dashboard");

    } catch (err) { 
      console.error("Error Login:", err);
      toast.error(err.message || "Credenciales incorrectas. Verifica tus datos."); 
      setLoading(false); 
    }
  };

  // ==========================================================================
  // ── 7. LÓGICA DE REGISTRO
  // ==========================================================================
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error("El correo electrónico es obligatorio."); return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden."); return;
    }
    if (!formData.acceptTerms) {
      toast.error("Debes aceptar los términos y condiciones."); return;
    }
    if (!formData.granja_id) { 
      toast.error("El ID de la Granja es obligatorio para el registro."); return;
    }

    setLoading(true);

    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        granja_id: parseInt(formData.granja_id), // <--- ENVÍO PERFECTO A BD
        role: formData.role 
      };

      await register(payload);
      toast.success(`¡Cuenta de ${payload.role} creada exitosamente! Iniciando sesión...`, { icon: "🐷" });
      
      setTimeout(async () => {
        try {
          await login({ username: payload.username, password: payload.password });
          localStorage.setItem("current_farm_id", payload.granja_id);
          navigate("/dashboard");
        } catch (loginErr) {
          setIsLoginMode(true);
          setLoading(false);
        }
      }, 1500);

    } catch (err) {
      toast.error(err.message || "Error al registrar la cuenta.");
      setLoading(false);
    }
  };

  // ==========================================================================
  // ── 8. RENDERIZADO DE INTERFAZ 
  // ==========================================================================
  return (
    <div className="min-h-screen flex bg-[#fdf6e9] font-sans selection:bg-emerald-200">
      
      {/* ── PANEL IZQUIERDO: BRANDING PREMIUM ESTÁTICO ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#1a7a4a] relative overflow-hidden flex-col justify-center px-16 xl:px-24 shadow-2xl z-10">
        
        {/* Decoraciones de Fondo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10%" cy="10%" r="150" fill="white" />
            <circle cx="90%" cy="90%" r="200" fill="white" />
          </svg>
        </div>

        <div className="relative z-10 animate-fade-in-up">
          <div className="flex items-center gap-6 mb-12">
            <img 
              src="/logo2.png" 
              alt="Logo AgroFarm" 
              className="w-24 h-24 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 border-white/20 bg-white" 
            />
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">AGROFARM</h1>
              <p className="text-emerald-300 font-bold uppercase tracking-[0.3em] text-xs mt-2">Elite Management</p>
            </div>
          </div>

          <h2 className="text-4xl text-white font-black leading-tight mb-8">
            <span className={isLoginMode ? "block" : "hidden"}>Bienvenido a tu centro de control.</span>
            <span className={!isLoginMode ? "block" : "hidden"}>Únete a la revolución porcina.</span>
          </h2>
          
          <p className="text-emerald-100 text-lg font-medium leading-relaxed mb-10 max-w-md">
            Gestiona tu patrimonio, monitorea la sanidad de tus animales y optimiza la producción con la herramienta más potente de Colombia.
          </p>

          <div className="grid grid-cols-1 gap-6">
            {[
              { icon: "fa-shield-halved", text: "Acceso Seguro por ID de Unidad" },
              { icon: "fa-layer-group", text: "Control Multi-Sede Centralizado" },
              { icon: "fa-bolt", text: "Sincronización en Tiempo Real" }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 text-emerald-100/90 hover:translate-x-2 transition-transform cursor-default">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/5 shadow-inner">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <span className="font-semibold text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-12 left-16 xl:left-24 text-emerald-200/40 text-[10px] font-bold uppercase tracking-widest">
          Desarrollado por Kevin Santiago &copy; 2026
        </div>
      </div>

      {/* ── PANEL DERECHO: FORMULARIOS DINÁMICOS ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-xl space-y-8 bg-white p-8 sm:p-12 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-500">
          
          {/* Cabecera del Formulario BLINDADA */}
          <div className="text-center lg:text-left space-y-3">
            <h3 className="text-4xl font-black text-slate-800 tracking-tight">
              <span className={isLoginMode ? "block" : "hidden"}>Iniciar Sesión</span>
              <span className={!isLoginMode ? "block" : "hidden"}>Crear Cuenta</span>
            </h3>
            <div className="text-slate-400 font-medium text-base">
              <span className={isLoginMode ? "block" : "hidden"}>Ingresa tus credenciales y el ID de tu granja para continuar.</span>
              <span className={!isLoginMode ? "block" : "hidden"}>Completa tus datos para vincularte a una unidad productiva.</span>
            </div>
          </div>

          <div className="relative">
            {/* ============================================================== */}
            {/* FORMULARIO DE LOGIN (Solo se oculta con CSS, nunca se borra)   */}
            {/* ============================================================== */}
            <div className={isLoginMode ? "block animate-fade-in" : "hidden"}>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Usuario</label>
                  <div className="group relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                      <i className="fas fa-user text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                    </div>
                    <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="santiago_dev"
                      className="w-full pl-16 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Contraseña</label>
                  <div className="group relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                      <i className="fas fa-lock text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                    </div>
                    <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="••••••••"
                      className="w-full pl-16 pr-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-600 transition-colors">
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-2 flex items-center gap-2">
                    ID de Unidad Productiva <i className="fas fa-shield-alt"></i>
                  </label>
                  <div className="group relative shadow-sm">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-600">
                      <i className="fas fa-tractor text-emerald-600 group-focus-within:text-white transition-colors"></i>
                    </div>
                    <input type="number" name="granja_id" value={formData.granja_id} onChange={handleChange} placeholder="Ej: 105"
                      className="w-full pl-16 pr-5 py-5 bg-emerald-50/50 border-2 border-emerald-200 rounded-[1.5rem] focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 outline-none transition-all font-black text-emerald-900 text-xl placeholder:text-emerald-200/80" />
                  </div>
                </div>

                <div className="flex items-center justify-between px-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} className="w-4 h-4 accent-emerald-600 rounded border-gray-300" />
                    <span className="text-xs font-bold text-slate-500">Recordarme</span>
                  </label>
                  <button type="button" className="text-xs font-black text-emerald-700 hover:text-emerald-800 transition-colors">¿Olvidaste tu clave?</button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-5 mt-4 bg-slate-900 text-white font-black rounded-[1.5rem] shadow-[0_15px_30px_rgba(15,23,42,0.2)] hover:bg-emerald-600 hover:shadow-[0_15px_30px_rgba(5,150,105,0.3)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:translate-y-0"
                >
                  <span className={loading ? "hidden" : "flex items-center justify-center gap-3 tracking-[0.2em] uppercase"}>
                    ENTRAR AL SISTEMA <i className="fas fa-arrow-right"></i>
                  </span>
                  <span className={loading ? "flex items-center justify-center gap-3" : "hidden"}>
                    <i className="fas fa-circle-notch fa-spin"></i> VERIFICANDO...
                  </span>
                </button>
              </form>
            </div>

            {/* ============================================================== */}
            {/* FORMULARIO DE REGISTRO (Solo se oculta con CSS, nunca se borra)*/}
            {/* ============================================================== */}
            <div className={!isLoginMode ? "block animate-fade-in" : "hidden"}>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Usuario</label>
                    <div className="group relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                        <i className="fas fa-user text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                      </div>
                      <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="santiago_dev"
                        className="w-full pl-16 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Correo</label>
                    <div className="group relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                        <i className="fas fa-envelope text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                      </div>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="correo@ejemplo.com"
                        className="w-full pl-16 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Contraseña</label>
                    <div className="group relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                        <i className="fas fa-lock text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                      </div>
                      <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="••••••••"
                        className="w-full pl-16 pr-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-600 transition-colors">
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    <div className={formData.password.length > 0 ? "block h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden mx-1" : "hidden"}>
                      <div className={`h-full transition-all duration-500 ${passwordStrength < 50 ? 'bg-rose-500' : passwordStrength < 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${passwordStrength}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">Confirmar</label>
                    <div className="group relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-100">
                        <i className="fas fa-check-double text-slate-400 group-focus-within:text-emerald-600 text-sm"></i>
                      </div>
                      <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••"
                        className="w-full pl-16 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  {/* ── CAMPO DE ID DE GRANJA (MITAD DE PANTALLA) ── */}
                  <div className="space-y-2 md:col-span-1 mt-2">
                    <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-2 flex items-center gap-2">
                      ID Granja <i className="fas fa-info-circle"></i>
                    </label>
                    <div className="group relative shadow-sm">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-600">
                        <i className="fas fa-tractor text-emerald-600 group-focus-within:text-white transition-colors"></i>
                      </div>
                      <input type="number" name="granja_id" value={formData.granja_id} onChange={handleChange} placeholder="Ej: 105"
                        className="w-full pl-16 pr-5 py-5 bg-emerald-50/50 border-2 border-emerald-200 rounded-[1.5rem] focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 outline-none transition-all font-black text-emerald-900 text-xl placeholder:text-emerald-200/80" />
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium px-3 mt-1 italic">* Código obligatorio de unidad.</div>
                  </div>

                  {/* ── SELECTOR DE ROL (MITAD DE PANTALLA) ── */}
                  <div className="space-y-2 md:col-span-1 mt-2">
                    <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-2 flex items-center gap-2">
                      Rol Asignado <i className="fas fa-user-tag"></i>
                    </label>
                    <div className="group relative shadow-sm">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-emerald-600">
                        <i className="fas fa-briefcase text-emerald-600 group-focus-within:text-white transition-colors"></i>
                      </div>
                      <select name="role" value={formData.role} onChange={handleChange}
                        className="w-full pl-16 pr-10 py-5 bg-emerald-50/50 border-2 border-emerald-200 rounded-[1.5rem] focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 outline-none transition-all font-black text-emerald-900 text-sm appearance-none cursor-pointer">
                        <option value="USUARIO">Usuario (Granjero)</option>
                        <option value="ADMINISTRADOR">Administrador</option>
                      </select>
                      <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none"></i>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium px-3 mt-1 italic">* Nivel de permisos en el sistema.</div>
                  </div>

                </div>

                <div className="flex items-center gap-3 px-2 pt-2">
                  <input type="checkbox" name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} className="w-5 h-5 accent-emerald-600 rounded border-gray-300" />
                  <span className="text-xs font-bold text-slate-500">
                    Acepto los <span className="text-emerald-600 underline cursor-pointer">Términos</span> y <span className="text-emerald-600 underline cursor-pointer">Políticas</span>.
                  </span>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-5 mt-4 bg-slate-900 text-white font-black rounded-[1.5rem] shadow-[0_15px_30px_rgba(15,23,42,0.2)] hover:bg-emerald-600 hover:shadow-[0_15px_30px_rgba(5,150,105,0.3)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:translate-y-0"
                >
                  <span className={loading ? "hidden" : "flex items-center justify-center gap-3 tracking-[0.2em] uppercase"}>
                    REGISTRARME AHORA <i className="fas fa-arrow-right"></i>
                  </span>
                  <span className={loading ? "flex items-center justify-center gap-3" : "hidden"}>
                    <i className="fas fa-circle-notch fa-spin"></i> CREANDO CUENTA...
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* ── BOTÓN ALTERNADOR ── */}
          <div className="text-center pt-8 border-t border-slate-100">
            <div className="text-sm text-slate-500 font-medium">
              <span className={isLoginMode ? "inline" : "hidden"}>¿Eres un nuevo integrante?</span>
              <span className={!isLoginMode ? "inline" : "hidden"}>¿Ya tienes una cuenta registrada?</span>
              <button 
                type="button" 
                onClick={toggleMode} 
                className="text-emerald-700 font-black ml-2 hover:text-emerald-800 transition-colors cursor-pointer"
              >
                <span className={isLoginMode ? "inline" : "hidden"}>Regístrate aquí</span>
                <span className={!isLoginMode ? "inline" : "hidden"}>Inicia sesión aquí</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}