import { Router } from "express";
import { validateAuth } from "../middlewares/auth.middleware.js";
import {
  getServicios,
  getServicioById,
  createServicio,
  updateServicio,
  deleteServicio,
  getPartos,
  getPartoById,
  createParto,
  updateParto,
  deleteParto,
  getStats,
} from "../controllers/reproduccion.controller.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(validateAuth);

// ── Estadísticas ─────────────────────────────────────────────────────────────
router.get("/stats", getStats);

// ── Servicios (montas / inseminaciones) ──────────────────────────────────────
// IMPORTANTE: las rutas estáticas van ANTES de las dinámicas (/:id)
router.get("/servicios",      getServicios);
router.get("/servicios/:id",  getServicioById);
router.post("/servicios",     createServicio);
router.put("/servicios/:id",  updateServicio);
router.delete("/servicios/:id", deleteServicio);

// ── Partos ───────────────────────────────────────────────────────────────────
router.get("/partos",         getPartos);
router.get("/partos/:id",     getPartoById);
router.post("/partos",        createParto);
router.put("/partos/:id",     updateParto);
router.delete("/partos/:id",  deleteParto);

export default router;