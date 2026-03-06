import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Configuración de variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARES ---

// 1. CORS: Esencial para que tu Frontend (5173) pueda pedir datos al Backend (3001)
app.use(cors()); 

// 2. JSON Parser: Para que el servidor entienda los cuerpos de las peticiones POST
app.use(express.json());

// --- CONEXIÓN A BASE DE DATOS ---

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- RUTAS / ENDPOINTS ---

// Health check para verificar que el backend "vive"
app.get('/', (req, res) => {
  res.json({ app: "EKMayorista", status: "online", version: "1.0.0" });
});

// Endpoint para el Catálogo de Productos (usado por el Frontend)
app.get('/api/catalogo/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos de la base de datos" });
  }
});

// Endpoint para registrar una venta desde la preventa
app.post('/api/ventas', async (req, res) => {
  const { cliente_id, items, total } = req.body;
  // Aquí irá la lógica para insertar en la tabla 'orders' y descontar stock en Dolibarr
  console.log("Nueva venta recibida:", { cliente_id, total });
  res.status(201).json({ success: true, message: "Venta registrada correctamente" });
});

// --- INICIO DEL SERVIDOR ---

app.listen(PORT, () => {
  console.log(`✅ EKMAYORISTA v1.0 - Servidor Backend en ejecución`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});
