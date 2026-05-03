import { pool } from "../config/db.js";

// ─── GET ALL ──────────────────────────────────────────────────────────────────
export const getSanidad = async (req, res) => {
  try {
    const { granja_id } = req.user; // viene del JWT via validateAuth
    const { rows } = await pool.query(
      `SELECT s.*, p.codigo_arete, p.sexo, p.raza
       FROM sanidad s
       LEFT JOIN pigs p ON s.pig_id = p.id
       WHERE s.granja_id = $1
       ORDER BY s.fecha DESC`,
      [granja_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
export const getSanidadById = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;
    const { rows } = await pool.query(
      `SELECT s.*, p.codigo_arete, p.sexo, p.raza
       FROM sanidad s
       LEFT JOIN pigs p ON s.pig_id = p.id
       WHERE s.id = $1 AND s.granja_id = $2`,
      [id, granja_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET BY PIG ───────────────────────────────────────────────────────────────
export const getSanidadByPig = async (req, res) => {
  try {
    const { pig_id } = req.params;
    const { rows } = await pool.query(
      `SELECT s.*, p.codigo_arete
       FROM sanidad s
       LEFT JOIN pigs p ON s.pig_id = p.id
       WHERE s.pig_id = $1
       ORDER BY s.fecha DESC`,
      [pig_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
export const createSanidad = async (req, res) => {
  try {
    const { granja_id } = req.user;
    const {
      pig_id, tipo, fecha, medicamento_vacuna, dosis,
      via_administracion, veterinario, diagnostico, tratamiento,
      costo, proxima_aplicacion, observaciones,
      estado = "PENDIENTE"
    } = req.body;

    // Validar campos requeridos
    if (!pig_id) return res.status(400).json({ error: "El cerdo es requerido." });
    if (!tipo)   return res.status(400).json({ error: "El tipo es requerido." });
    if (!fecha)  return res.status(400).json({ error: "La fecha es requerida." });

    // Validar que el cerdo existe y pertenece a la granja
    const pigCheck = await pool.query(
      "SELECT id FROM pigs WHERE id = $1 AND granja_id = $2",
      [pig_id, granja_id]
    );
    if (pigCheck.rows.length === 0) {
      return res.status(404).json({ error: "El cerdo especificado no existe en esta granja." });
    }

    // Para VACUNA y TRATAMIENTO exigir medicamento
    if (["VACUNA", "TRATAMIENTO", "DESPARASITACION"].includes(tipo) && !medicamento_vacuna) {
      return res.status(400).json({ error: "Debe especificar un medicamento o vacuna para este tipo." });
    }

    const { rows } = await pool.query(
      `INSERT INTO sanidad
         (pig_id, granja_id, tipo, fecha, medicamento_vacuna, dosis, via_administracion,
          veterinario, diagnostico, tratamiento, costo, proxima_aplicacion, observaciones, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        pig_id, granja_id, tipo, fecha, medicamento_vacuna || null, dosis || null,
        via_administracion || "INTRAMUSCULAR", veterinario || null, diagnostico || null,
        tratamiento || null, costo || null, proxima_aplicacion || null,
        observaciones || null, estado
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error en createSanidad:", error);
    res.status(500).json({ error: "Error interno del servidor", detail: error.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export const updateSanidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;
    const {
      pig_id, tipo, fecha, medicamento_vacuna, dosis,
      via_administracion, veterinario, diagnostico, tratamiento,
      costo, proxima_aplicacion, observaciones,
      estado = "PENDIENTE"
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE sanidad
       SET pig_id            = $1,
           tipo              = $2,
           fecha             = $3,
           medicamento_vacuna= $4,
           dosis             = $5,
           via_administracion= $6,
           veterinario       = $7,
           diagnostico       = $8,
           tratamiento       = $9,
           costo             = $10,
           proxima_aplicacion= $11,
           observaciones     = $12,
           estado            = $13
       WHERE id = $14 AND granja_id = $15
       RETURNING *`,
      [
        pig_id, tipo, fecha, medicamento_vacuna || null, dosis || null,
        via_administracion || "INTRAMUSCULAR", veterinario || null, diagnostico || null,
        tratamiento || null, costo || null, proxima_aplicacion || null,
        observaciones || null, estado, id, granja_id
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
export const deleteSanidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;
    const { rows } = await pool.query(
      "DELETE FROM sanidad WHERE id = $1 AND granja_id = $2 RETURNING *",
      [id, granja_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ message: "Registro eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── PRÓXIMAS APLICACIONES ────────────────────────────────────────────────────
export const getProximasAplicaciones = async (req, res) => {
  try {
    const { granja_id } = req.user;
    const { rows } = await pool.query(
      `SELECT s.*, p.codigo_arete
       FROM sanidad s
       LEFT JOIN pigs p ON s.pig_id = p.id
       WHERE s.proxima_aplicacion >= CURRENT_DATE
         AND s.granja_id = $1
       ORDER BY s.proxima_aplicacion ASC
       LIMIT 20`,
      [granja_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};