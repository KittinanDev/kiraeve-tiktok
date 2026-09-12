const express = require('express');
const router = express.Router();
const { createOrderFlexMessage, sendOrderFlexMessage } = require('../services/lineFlexService');

// In-memory Mock Data Store for testing scaffold without DB connection
const mockOrders = new Map();
const mockRiderLocations = new Map();

// Mock Product Store with Initial Stock Quantity
const mockProducts = [
  { id: 'p1', name: 'ก๋วยเตี๋ยวหมูน้ำตกพิเศษ', price: 60, stockQuantity: 25, isAvailable: true, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop' },
  { id: 'p2', name: 'ข้าวผัดกะเพราหมูกรอบไข่ดาว', price: 70, stockQuantity: 15, isAvailable: true, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop' },
  { id: 'p3', name: 'เกี๊ยวหมูทอดกรอบ', price: 35, stockQuantity: 5, isAvailable: true, image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop' },
  { id: 'p4', name: 'ชาไทยเย็นสูตรเข้มข้น', price: 40, stockQuantity: 30, isAvailable: true, image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&auto=format&fit=crop' },
];

// 0. Get All Products & Current Stock (ดึงรายการสินค้าพร้อมจำนวนสต็อก)
router.get('/products', (req, res) => {
  return res.json({
    success: true,
    data: mockProducts
  });
});

// 0.1 Update Product Stock & Availability (ร้านค้าอัปเดตจำนวนสต็อกสินค้า)
router.patch('/products/:id/stock', (req, res) => {
  const { id } = req.params;
  const { stockQuantity, isAvailable } = req.body;

  const product = mockProducts.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
  }

  if (stockQuantity !== undefined) {
    product.stockQuantity = Math.max(0, parseInt(stockQuantity));
    if (product.stockQuantity === 0) {
      product.isAvailable = false;
    }
  }

  if (isAvailable !== undefined) {
    product.isAvailable = Boolean(isAvailable);
  }

  return res.json({
    success: true,
    message: `อัปเดตสต็อก ${product.name} เป็น ${product.stockQuantity} ชิ้น`,
    data: product
  });
});

// 1. Create New Order (สั่งซื้อสินค้า + ตัดสต็อกอัตโนมัติ)
router.post('/orders', async (req, res) => {
  try {
    const {
      lineUserId,
      storeName,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      subtotal,
      deliveryFee,
      paymentMethod
    } = req.body;

    // ตรวจสอบสต็อกสินค้าก่อนตัดชำระ
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const prod = mockProducts.find(p => p.id === item.id || p.name === item.name);
        if (prod) {
          if (prod.stockQuantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `สินค้า "${prod.name}" มีจำนวนในสต็อกไม่พอ (เหลือเพียง ${prod.stockQuantity} ชิ้น)`
            });
          }
        }
      }

      // ตัดสต็อกสินค้าคงเหลือ
      for (const item of items) {
        const prod = mockProducts.find(p => p.id === item.id || p.name === item.name);
        if (prod) {
          prod.stockQuantity -= item.quantity;
          if (prod.stockQuantity <= 0) {
            prod.stockQuantity = 0;
            prod.isAvailable = false;
          }
        }
      }
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const totalAmount = (subtotal || 0) + (deliveryFee || 0);

    const newOrder = {
      id: orderNumber,
      orderNumber,
      lineUserId: lineUserId || 'MOCK_USER_001',
      storeName: storeName || 'ร้านอาหารตัวอย่าง',
      items: items || [
        { name: 'ข้าวผัดกะเพราหมูกรอบไข่ดาว', quantity: 1, price: 70 }
      ],
      deliveryAddress: deliveryAddress || '123 ถนนสุขุมวิท กทม.',
      deliveryLat: deliveryLat || 13.7563,
      deliveryLng: deliveryLng || 100.5018,
      subtotal: subtotal || 70,
      deliveryFee: deliveryFee || 25,
      totalAmount,
      paymentMethod: paymentMethod || 'COD',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    mockOrders.set(orderNumber, newOrder);

    // สร้าง Flex Message Payload
    const liffBaseUrl = process.env.LIFF_BASE_URL || 'https://liff.line.me/YOUR_LIFF_ID';
    const flexPayload = createOrderFlexMessage({
      ...newOrder,
      liffUrl: `${liffBaseUrl}?order_id=${orderNumber}`
    });

    // ถ้ามี LINE Token ให้ส่ง Push Message หาผู้สั่งซื้อ
    if (lineUserId) {
      await sendOrderFlexMessage(lineUserId, {
        ...newOrder,
        liffUrl: `${liffBaseUrl}?order_id=${orderNumber}`
      }).catch(err => console.log('Flex Push skipped/failed:', err.message));
    }

    return res.status(201).json({
      success: true,
      message: 'ออเดอร์ถูกสร้างและตัดสต็อกเรียบร้อยแล้ว',
      data: newOrder,
      products: mockProducts,
      flexPreview: flexPayload
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Order Details (ดึงข้อมูลออเดอร์)
router.get('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const order = mockOrders.get(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลออเดอร์นี้' });
  }

  // ดึงตำแหน่งไรเดอร์ล่าสุด (ถ้ามี)
  const riderLocation = order.riderId ? mockRiderLocations.get(order.riderId) : null;

  return res.json({
    success: true,
    data: {
      ...order,
      riderLocation
    }
  });
});

// 3. Update Order Status
router.patch('/orders/:id/status', async (req, res) => {
  const orderId = req.params.id;
  const { status, riderId } = req.body;

  const order = mockOrders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });
  }

  order.status = status || order.status;
  if (riderId) order.riderId = riderId;
  order.updatedAt = new Date().toISOString();

  mockOrders.set(orderId, order);

  return res.json({
    success: true,
    message: `อัปเดตสถานะออเดอร์เป็น ${order.status}`,
    data: order
  });
});

// 4. Update Rider GPS Location
router.post('/rider/location', (req, res) => {
  const { riderId, latitude, longitude, heading } = req.body;

  if (!riderId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  const locationData = {
    riderId,
    latitude,
    longitude,
    heading: heading || 0,
    updatedAt: new Date().toISOString()
  };

  mockRiderLocations.set(riderId, locationData);

  return res.json({
    success: true,
    message: 'อัปเดตตำแหน่งพิกัดไรเดอร์เรียบร้อย',
    data: locationData
  });
});

module.exports = router;
