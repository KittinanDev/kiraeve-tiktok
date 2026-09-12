-- =========================================================
-- DATABASE SCHEMA: LINE Food Delivery & Rider System
-- Compatible with PostgreSQL & Supabase
-- =========================================================

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'RIDER', 'MERCHANT', 'ADMIN');

CREATE TYPE order_status AS ENUM (
    'PENDING',               -- ลูกค้าสั่งซื้อ รอร้านค้าตอบรับ
    'ACCEPTED_BY_MERCHANT',  -- ร้านค้ารับออเดอร์แล้ว
    'PREPARING',             -- ร้านกำลังประกอบอาหาร
    'READY_FOR_PICKUP',      -- อาหารเสร็จแล้ว รอไรเดอร์มารับ
    'RIDER_ASSIGNED',        -- ไรเดอร์รับงานแล้ว
    'PICKED_UP',             -- ไรเดอร์รับอาหารจากร้านแล้ว กำลังนำส่ง
    'DELIVERED',             -- ส่งถึงลูกค้าเรียบร้อย
    'CANCELLED'              -- ยกเลิกออเดอร์
);

CREATE TYPE payment_method AS ENUM ('COD', 'PROMPTPAY');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- Enable UUID extension (Required for PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table (เก็บข้อมูลลูกค้า, ไรเดอร์, ร้านค้า, แอดมิน)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    picture_url TEXT,
    phone VARCHAR(20),
    role user_role DEFAULT 'CUSTOMER',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stores Table (ร้านค้า)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table (สินค้า/อาหาร)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 50 CHECK (stock_quantity >= 0), -- จำนวนสต็อกสินค้าคงเหลือ
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Orders Table (ออเดอร์สั่งซื้อ)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. ORD-20260824-001
    customer_id UUID NOT NULL REFERENCES users(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    rider_id UUID REFERENCES users(id),
    status order_status DEFAULT 'PENDING',
    
    delivery_address TEXT NOT NULL,
    delivery_latitude NUMERIC(10, 8) NOT NULL,
    delivery_longitude NUMERIC(11, 8) NOT NULL,
    
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    
    payment_method payment_method DEFAULT 'COD',
    payment_status payment_status DEFAULT 'UNPAID',
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Order Items Table (รายการสินค้าในออเดอร์)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    special_instructions TEXT
);

-- 7. Rider Locations Table (เก็บพิกัดล่าสุดของไรเดอร์ สำหรับ Realtime Tracking)
CREATE TABLE rider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    heading NUMERIC(5, 2) DEFAULT 0, -- ทิศทางการหันหน้า (0-360 องศา)
    is_online BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Fast Query Performance
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_rider_locations_rider ON rider_locations(rider_id);
