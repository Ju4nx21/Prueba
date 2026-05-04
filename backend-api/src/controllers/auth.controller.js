import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { generateToken } from "../utils/jwt.js";

export async function register(req, res) {
  // Recibimos granja_id y Carga desde el frontend (React)
  const { username, password, role, Carga, granja_id } = req.body;
  
  // Sincronizamos el rol: Si mandan Carga, lo usamos, si no, usamos role. Por defecto 'USER'
  const finalRole = Carga || role || "USER";
  
  if (!username || !password) {
    return res.status(400).json({ error: "username y password son obligatorios" });
  }

  try {
    const existing = await query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "El usuario ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // INSERTAMOS el granja_id en la base de datos
    const { rows } = await query(
      "INSERT INTO users (username, password_hash, role, granja_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, granja_id, nombre_completo, email, telefono, cargo, avatar_url, created_at",
      [username, passwordHash, finalRole, granja_id || null]
    );

    const usuario = rows[0];
    const token = generateToken(usuario);

    res.status(201).json({ mensaje: "Usuario registrado", token, usuario });
  } catch (err) {
    res.status(500).json({ error: "Error registrando usuario", detail: err.message });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "username y password son obligatorios" });
  }

  try {
    // AGREGAMOS granja_id AL SELECT PARA EXTRAERLO DE LA BASE DE DATOS
    const { rows } = await query(
      "SELECT id, username, role, granja_id, password_hash, nombre_completo, email, telefono, cargo, avatar_url, created_at FROM users WHERE username = $1",
      [username]
    );
    
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    // INCLUIMOS EL granja_id EN EL OBJETO DEL USUARIO QUE VA AL TOKEN
    const usuario = { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      granja_id: user.granja_id, 
      nombre_completo: user.nombre_completo,
      email: user.email,
      telefono: user.telefono,
      cargo: user.cargo,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    };
    
    const token = generateToken(usuario);
    res.json({ mensaje: "Login OK", token, usuario });
  } catch (err) {
    res.status(500).json({ error: "Error en login", detail: err.message });
  }
}