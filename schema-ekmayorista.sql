-- ═══════════════════════════════════════════════════════════════════════
-- EKMAYORISTA - SCHEMA DE BASE DE DATOS
-- PostgreSQL 16 + TimescaleDB para análisis temporal
-- ═══════════════════════════════════════════════════════════════════════

-- Crear extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 1: USUARIOS (autenticación y perfiles)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'supervisor', 'vendedor')),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_activo (activo)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 2: VENDEDORES (repartidores de terreno)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE sellers (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id BIGINT NOT NULL UNIQUE,
    codigo_vendedor VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    territorio VARCHAR(255),
    fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
    comision_base DECIMAL(5, 2) NOT NULL DEFAULT 10.0,  -- Porcentaje
    comision_bonus DECIMAL(5, 2) DEFAULT 0.0,
    meta_mensual DECIMAL(12, 2),
    telefono VARCHAR(20),
    documento VARCHAR(20) UNIQUE,
    estado_activo BOOLEAN DEFAULT TRUE,
    fecha_baja DATE,
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_codigo (codigo_vendedor),
    INDEX idx_territorio (territorio),
    INDEX idx_activo (estado_activo),
    INDEX idx_fecha_alta (fecha_alta)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 3: CATEGORÍAS DE PRODUCTOS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    imagen_url VARCHAR(500),
    orden INT DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_nombre (nombre),
    INDEX idx_orden (orden)
);

-- Insertar categorías iniciales
INSERT INTO product_categories (nombre, descripcion, orden) VALUES
('Chocolates', 'Chocolates variados', 1),
('Caramelos', 'Caramelos duros y blandos', 2),
('Chicles', 'Chicles de todos los sabores', 3),
('Paletas', 'Paletas y chupetines', 4),
('Gomitas', 'Gomas de mascar y gomitas', 5),
('Algodonetes', 'Algodón de azúcar', 6),
('Turrones', 'Turrones variados', 7);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 4: PRODUCTOS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    codigo_interno VARCHAR(50) UNIQUE NOT NULL,
    codigo_barras VARCHAR(50) UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    category_id BIGINT NOT NULL,
    precio_costo DECIMAL(10, 2) NOT NULL,
    precio_venta_mayorista DECIMAL(10, 2) NOT NULL,
    precio_venta_alt1 DECIMAL(10, 2),  -- Precio por volumen
    precio_venta_alt2 DECIMAL(10, 2),
    cantidad_minima_alt1 INT,           -- Cantidad mínima para alt1
    cantidad_minima_alt2 INT,
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 50,
    stock_maximo INT DEFAULT 500,
    peso_gramos DECIMAL(8, 2),
    imagen_url VARCHAR(500),
    activo BOOLEAN DEFAULT TRUE,
    proveedor_principal VARCHAR(255),
    fecha_ultima_reposicion DATE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (category_id) REFERENCES product_categories(id),
    INDEX idx_codigo (codigo_interno),
    INDEX idx_nombre (nombre),
    INDEX idx_category (category_id),
    INDEX idx_stock (stock_actual),
    INDEX idx_activo (activo)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 5: CLIENTES MAYORISTAS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    codigo_cliente VARCHAR(50) UNIQUE NOT NULL,
    nombre_negocio VARCHAR(255) NOT NULL,
    tipo_negocio VARCHAR(50) CHECK (tipo_negocio IN ('almacen', 'kiosco', 'supermercado', 'local', 'otro')),
    vendedor_id BIGINT NOT NULL,
    contacto_principal VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT NOT NULL,
    localidad VARCHAR(100),
    codigo_postal VARCHAR(10),
    provincia VARCHAR(100),
    limite_credito DECIMAL(12, 2) DEFAULT 50000.00,
    saldo_actual DECIMAL(12, 2) DEFAULT 0.00,
    cantidad_pedidos INT DEFAULT 0,
    monto_acumulado DECIMAL(15, 2) DEFAULT 0.00,
    frecuencia_compra INT DEFAULT 7,  -- Días entre compras promedio
    ultima_compra DATE,
    cliente_activo BOOLEAN DEFAULT TRUE,
    observaciones TEXT,
    fecha_alta DATE DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (vendedor_id) REFERENCES sellers(id) ON DELETE RESTRICT,
    INDEX idx_codigo_cliente (codigo_cliente),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_nombre (nombre_negocio),
    INDEX idx_tipo (tipo_negocio),
    INDEX idx_saldo (saldo_actual)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 6: PEDIDOS (Órdenes de venta)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    numero_pedido VARCHAR(50) UNIQUE NOT NULL,
    vendedor_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    cantidad_articulos INT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    descuento DECIMAL(12, 2) DEFAULT 0.00,
    impuesto DECIMAL(12, 2) DEFAULT 0.00,
    monto_total DECIMAL(12, 2) NOT NULL,
    forma_pago VARCHAR(50) CHECK (forma_pago IN ('efectivo', 'credito', 'transferencia', 'cheque', 'otro')),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'entregado', 'cancelado')),
    observaciones TEXT,
    numero_factura VARCHAR(50),
    fecha_facturacion DATE,
    entregado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (vendedor_id) REFERENCES sellers(id) ON DELETE RESTRICT,
    FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_numero (numero_pedido),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_cliente (cliente_id),
    INDEX idx_fecha (fecha_pedido),
    INDEX idx_estado (estado)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 7: DETALLES DE PEDIDOS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 8: COMISIONES (Cálculo de comisiones por vendedor)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE commissions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    vendedor_id BIGINT NOT NULL,
    periodo_tipo VARCHAR(50) CHECK (periodo_tipo IN ('diario', 'semanal', 'mensual')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    total_ventas DECIMAL(12, 2) NOT NULL,
    cantidad_transacciones INT NOT NULL,
    porcentaje_base DECIMAL(5, 2) NOT NULL,
    bonus_por_meta DECIMAL(12, 2) DEFAULT 0.00,
    descuentos DECIMAL(12, 2) DEFAULT 0.00,
    monto_comision DECIMAL(12, 2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'pagada')),
    fecha_pago DATE,
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (vendedor_id) REFERENCES sellers(id) ON DELETE RESTRICT,
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_periodo (fecha_inicio, fecha_fin),
    INDEX idx_estado (estado)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 9: HISTORIAL DE INVENTARIO (TimescaleDB - Series temporales)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE inventory_log (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    product_id BIGINT NOT NULL,
    cantidad INT NOT NULL,
    tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'devolucion')),
    motivo VARCHAR(255),
    usuario_id BIGINT,
    referencia VARCHAR(100),
    saldo_anterior INT,
    saldo_nuevo INT
);

