/**
 * EKMayorista - Backend Server
 * 
 * Plataforma B2B para distribuidoras de golosinas mayoristas
 * Vendedores + POS + Reportes + ERP Integrado
 * 
 * Stack: Node.js 18 + Express + TypeScript + PostgreSQL
 */

require('dotenv').config();
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'tu-clave-secreta-ekmayorista-2026';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Pool de conexión PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAR EXPRESS
// ═══════════════════════════════════════════════════════════════════════

const app: Express = express();

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de login'
});

app.use(limiter);

// ═══════════════════════════════════════════════════════════════════════
// TIPOS Y INTERFACES
// ═══════════════════════════════════════════════════════════════════════

interface UserPayload {
  id: number;
  email: string;
  rol: 'admin' | 'supervisor' | 'vendedor';
}

interface AuthRequest extends Request {
  user?: UserPayload;
}

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.auth_token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('auth_token');
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar rol
const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    next();
  };
};

// ═══════════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /
 * Health check
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    app: 'EKMayorista',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/auth/login
 * Autenticación de usuarios
 */
app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario
    const result = await pool.query(
      'SELECT id, email, password_hash, rol, nombre_completo FROM users WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Actualizar último login
    await pool.query(
      'UPDATE users SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
});

/**
 * GET /api/catalogo/productos
 * Catálogo público de productos
 */
app.get('/api/catalogo/productos', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(`
      SELECT 
        p.id, p.codigo_interno, p.nombre, 
        pc.nombre as categoria,
        p.precio_costo, p.precio_venta_mayorista,
        p.stock_actual, p.imagen_url
      FROM products p
      JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.activo = true
      ORDER BY pc.orden, p.nombre
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      productos: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error obteniendo catálogo:', error);
    res.status(500).json({ error: 'Error cargando catálogo' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RUTAS DE VENDEDOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/vendedor/dashboard
 * Dashboard del vendedor (mis ventas hoy, comisiones, etc)
 */
app.get('/api/vendedor/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Obtener datos del vendedor
    const vendedorResult = await pool.query(
      'SELECT id, codigo_vendedor, nombre, comision_base, meta_mensual FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (vendedorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    const vendedor = vendedorResult.rows[0];

    // Ventas de hoy
    const ventasHoyResult = await pool.query(`
      SELECT 
        COUNT(*) as cantidad_pedidos,
        SUM(monto_total) as total_ventas,
        COUNT(DISTINCT cliente_id) as clientes_visitados,
        AVG(monto_total) as ticket_promedio
      FROM orders
      WHERE vendedor_id = $1 AND DATE(fecha_pedido) = CURRENT_DATE
    `, [vendedor.id]);

    const ventasHoy = ventasHoyResult.rows[0];

    // Comisión acumulada del mes
    const comisionResult = await pool.query(`
      SELECT 
        SUM(monto_comision) as total_comision,
        COUNT(*) as periodos_completados
      FROM commissions
      WHERE vendedor_id = $1 
        AND EXTRACT(MONTH FROM fecha_inicio) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM fecha_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [vendedor.id]);

    const comision = comisionResult.rows[0];

    // Clientes asignados
    const clientesResult = await pool.query(
      'SELECT COUNT(*) as cantidad FROM customers WHERE vendedor_id = $1 AND cliente_activo = true',
      [vendedor.id]
    );

    res.json({
      vendedor,
      ventasHoy: {
        cantidad_pedidos: ventasHoy.cantidad_pedidos || 0,
        total_ventas: ventasHoy.total_ventas || 0,
        clientes_visitados: ventasHoy.clientes_visitados || 0,
        ticket_promedio: ventasHoy.ticket_promedio || 0
      },
      comisionMes: {
        total: comision.total_comision || 0,
        periodos: comision.periodos_completados || 0
      },
      clientesAsignados: clientesResult.rows[0].cantidad
    });
  } catch (error) {
    console.error('Error en dashboard vendedor:', error);
    res.status(500).json({ error: 'Error cargando dashboard' });
  }
});

/**
 * GET /api/vendedor/clientes
 * Mis clientes asignados
 */
