/**
 * Middleware de Autenticación
 * Valida que el usuario tenga un token JWT válido
 */
import { verifyToken } from "../utils/jwt.js";

export const validateAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No autorizado. Token ausente o formato inválido."
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    // Adjuntar datos del usuario al request para uso en controllers
    // ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE PARA EL granja_id!
    req.user = {
      userId: decoded.id || decoded.userId,
      username: decoded.username,
      role: decoded.role,
      granja_id: decoded.granja_id 
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado. Inicie sesión nuevamente."
      });
    }
    return res.status(401).json({
      error: "Token inválido.",
      details: error.message
    });
  }
};

/**
 * Middleware para validar roles de usuario
 * @param {Array} allowedRoles - Roles permitidos ['ADMIN', 'USER']
 */
export const validateRole = (allowedRoles = []) => {
  return (req, res, next) => {
    const userRole = req.user?.role || "USER";

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "No tienes permisos para realizar esta acción"
      });
    }

    next();
  };
};

/**
 * Middleware de logging simple
 */
export const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};