import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { apiPut, apiPost, getUser } from "../services/api";

export default function Perfil() {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [formData, setFormData] = useState({ nombre_completo: "", email: "", telefono: "", cargo: "" });
  const [passwordData, setPasswordData] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [loading, setLoading] = useState(true);
  
  
  // Nuevo estado para la foto de perfil
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try { 
        const local = getUser(); 
        if (local) { 
          setUser(local); 
          setFormData({ 
            nombre_completo: local.nombre_completo || "", 
            email: local.email || "", 
            telefono: local.telefono || "", 
            cargo: local.cargo || "" 
          });
          // Si ya tiene una foto guardada en BD, la cargamos
          if (local.avatar_url) setAvatarPreview(local.avatar_url);
        }
      } catch(err) {
        toast.error("Error al cargar perfil");
      } finally { 
        setLoading(false); 
      }
    };
    load();
  }, []);

  // Manejador para cuando seleccionan una imagen
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen no debe superar los 2MB");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try { 
      const currentUser = getUser();
      if (!currentUser?.id) {
        toast.error("Usuario no identificado");
        return;
      }

      // NOTA: Si envías un archivo, necesitas usar FormData en lugar de un JSON normal.
      // Dependiendo de cómo esté tu apiPut, podrías necesitar ajustarlo.
      let dataToSend = formData;
      if (selectedFile) {
        const formDataObj = new FormData();
        Object.keys(formData).forEach(key => formDataObj.append(key, formData[key]));
        formDataObj.append('avatar', selectedFile);
        dataToSend = formDataObj; // Asegúrate de que apiPut soporte FormData si hay archivo
      }

      const updated = await apiPut(`/perfil/${currentUser.id}`, dataToSend); 
      setUser({...currentUser, ...updated}); 
      localStorage.setItem("user", JSON.stringify({...currentUser, ...updated}));
      setIsEditing(false); 
      toast.success("Perfil actualizado exitosamente"); 
    } catch (err) { 
      toast.error(err.message || "Error al actualizar perfil"); 
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) { 
      toast.error("Las contraseñas no coinciden"); 
      return; 
    }
    try { 
      const currentUser = getUser();
      await apiPost(`/perfil/${currentUser.id}/password`, { 
        password_actual: passwordData.current_password, 
        password_nueva: passwordData.new_password 
      }); 
      toast.success("Contraseña actualizada"); 
      setShowPasswordForm(false); 
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" }); 
    }
    catch (err) { 
      toast.error(err.message || "Error al cambiar contraseña"); 
    }
  };
  

  const inputClass = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all";


  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="h-44 bg-white/50 rounded-2xl border border-white/20 animate-pulse"></div>
      <div className="h-60 bg-white/50 rounded-2xl border border-white/20 animate-pulse"></div>
    </div>
  );
  

  const userName = user?.nombre_completo || user?.username || "Usuario";
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1b2522] to-[#2c3e38] flex items-center justify-center shadow-lg">
              <i className="fas fa-user-circle text-[#f4d084]"></i>
            </div>
            Mi Perfil
          </h1>
          <p className="text-gray-600 mt-1">Gestiona tu información personal y de seguridad</p>
        </div>
        <button onClick={() => setIsEditing(!isEditing)}
          className={isEditing
            ? "px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
            : "inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#176a38] to-[#1e8a49] text-white text-sm font-semibold rounded-xl shadow-lg shadow-green-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          }>
          <i className={`fas ${isEditing ? "fa-times" : "fa-pen"}`}></i>
          {isEditing ? "Cancelar Edición" : "Editar Perfil"}
        </button>
      </div>

      {/* ── Profile Card ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[#176a38] via-[#1e8a49] to-[#2c3e38] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        </div>
        
        <div className="px-6 sm:px-10 pb-8 -mt-16 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            
            {/* Contenedor del Avatar */}
            <div className="relative group">
              <div 
                className={`w-32 h-32 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-xl border-4 border-white overflow-hidden bg-gradient-to-br from-[#176a38] to-[#1e8a49] ${isEditing ? 'cursor-pointer' : ''}`}
                onClick={() => isEditing && fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
                
                {/* Overlay de hover al editar */}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <i className="fas fa-camera text-2xl mb-1"></i>
                    <span className="text-xs font-medium">Cambiar</span>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/jpeg, image/png, image/webp" 
                className="hidden" 
              />
            </div>

            <div className="pb-2 flex-1 min-w-0">
              <h3 className="text-2xl font-extrabold text-slate-800 truncate">{userName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-1 bg-[#176a38]/10 text-[#176a38] text-xs font-bold rounded-lg border border-[#176a38]/20">
                  {user?.cargo || "Sin cargo"}
                </span>
                <p className="text-sm text-gray-500 truncate">@{user?.username || "user"}</p>
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <form onSubmit={handleUpdateProfile} className="px-6 sm:px-10 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre Completo</label><input type="text" value={formData.nombre_completo} onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })} className={inputClass} placeholder="Ej. Juan Pérez" /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="correo@ejemplo.com"/></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label><input type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputClass} placeholder="300 000 0000"/></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Cargo</label><select value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} className={inputClass}><option value="">Seleccione cargo...</option><option value="Administrador">Administrador</option><option value="Veterinario">Veterinario</option><option value="Técnico">Técnico</option><option value="Operario">Operario</option><option value="Propietario">Propietario</option><option value="Supervisor">Supervisor</option></select></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-gray-100">
              <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">Cancelar</button>
              <button type="submit" className="inline-flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-[#176a38] to-[#1e8a49] text-white text-sm font-semibold rounded-xl shadow-lg shadow-green-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"><i className="fas fa-save"></i>Guardar Cambios</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Info ── */}
      {!isEditing && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 pb-4 mb-6 border-b border-gray-100">
            <i className="fas fa-address-card text-[#176a38]"></i>Datos de Contacto
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
            {[{ l: "Nombre Completo", v: user?.nombre_completo, i: "fa-user" }, { l: "Correo Electrónico", v: user?.email, i: "fa-envelope" }, { l: "Número de Teléfono", v: user?.telefono, i: "fa-phone" }, { l: "Rol en AgroFarm", v: user?.cargo, i: "fa-briefcase" }].map(f => (
              <div key={f.l} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <i className={`fas ${f.i} text-gray-400 text-sm`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5 font-medium uppercase tracking-wide">{f.l}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{f.v || "No definido"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Security ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 mb-6 border-b border-gray-100">
          <div>
            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <i className="fas fa-shield-halved text-[#176a38]"></i>Seguridad de la Cuenta
            </h4>
          </div>
          <button onClick={() => setShowPasswordForm(!showPasswordForm)} className={showPasswordForm ? "px-5 py-2.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-all w-full sm:w-auto text-center" : "inline-flex justify-center items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-md hover:bg-slate-900 transition-all duration-300 w-full sm:w-auto"}>
            <i className={`fas ${showPasswordForm ? "fa-times" : "fa-key"}`}></i>{showPasswordForm ? "Cancelar Cambio" : "Modificar Contraseña"}
          </button>
        </div>
        
        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña actual</label><input type="password" value={passwordData.current_password} onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })} className={inputClass} required placeholder="Ingresa tu contraseña actual"/></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Nueva contraseña</label><input type="password" value={passwordData.new_password} onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })} className={inputClass} required minLength="6" placeholder="Mínimo 6 caracteres"/></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar nueva contraseña</label><input type="password" value={passwordData.confirm_password} onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })} className={inputClass} required minLength="6" placeholder="Repite la nueva contraseña"/></div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="inline-flex items-center gap-2 px-8 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-lg hover:bg-slate-900 hover:-translate-y-0.5 transition-all duration-300 w-full sm:w-auto justify-center"><i className="fas fa-lock"></i>Actualizar Contraseña</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
            </div>
            <p className="text-sm text-slate-700">Tu cuenta está protegida con cifrado de extremo a extremo. Te recomendamos cambiar tu contraseña periódicamente por seguridad.</p>
          </div>
        )}
      </div>
    </div>
  );
}