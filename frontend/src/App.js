// src/App.js — Revisado, Protegido y Sincronizado
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login"; // <--- Nuestro súper componente unificado
// Borramos la importación de Register porque Login ya hace ambas cosas
import Dashboard from "./pages/Dashboard";
import Sanidad from "./pages/Sanidad";
import Reproduccion from "./pages/Reproduccion";
import Produccion from "./pages/Produccion";
import Nutricion from "./pages/Nutricion";
import Perfil from "./pages/Perfil";
import AdminFarms from "./pages/AdminFarms"; 
import PrivateRoute from "./routes/PrivateRoute";

import { getUser } from "./services/api"; 
import { Toaster } from 'react-hot-toast';

export default function App() {
  const usuario = getUser();
  
  // 1. Normalizamos el rol gracias a nuestro nuevo api.js
  const userRole = usuario?.role?.trim().toUpperCase();
  
  // 2. Validación Maestra: Entras si eres Admin o si el correo es el tuyo
  const esSuperAdmin = userRole === "SUPERADMIN" || 
                       userRole === "ADMIN" || 
                       userRole === "ADMINISTRADOR" || // Por si acaso en BD queda así
                       usuario?.email === "kevinsantiagocardenaslozano@gmail.com";

  // Debug en consola para nosotros los desarrolladores
  console.log("🛡️ Seguridad AgroFarm:", { 
    user: usuario?.email, 
    role: userRole, 
    permitido: esSuperAdmin 
  });

  return (
    <BrowserRouter>
      {/* Notificaciones globales (Diseño Premium) */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: { background: '#333', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }
        }} 
      />

      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 🟡 ATENCIÓN AQUÍ: Ambas rutas usan el mismo componente maestro */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* 🔴 ÁREA MAESTRA: Selección de Granjas (Solo personal autorizado) */}
        <Route 
          path="/administracion" 
          element={
            <PrivateRoute>
              {esSuperAdmin ? <AdminFarms /> : <Navigate to="/dashboard" replace />}
            </PrivateRoute>
          } 
        />

        {/* 🟢 ÁREA OPERATIVA: Gestión de la Granja actual */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        >
          {/* Estas sub-rutas se renderizan dentro del Outlet del Dashboard */}
          <Route path="sanidad" element={<Sanidad />} />
          <Route path="reproduccion" element={<Reproduccion />} />
          <Route path="produccion" element={<Produccion />} />
          <Route path="nutricion" element={<Nutricion />} />
          <Route path="perfil" element={<Perfil />} />
          
          {/* Si escriben algo raro en el dashboard, regresan al inicio del panel */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Error 404: Si la ruta no existe, al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}