app.get('/api/vendedor/clientes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(`
      SELECT 
        c.id, c.codigo_cliente, c.nombre_negocio, c.tipo_negocio,
        c.telefono, c.direccion, c.localidad,
        c.saldo_actual, c.limite_credito, c.ultima_compra,
        c.cantidad_pedidos, c.monto_acumulado
      FROM customers c
      JOIN sellers s ON c.vendedor_id = s.id
      WHERE s.user_id = $1 AND c.cliente_activo = true
      ORDER BY c.nombre_negocio
    `, [userId]);

    res.json({
      clientes: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({ error: 'Error cargando clientes' });
  }
});

/**
 * POST /api/vendedor/pedido
 * Crear un nuevo pedido desde POS
 */
app.post('/api/vendedor/pedido', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cliente_id, items, forma_pago, descuento = 0 } = req.body;
    const userId = req.user?.id;

    // Validaciones
    if (!cliente_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Obtener vendedor
    const vendedorResult = await pool.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (vendedorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    const vendedorId = vendedorResult.rows[0].id;

    // Iniciar transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generar número de pedido
      const numeroPedido = `PED-${Date.now()}`;

      // Calcular subtotal
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.precio_unitario * item.cantidad;
      }

      const montoTotal = subtotal - descuento;

      // Crear pedido
      const pedidoResult = await client.query(`
        INSERT INTO orders (numero_pedido, vendedor_id, cliente_id, forma_pago, monto_total, subtotal, descuento, cantidad_articulos, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmado')
        RETURNING id, numero_pedido
      `, [numeroPedido, vendedorId, cliente_id, forma_pago, montoTotal, subtotal, descuento, items.length]);

      const ordenId = pedidoResult.rows[0].id;

      // Agregar items
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, cantidad, precio_unitario, subtotal)
          VALUES ($1, $2, $3, $4, $5)
        `, [ordenId, item.product_id, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario]);

        // Actualizar stock
        await client.query(`
          UPDATE products 
          SET stock_actual = stock_actual - $1
          WHERE id = $2
        `, [item.cantidad, item.product_id]);
      }

      // Registrar métrica de venta
      await client.query(`
        INSERT INTO sales_metrics (time, vendedor_id, cliente_id, cantidad_ventas, monto_ventas, cantidad_articulos, cantidad_transacciones)
        VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, 1)
      `, [vendedorId, cliente_id, items.length, montoTotal, items.length]);

      await client.query('COMMIT');

      res.json({
        success: true,
        pedido: {
          id: ordenId,
          numero_pedido: numeroPedido,
          monto_total: montoTotal,
          estado: 'confirmado'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ error: 'Error creando pedido' });
  }
});

/**
 * GET /api/vendedor/reportes/hoy
 * Reporte de ventas del día
 */
