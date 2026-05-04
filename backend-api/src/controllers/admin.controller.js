import { query } from "../config/db.js";

export const getGranjas = async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM granjas ORDER BY id ASC");
    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo granjas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};