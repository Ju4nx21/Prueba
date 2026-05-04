import { Router } from "express";
import { getGranjas } from "../controllers/admin.controller.js";
import { validateAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Protegemos la ruta con tu middleware
router.use(validateAuth);

// Esta ruta será /api/admin/granjas
router.get("/granjas", getGranjas);

export default router;