import { pool } from "../config/db.js";

// === ALIMENTACION (CATÁLOGO) ===

// Obtener todos los alimentos
export const getAlimentos = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM alimentacion ORDER BY nombre_alimento ASC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener alimento por ID
export const getAlimentoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM alimentacion WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Alimento no encontrado" });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo alimento
export const createAlimento = async (req, res) => {
  try {
    const {
      nombre_alimento,
      tipo,
      proteina_porcentaje,
      costo_por_kg,
      proveedor,
      stock_kg,
      observaciones,
      granjas_id // <-- Añadido para que coincida con tu frontend
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO alimentacion 
       (nombre_alimento, tipo, proteina_porcentaje, costo_por_kg, proveedor, stock_kg, observaciones, granjas_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nombre_alimento, tipo, proteina_porcentaje, costo_por_kg, proveedor, stock_kg || 0, observaciones, granjas_id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar alimento
export const updateAlimento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_alimento,
      tipo,
      proteina_porcentaje,
      costo_por_kg,
      proveedor,
      stock_kg,
      observaciones
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE alimentacion 
       SET nombre_alimento = $1, tipo = $2, proteina_porcentaje = $3, 
           costo_por_kg = $4, proveedor = $5, stock_kg = $6, observaciones = $7
       WHERE id = $8
       RETURNING *`,
      [nombre_alimento, tipo, proteina_porcentaje, costo_por_kg, proveedor, stock_kg, observaciones, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Alimento no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar alimento
export const deleteAlimento = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "DELETE FROM alimentacion WHERE id = $1 RETURNING *",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Alimento no encontrado" });
    }

    res.json({ message: "Alimento eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// === CONSUMO DE ALIMENTO ===

// Obtener todos los consumos
export const getConsumos = async (req, res) => {
  try {
    // CORREGIDO: pigs_id y alimentacion_id
    const { rows } = await pool.query(`
      SELECT c.*, p.codigo_arete, p.nombre as nombre_cerdo, a.nombre_alimento, a.tipo as tipo_alimento
      FROM consumo_alimento c
      LEFT JOIN pigs p ON c.pigs_id = p.id
      LEFT JOIN alimentacion a ON c.alimentacion_id = a.id
      ORDER BY c.fecha DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener consumo por cerdo
export const getConsumoByPig = async (req, res) => {
  try {
    const { pig_id } = req.params; // Esto es de la URL, puede quedar igual
    // CORREGIDO: pigs_id y alimentacion_id
    const { rows } = await pool.query(`
      SELECT c.*, a.nombre_alimento, a.tipo as tipo_alimento
      FROM consumo_alimento c
      LEFT JOIN alimentacion a ON c.alimentacion_id = a.id
      WHERE c.pigs_id = $1
      ORDER BY c.fecha DESC
    `, [pig_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo consumo
export const createConsumo = async (req, res) => {
  try {
    // CORREGIDO: Extraemos los nombres exactos que manda React
    const {
      pigs_id,
      alimentacion_id,
      fecha,
      cantidad_kg,
      lote,
      observaciones,
      granjas_id
    } = req.body;

    if (!alimentacion_id || !cantidad_kg || cantidad_kg <= 0) {
      return res.status(400).json({ error: "Debe especificar un alimento y una cantidad válida mayor a 0." });
    }

    // 1. Validar Stock Suficiente
    const stockCheck = await pool.query("SELECT nombre_alimento, stock_kg FROM alimentacion WHERE id = $1", [alimentacion_id]);

    if (stockCheck.rows.length === 0) {
      return res.status(404).json({ error: "El alimento especificado no existe." });
    }

    const { nombre_alimento, stock_kg } = stockCheck.rows[0];

    // Convertir a float para asegurar comparación numérica
    if (parseFloat(stock_kg) < parseFloat(cantidad_kg)) {
      return res.status(400).json({
        error: `Stock insuficiente para ${nombre_alimento}.`,
        detail: `Intentaste retirar ${cantidad_kg}kg, pero solo quedan ${stock_kg}kg disponibles.`
      });
    }

    // CORREGIDO: Nombres de columnas de la BD
    const { rows } = await pool.query(
      `INSERT INTO consumo_alimento 
       (pigs_id, alimentacion_id, fecha, cantidad_kg, lote, observaciones, granjas_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pigs_id, alimentacion_id, fecha, cantidad_kg, lote, observaciones, granjas_id]
    );

    // Actualizar stock del alimento
    await pool.query(
      "UPDATE alimentacion SET stock_kg = stock_kg - $1 WHERE id = $2",
      [cantidad_kg, alimentacion_id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error en createConsumo:", error);
    res.status(500).json({ ok: false, error: "Error interno del servidor", detail: error.message });
  }
};

// Actualizar consumo
export const updateConsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      pigs_id,
      alimentacion_id,
      fecha,
      cantidad_kg,
      lote,
      observaciones
    } = req.body;

    // CORREGIDO: alimentacion_id
    const { rows: oldRows } = await pool.query(
      "SELECT cantidad_kg, alimentacion_id FROM consumo_alimento WHERE id = $1",
      [id]
    );

    // CORREGIDO: Nombres de columnas
    const { rows } = await pool.query(
      `UPDATE consumo_alimento 
       SET pigs_id = $1, alimentacion_id = $2, fecha = $3, cantidad_kg = $4, lote = $5, observaciones = $6
       WHERE id = $7
       RETURNING *`,
      [pigs_id, alimentacion_id, fecha, cantidad_kg, lote, observaciones, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Ajustar stock: devolver cantidad anterior y restar nueva cantidad
    if (oldRows.length > 0) {
      const oldCantidad = oldRows[0].cantidad_kg;
      const oldAlimentoId = oldRows[0].alimentacion_id;

      // Devolver cantidad anterior
      await pool.query(
        "UPDATE alimentacion SET stock_kg = stock_kg + $1 WHERE id = $2",
        [oldCantidad, oldAlimentoId]
      );

      // Restar nueva cantidad
      if (alimentacion_id && cantidad_kg) {
        await pool.query(
          "UPDATE alimentacion SET stock_kg = stock_kg - $1 WHERE id = $2",
          [cantidad_kg, alimentacion_id]
        );
      }
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar consumo
export const deleteConsumo = async (req, res) => {
  try {
    const { id } = req.params;

    // CORREGIDO: alimentacion_id
    const { rows: oldRows } = await pool.query(
      "SELECT cantidad_kg, alimentacion_id FROM consumo_alimento WHERE id = $1",
      [id]
    );

    const { rows } = await pool.query(
      "DELETE FROM consumo_alimento WHERE id = $1 RETURNING *",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Devolver cantidad al stock
    if (oldRows.length > 0) {
      const { cantidad_kg, alimentacion_id } = oldRows[0];
      await pool.query(
        "UPDATE alimentacion SET stock_kg = stock_kg + $1 WHERE id = $2",
        [cantidad_kg, alimentacion_id]
      );
    }

    res.json({ message: "Registro eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de consumo
export const getEstadisticasConsumo = async (req, res) => {
  try {
    // CORREGIDO: pigs_id y alimentacion_id
    const { rows } = await pool.query(`
      SELECT 
        a.nombre_alimento,
        a.tipo,
        SUM(c.cantidad_kg) as total_consumido,
        COUNT(DISTINCT c.pigs_id) as cerdos_consumieron
      FROM consumo_alimento c
      LEFT JOIN alimentacion a ON c.alimentacion_id = a.id
      WHERE c.fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY a.id, a.nombre_alimento, a.tipo
      ORDER BY total_consumido DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};