app.get('/api/vendedor/reportes/hoy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(`
      SELECT 
        DATE(o.fecha_pedido) as fecha,
        COUNT(*) as cantidad_pedidos,
        SUM(o.monto_total) as total_ventas,
        COUNT(DISTINCT o.cliente_id) as clientes,
        AVG(o.monto_total) as ticket_promedio,
        string_agg(DISTINCT o.forma_pago, ', ') as formas_pago
      FROM orders o
      JOIN sellers s ON o.vendedor_id = s.id
      WHERE s.user_id = $1 AND DATE(o.fecha_pedido) = CURRENT_DATE
      GROUP BY DATE(o.fecha_pedido)
    `, [userId]);

    res.json({
      reporte: result.rows[0] || {}
    });
  } catch (error) {
    console.error('Error obteniendo reporte:', error);
    res.status(500).json({ error: 'Error generando reporte' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RUTAS DE ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/dashboard
 * Dashboard ejecutivo
 */
app.get('/api/admin/dashboard', authMiddleware, requireRole(['admin', 'supervisor']), async (req: AuthRequest, res: Response) => {
  try {
    // Total vendedores activos
    const vendedoresResult = await pool.query(
      'SELECT COUNT(*) FROM sellers WHERE estado_activo = true'
    );

    // Total clientes
    const clientesResult = await pool.query(
      'SELECT COUNT(*) FROM customers WHERE cliente_activo = true'
    );

    // Ventas del mes
    const ventasResult = await pool.query(`
      SELECT 
        SUM(monto_total) as total,
        COUNT(*) as cantidad_pedidos
      FROM orders
      WHERE EXTRACT(MONTH FROM fecha_pedido) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM fecha_pedido) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    // Top 5 vendedores
    const topVendedoresResult = await pool.query(`
      SELECT 
        s.nombre,
        COUNT(o.id) as cantidad_pedidos,
        SUM(o.monto_total) as total_vendido,
        AVG(o.monto_total) as ticket_promedio
      FROM sellers s
      LEFT JOIN orders o ON s.id = o.vendedor_id
      WHERE EXTRACT(MONTH FROM o.fecha_pedido) = EXTRACT(MONTH FROM CURRENT_DATE)
      GROUP BY s.id, s.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    res.json({
      vendedores_activos: vendedoresResult.rows[0].count,
      clientes_activos: clientesResult.rows[0].count,
      ventas_mes: ventasResult.rows[0],
      top_vendedores: topVendedoresResult.rows
    });
  } catch (error) {
    console.error('Error en dashboard admin:', error);
    res.status(500).json({ error: 'Error cargando dashboard' });
  }
});

/**
 * GET /api/admin/reportes/ventas
 * Reportes de ventas filtrados
 */
app.get('/api/admin/reportes/ventas', authMiddleware, requireRole(['admin', 'supervisor']), async (req: AuthRequest, res: Response) => {
  try {
    const { periodo = 'mes', vendedor_id, fecha_inicio, fecha_fin } = req.query;

    let query = `
      SELECT 
        DATE(o.fecha_pedido) as fecha,
        s.nombre as vendedor,
        COUNT(*) as cantidad_pedidos,
        SUM(o.monto_total) as total_ventas,
        COUNT(DISTINCT o.cliente_id) as clientes,
        AVG(o.monto_total) as ticket_promedio
      FROM orders o
      JOIN sellers s ON o.vendedor_id = s.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (vendedor_id) {
      query += ` AND o.vendedor_id = $${params.length + 1}`;
      params.push(vendedor_id);
    }

    if (fecha_inicio && fecha_fin) {
      query += ` AND o.fecha_pedido BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(fecha_inicio, fecha_fin);
    } else {
      // Por defecto, última semana
      query += ` AND o.fecha_pedido >= CURRENT_DATE - INTERVAL '7 days'`;
    }

    query += ` GROUP BY DATE(o.fecha_pedido), s.nombre ORDER BY fecha DESC`;

    const result = await pool.query(query, params);

    res.json({
      reporte: result.rows,
      periodo: periodo
    });
  } catch (error) {
    console.error('Error en reportes:', error);
    res.status(500).json({ error: 'Error generando reportes' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RUTAS DE COMISIONES
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/comisiones/calcular
 * Calcular comisiones mensuales
 */
app.post('/api/admin/comisiones/calcular', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { mes, anio } = req.body;

    // Obtener todos los vendedores
    const vendedoresResult = await pool.query(
      'SELECT id, comision_base FROM sellers WHERE estado_activo = true'
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const vendedor of vendedoresResult.rows) {
        // Calcular total de ventas
        const ventasResult = await client.query(`
          SELECT SUM(monto_total) as total
          FROM orders
          WHERE vendedor_id = $1
            AND EXTRACT(MONTH FROM fecha_pedido) = $2
            AND EXTRACT(YEAR FROM fecha_pedido) = $3
            AND estado = 'entregado'
        `, [vendedor.id, mes, anio]);

        const totalVentas = ventasResult.rows[0].total || 0;
        const montoComision = totalVentas * (vendedor.comision_base / 100);

        // Insertar/actualizar comisión
        await client.query(`
          INSERT INTO commissions (vendedor_id, periodo_tipo, fecha_inicio, fecha_fin, total_ventas, cantidad_transacciones, porcentaje_base, monto_comision, estado)
          VALUES ($1, 'mensual', $2, $3, $4, 0, $5, $6, 'pendiente')
          ON CONFLICT DO NOTHING
        `, [
          vendedor.id,
          `${anio}-${mes}-01`,
          `${anio}-${mes}-28`,
          totalVentas,
          vendedor.comision_base,
          montoComision
        ]);
      }

      await client.query('COMMIT');

      res.json({ success: true, mensaje: 'Comisiones calculadas' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error calculando comisiones:', error);
    res.status(500).json({ error: 'Error calculando comisiones' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MANEJO DE ERRORES
// ═══════════════════════════════════════════════════════════════════════

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: NODE_ENV === 'development' ? err.message : undefined
  });
});

// ═══════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
  
  ╔════════════════════════════════════════════════════════════╗
  ║                  🍬 EKMAYORISTA v1.0                       ║
  ║              Servidor Backend en ejecución                 ║
  ║                                                            ║
  ║  🌐 URL:      http://localhost:${PORT}                      ║
  ║  🗄️  Base:     ${process.env.DATABASE_URL ? '✓ Conectada' : '✗ Faltan credenciales'}         ║
  ║  📦 Ambiente: ${NODE_ENV}                             ║
  ║  🔑 JWT:      ${JWT_SECRET.substring(0, 10)}...           ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
