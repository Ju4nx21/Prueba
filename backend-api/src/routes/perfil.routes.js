import { Router } from "express";
import { validateAuth } from "../middlewares/auth.middleware.js";
// IMPORTANTE: Importa el archivo upload.js que creamos en el paso 2
// (Asegúrate de que la ruta sea la correcta según tus carpetas)
import upload from "../middlewares/upload.js"; 
import {
  getPerfil,
  updatePerfil,
  cambiarPassword,
  uploadAvatar
} from "../controllers/perfil.controller.js";

const router = Router();

// Todas las rutas de perfil requieren autenticación
router.use(validateAuth);

router.get("/", getPerfil);

// AQUÍ ESTÁ LA MAGIA: Agregamos upload.single('avatar') en la ruta PUT
router.put("/:id", upload.single('avatar'), updatePerfil);

router.post("/:id/password", cambiarPassword);
router.post("/:id/avatar", uploadAvatar);

export default router;