-- Convertir a tabla hyper
SELECT create_hypertable('inventory_log', 'time', if_not_exists => TRUE);

-- Crear índices
CREATE INDEX ON inventory_log (product_id, time DESC);
CREATE INDEX ON inventory_log (tipo_movimiento, time DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 10: REPORTE DE VENTAS (TimescaleDB - Analytics)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE sales_metrics (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    vendedor_id BIGINT NOT NULL,
    cliente_id BIGINT,
    categoria_id BIGINT,
    cantidad_ventas INT NOT NULL,
    monto_ventas DECIMAL(12, 2) NOT NULL,
    cantidad_articulos INT NOT NULL,
    promedio_ticket DECIMAL(12, 2),
    cantidad_transacciones INT NOT NULL
);

-- Convertir a tabla hyper
SELECT create_hypertable('sales_metrics', 'time', if_not_exists => TRUE);

-- Crear índices para analytics
CREATE INDEX ON sales_metrics (vendedor_id, time DESC);
CREATE INDEX ON sales_metrics (cliente_id, time DESC);
CREATE INDEX ON sales_metrics (categoria_id, time DESC);
CREATE INDEX ON sales_metrics (time DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 11: METAS DE VENDEDORES
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE sales_goals (
    id BIGSERIAL PRIMARY KEY,
    vendedor_id BIGINT NOT NULL,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio INT NOT NULL,
    meta_en_pesos DECIMAL(12, 2) NOT NULL,
    meta_en_unidades INT,
    meta_clientes_nuevos INT DEFAULT 0,
    bonus_cumplimiento DECIMAL(12, 2) DEFAULT 0.00,
    creado_por BIGINT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (vendedor_id) REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (creado_por) REFERENCES users(id),
    UNIQUE (vendedor_id, mes, anio),
    INDEX idx_vendedor_mes (vendedor_id, mes, anio)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 12: AUDITORÍA (Historial de cambios)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT,
    accion VARCHAR(50) NOT NULL,
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id BIGINT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_origen INET,
    user_agent TEXT,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_tabla (tabla_afectada),
    INDEX idx_fecha (fecha_hora),
    INDEX idx_accion (accion)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLA 13: CONFIGURACIONES DEL SISTEMA
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE system_config (
    id BIGSERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo VARCHAR(50) DEFAULT 'string',
    descripcion TEXT,
    actualizado_por BIGINT,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (actualizado_por) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_clave (clave)
);

-- Configuraciones iniciales
INSERT INTO system_config (clave, valor, descripcion) VALUES
('nombre_empresa', 'EKMayorista', 'Nombre de la empresa'),
('comision_base_default', '10', 'Comisión base por defecto para nuevos vendedores (%)'),
('iva_default', '21', 'IVA por defecto (%)'),
('dias_credito_default', '30', 'Días de crédito por defecto'),
('email_contacto', 'contacto@ekmayorista.com', 'Email de contacto'),
('telefono_contacto', '+54 11 XXXX-XXXX', 'Teléfono de contacto'),
('moneda', 'ARS', 'Moneda de la empresa');

-- ═══════════════════════════════════════════════════════════════════════
-- VISTAS ÚTILES PARA REPORTES
-- ═══════════════════════════════════════════════════════════════════════

-- Vista: Ventas por vendedor hoy
CREATE OR REPLACE VIEW v_ventas_hoy AS
SELECT 
    s.id as vendedor_id,
    s.codigo_vendedor,
    s.nombre as vendedor_nombre,
    COUNT(o.id) as cantidad_pedidos,
    SUM(o.monto_total) as total_ventas,
    COUNT(DISTINCT o.cliente_id) as clientes_visitados,
    AVG(o.monto_total) as ticket_promedio
FROM sellers s
LEFT JOIN orders o ON s.id = o.vendedor_id AND DATE(o.fecha_pedido) = CURRENT_DATE
GROUP BY s.id, s.codigo_vendedor, s.nombre;

-- Vista: Comisiones acumuladas del mes
CREATE OR REPLACE VIEW v_comisiones_mes_actual AS
SELECT 
    s.id as vendedor_id,
    s.nombre,
    SUM(CASE WHEN c.estado = 'pagada' THEN c.monto_comision ELSE 0 END) as comisiones_pagadas,
    SUM(CASE WHEN c.estado = 'pendiente' THEN c.monto_comision ELSE 0 END) as comisiones_pendientes,
    SUM(CASE WHEN c.estado = 'confirmada' THEN c.monto_comision ELSE 0 END) as comisiones_confirmadas
FROM sellers s
LEFT JOIN commissions c ON s.id = c.vendedor_id 
    AND EXTRACT(MONTH FROM c.fecha_inicio) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM c.fecha_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY s.id, s.nombre;

-- Vista: Top 10 productos más vendidos
CREATE OR REPLACE VIEW v_top_productos AS
SELECT 
    p.id,
    p.codigo_interno,
    p.nombre,
    pc.nombre as categoria,
    SUM(oi.cantidad) as cantidad_vendida,
    SUM(oi.subtotal) as monto_total,
    COUNT(DISTINCT oi.order_id) as numero_pedidos
FROM products p
JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.codigo_interno, p.nombre, pc.nombre
ORDER BY cantidad_vendida DESC
LIMIT 10;

-- Vista: Clientes por vendedor
CREATE OR REPLACE VIEW v_clientes_por_vendedor AS
SELECT 
    s.id as vendedor_id,
    s.nombre as vendedor_nombre,
    COUNT(c.id) as cantidad_clientes,
    COUNT(CASE WHEN c.cliente_activo = TRUE THEN 1 END) as clientes_activos,
    SUM(c.saldo_actual) as saldo_total_clientes,
    SUM(c.monto_acumulado) as monto_acumulado_total
FROM sellers s
LEFT JOIN customers c ON s.id = c.vendedor_id
GROUP BY s.id, s.nombre;

-- ═══════════════════════════════════════════════════════════════════════
-- FUNCIONES ÚTILES
-- ═══════════════════════════════════════════════════════════════════════

-- Función: Calcular comisión mensual
CREATE OR REPLACE FUNCTION calcular_comision_mensual(
    p_vendedor_id BIGINT,
    p_mes INT,
    p_anio INT
)
RETURNS DECIMAL AS $$
DECLARE
    v_total_ventas DECIMAL;
    v_porcentaje DECIMAL;
    v_bonus DECIMAL;
    v_comision DECIMAL;
BEGIN
    -- Sumar todas las ventas del mes
    SELECT COALESCE(SUM(monto_total), 0)
    INTO v_total_ventas
    FROM orders
    WHERE vendedor_id = p_vendedor_id
        AND EXTRACT(MONTH FROM fecha_pedido) = p_mes
        AND EXTRACT(YEAR FROM fecha_pedido) = p_anio
        AND estado = 'entregado';
    
    -- Obtener porcentaje base del vendedor
    SELECT comision_base INTO v_porcentaje
    FROM sellers WHERE id = p_vendedor_id;
    
    -- Calcular comisión base
    v_comision := v_total_ventas * (v_porcentaje / 100);
    
    -- Verificar si cumplió meta
    SELECT 
        COALESCE(comision_bonus, 0)
    INTO v_bonus
    FROM sales_goals
    WHERE vendedor_id = p_vendedor_id
        AND mes = p_mes
        AND anio = p_anio
        AND meta_en_pesos <= v_total_ventas;
    
    RETURN v_comision + v_bonus;
END;
$$ LANGUAGE plpgsql;

-- Función: Actualizar saldo del cliente
CREATE OR REPLACE FUNCTION actualizar_saldo_cliente()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET saldo_actual = saldo_actual + NEW.monto_total,
        cantidad_pedidos = cantidad_pedidos + 1,
        monto_acumulado = monto_acumulado + NEW.monto_total,
        ultima_compra = CURRENT_DATE
    WHERE id = NEW.cliente_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Actualizar saldo cuando se crea pedido
CREATE TRIGGER tr_actualizar_saldo_cliente
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION actualizar_saldo_cliente();

-- ═══════════════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_orders_fecha_vendedor ON orders(fecha_pedido DESC, vendedor_id);
CREATE INDEX idx_orders_fecha_cliente ON orders(fecha_pedido DESC, cliente_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_sales_metrics_vendor_time ON sales_metrics(vendedor_id, time DESC);
CREATE INDEX idx_inventory_product_time ON inventory_log(product_id, time DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- COMENTARIOS DE DOCUMENTACIÓN
-- ═══════════════════════════════════════════════════════════════════════

COMMENT ON TABLE users IS 'Usuarios del sistema (admin, supervisores, vendedores)';
COMMENT ON TABLE sellers IS 'Vendedores en terreno que utilizan el POS';
COMMENT ON TABLE products IS 'Catálogo de golosinas disponibles para venta';
COMMENT ON TABLE customers IS 'Clientes mayoristas que compran a través de vendedores';
COMMENT ON TABLE orders IS 'Órdenes de venta registradas por vendedores';
COMMENT ON TABLE commissions IS 'Comisiones calculadas automáticamente por vendedor';
COMMENT ON TABLE inventory_log IS 'Historial temporal de movimientos de inventario';
COMMENT ON TABLE sales_metrics IS 'Métricas de venta agregadas para análisis';

-- ═══════════════════════════════════════════════════════════════════════
-- FIN DEL SCHEMA
-- ═══════════════════════════════════════════════════════════════════════

-- Para ejecutar este script:
-- psql -U postgres -d ekmayorista -f schema.sql
