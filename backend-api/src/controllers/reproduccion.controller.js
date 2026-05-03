import { pool } from "../config/db.js";

// ─── STATS ────────────────────────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const { granja_id } = req.user;

    const [montas, gestantes, partosProximos, lechones] = await Promise.all([
      // Montas últimos 30 días
      pool.query(`
        SELECT COUNT(*) AS total FROM reproduccion
        WHERE granja_id = $1 AND fecha_servicio >= NOW() - INTERVAL '30 days'
      `, [granja_id]),

      // Cerdas en gestación activa
      pool.query(`
        SELECT COUNT(*) AS total FROM reproduccion
        WHERE granja_id = $1 AND estado IN ('GESTANTE', 'CONFIRMADA')
      `, [granja_id]),

      // Partos estimados próximos 15 días
      pool.query(`
        SELECT COUNT(*) AS total FROM reproduccion
        WHERE granja_id = $1
          AND fecha_probable_parto BETWEEN NOW() AND NOW() + INTERVAL '15 days'
          AND estado IN ('GESTANTE', 'CONFIRMADA')
      `, [granja_id]),

      // Lechones nacidos últimos 30 días
      pool.query(`
        SELECT COALESCE(SUM(pa.lechones_nacidos_vivos), 0) AS total
        FROM partos pa
        JOIN reproduccion r ON pa.reproduccion_id = r.id
        WHERE r.granja_id = $1 AND pa.fecha_parto >= NOW() - INTERVAL '30 days'
      `, [granja_id]),
    ]);

    res.json({
      montas:          parseInt(montas.rows[0].total),
      gestantes:       parseInt(gestantes.rows[0].total),
      partos_proximos: parseInt(partosProximos.rows[0].total),
      lechones:        parseInt(lechones.rows[0].total),
    });
  } catch (error) {
    console.error("Error en getStats:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── SERVICIOS ────────────────────────────────────────────────────────────────

export const getServicios = async (req, res) => {
  try {
    const { granja_id } = req.user;
    const { tipo, estado, desde, hasta, pig_id } = req.query;

    let conditions = ["r.granja_id = $1"];
    let params = [granja_id];
    let idx = 2;

    if (tipo)   { conditions.push(`r.tipo_servicio = $${idx++}`); params.push(tipo); }
    if (estado) { conditions.push(`r.estado = $${idx++}`);        params.push(estado); }
    if (desde)  { conditions.push(`r.fecha_servicio >= $${idx++}`); params.push(desde); }
    if (hasta)  { conditions.push(`r.fecha_servicio <= $${idx++}`); params.push(hasta); }
    if (pig_id) { conditions.push(`r.pig_id = $${idx++}`);        params.push(pig_id); }

    const { rows } = await pool.query(`
      SELECT
        r.*,
        cerda.codigo_arete  AS cerda_arete,
        cerda.raza          AS cerda_raza,
        macho.codigo_arete  AS verraco_arete,
        macho.raza          AS verraco_raza
      FROM reproduccion r
      LEFT JOIN pigs cerda ON r.pig_id    = cerda.id
      LEFT JOIN pigs macho ON r.verraco_pig_id = macho.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.fecha_servicio DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error("Error en getServicios:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getServicioById = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;

    const { rows } = await pool.query(`
      SELECT
        r.*,
        cerda.codigo_arete AS cerda_arete,
        cerda.raza         AS cerda_raza,
        macho.codigo_arete AS verraco_arete,
        macho.raza         AS verraco_raza
      FROM reproduccion r
      LEFT JOIN pigs cerda ON r.pig_id         = cerda.id
      LEFT JOIN pigs macho ON r.verraco_pig_id = macho.id
      WHERE r.id = $1 AND r.granja_id = $2
    `, [id, granja_id]);

    if (rows.length === 0) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createServicio = async (req, res) => {
  try {
    const { granja_id } = req.user;
    const {
      cerda_id,       // pig_id de la cerda
      verraco_id,     // pig_id del verraco (opcional, puede ser null si es IA con semen externo)
      fecha_servicio,
      tipo_servicio,
      tecnico,
      observaciones,
      fecha_probable_parto, // Si no viene, se calcula (114 días = gestación porcina)
    } = req.body;

    // Validar cerda
    const cerdaCheck = await pool.query(
      "SELECT id, sexo FROM pigs WHERE id = $1 AND granja_id = $2",
      [cerda_id, granja_id]
    );
    if (cerdaCheck.rows.length === 0)
      return res.status(404).json({ error: "La cerda especificada no existe en esta granja." });
    if (cerdaCheck.rows[0].sexo !== "Hembra")
      return res.status(400).json({ error: "Solo se pueden registrar servicios a hembras." });

    // Validar que no tenga servicio activo
    const activo = await pool.query(
      "SELECT id FROM reproduccion WHERE pig_id = $1 AND estado IN ('GESTANTE','CONFIRMADA')",
      [cerda_id]
    );
    if (activo.rows.length > 0)
      return res.status(400).json({
        error: "Esta cerda ya tiene un proceso reproductivo activo. Registre el parto o finalice el proceso actual."
      });

    // Calcular fecha probable de parto si no viene (114 días)
    const fechaParto = fecha_probable_parto || (() => {
      const d = new Date(fecha_servicio);
      d.setDate(d.getDate() + 114);
      return d.toISOString().split("T")[0];
    })();

    const { rows } = await pool.query(`
      INSERT INTO reproduccion
        (granja_id, pig_id, verraco_pig_id, tipo_servicio, fecha_servicio,
         fecha_probable_parto, estado, tecnico, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, 'GESTANTE', $7, $8)
      RETURNING *
    `, [granja_id, cerda_id, verraco_id || null, tipo_servicio, fecha_servicio,
        fechaParto, tecnico || null, observaciones || null]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error en createServicio:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;
    const {
      cerda_id, verraco_id, fecha_servicio, tipo_servicio,
      tecnico, observaciones, estado, fecha_probable_parto,
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE reproduccion SET
        pig_id = $1, verraco_pig_id = $2, fecha_servicio = $3,
        tipo_servicio = $4, tecnico = $5, observaciones = $6,
        estado = $7, fecha_probable_parto = $8
      WHERE id = $9 AND granja_id = $10
      RETURNING *
    `, [cerda_id, verraco_id || null, fecha_servicio, tipo_servicio,
        tecnico || null, observaciones || null, estado, fecha_probable_parto, id, granja_id]);

    if (rows.length === 0) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;

    const { rows } = await pool.query(
      "DELETE FROM reproduccion WHERE id = $1 AND granja_id = $2 RETURNING *",
      [id, granja_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json({ message: "Servicio eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── PARTOS ───────────────────────────────────────────────────────────────────

export const getPartos = async (req, res) => {
  try {
    const { granja_id } = req.user;

    const { rows } = await pool.query(`
      SELECT
        pa.*,
        cerda.codigo_arete        AS cerda_arete,
        cerda.raza                AS cerda_raza,
        r.fecha_servicio,
        r.tipo_servicio,
        (pa.lechones_nacidos_vivos + COALESCE(pa.lechones_nacidos_muertos,0)
         + COALESCE(pa.lechones_momificados,0)) AS total_lechones
      FROM partos pa
      LEFT JOIN reproduccion r ON pa.reproduccion_id = r.id
      LEFT JOIN pigs cerda     ON pa.pig_id = cerda.id
      WHERE r.granja_id = $1
      ORDER BY pa.fecha_parto DESC
    `, [granja_id]);

    res.json(rows);
  } catch (error) {
    console.error("Error en getPartos:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getPartoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { granja_id } = req.user;

    const { rows } = await pool.query(`
      SELECT pa.*, cerda.codigo_arete AS cerda_arete, r.fecha_servicio
      FROM partos pa
      LEFT JOIN reproduccion r ON pa.reproduccion_id = r.id
      LEFT JOIN pigs cerda     ON pa.pig_id = cerda.id
      WHERE pa.id = $1 AND r.granja_id = $2
    `, [id, granja_id]);

    if (rows.length === 0) return res.status(404).json({ error: "Parto no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createParto = async (req, res) => {
  try {
    const { granja_id } = req.user;
    const {
      servicio_id,              // reproduccion_id
      fecha_parto,
      lechones_nacidos_vivos,
      lechones_nacidos_muertos,
      lechones_momificados,
      peso_camada_kg,           // frontend usa este nombre
      observaciones,
    } = req.body;

    // Validar servicio
    const servCheck = await pool.query(
      "SELECT id, pig_id, estado FROM reproduccion WHERE id = $1 AND granja_id = $2",
      [servicio_id, granja_id]
    );
    if (servCheck.rows.length === 0)
      return res.status(404).json({ error: "El servicio especificado no existe." });

    const { estado, pig_id } = servCheck.rows[0];
    if (estado !== "GESTANTE" && estado !== "CONFIRMADA")
      return res.status(400).json({
        error: `No se puede registrar parto para un servicio en estado '${estado}'. Debe estar GESTANTE o CONFIRMADA.`
      });

    // Insertar parto
    const { rows } = await pool.query(`
      INSERT INTO partos
        (reproduccion_id, pig_id, fecha_parto, lechones_nacidos_vivos,
         lechones_nacidos_muertos, lechones_momificados, peso_promedio_lechon, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [servicio_id, pig_id, fecha_parto,
        lechones_nacidos_vivos || 0,
        lechones_nacidos_muertos || 0,
        lechones_momificados || 0,
        peso_camada_kg || null,
        observaciones || null]);

    // Actualizar estado del servicio
    await pool.query(
      "UPDATE reproduccion SET estado = 'PARTO_REGISTRADO' WHERE id = $1",
      [servicio_id]
    );

    // Actualizar etapa de la cerda a LACTANCIA
    if (pig_id) {
      await pool.query("UPDATE pigs SET etapa = 'LACTANCIA' WHERE id = $1", [pig_id]);
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error en createParto:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateParto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fecha_parto, lechones_nacidos_vivos, lechones_nacidos_muertos,
      lechones_momificados, peso_camada_kg, observaciones,
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE partos SET
        fecha_parto = $1, lechones_nacidos_vivos = $2,
        lechones_nacidos_muertos = $3, lechones_momificados = $4,
        peso_promedio_lechon = $5, observaciones = $6
      WHERE id = $7
      RETURNING *
    `, [fecha_parto, lechones_nacidos_vivos || 0, lechones_nacidos_muertos || 0,
        lechones_momificados || 0, peso_camada_kg || null, observaciones || null, id]);

    if (rows.length === 0) return res.status(404).json({ error: "Parto no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteParto = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "DELETE FROM partos WHERE id = $1 RETURNING *", [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Parto no encontrado" });

    // Revertir estado del servicio a GESTANTE
    if (rows[0].reproduccion_id) {
      await pool.query(
        "UPDATE reproduccion SET estado = 'GESTANTE' WHERE id = $1",
        [rows[0].reproduccion_id]
      );
    }

    res.json({ message: "Parto eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};