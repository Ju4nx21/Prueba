import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";

// Actualizar perfil del usuario
export const updatePerfil = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_completo,
      email,
      telefono,
      cargo
    } = req.body;

    // Lógica para la foto:
    let avatar_url = null; 
    
    // Si Multer atrapó una imagen, armamos la ruta
    if (req.file) {
      avatar_url = `/uploads/profiles/${req.file.filename}`;
    }

    // Usamos COALESCE en SQL: Si $4 (avatar_url) es NULL, deja el avatar que ya tenía en la BD
    const { rows } = await pool.query(
      `UPDATE users 
       SET nombre_completo = $1, 
           email = $2, 
           telefono = $3, 
           avatar_url = COALESCE($4, avatar_url), 
           cargo = $5, 
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, role, nombre_completo, email, telefono, avatar_url, cargo, created_at, updated_at`,
      [nombre_completo, email, telefono, avatar_url, cargo, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar perfil del usuario
export const updatePerfil = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_completo,
      email,
      telefono,
      avatar_url,
      cargo
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE users 
       SET nombre_completo = $1, email = $2, telefono = $3, avatar_url = $4, cargo = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, role, nombre_completo, email, telefono, avatar_url, cargo, created_at, updated_at`,
      [nombre_completo, email, telefono, avatar_url, cargo, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cambiar contraseña
export const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Contraseñas son requeridas" });
    }

    // Verificar contraseña actual
    const { rows } = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(password_nueva, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, id]
    );

    res.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Subir avatar (simulado - en producción usarías un servicio de almacenamiento)
export const uploadAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ error: "URL del avatar es requerida" });
    }

    const { rows } = await pool.query(
      `UPDATE users 
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, avatar_url`,
      [avatar_url, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
