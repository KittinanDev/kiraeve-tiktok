import React, { useState, useEffect } from 'react';
import { initLiff } from './services/liffService';
import CustomerOrderPage from './components/CustomerOrderPage';
import {
  Bike,
  Clock,
  MapPin,
  Store,
  Phone,
  Navigation,
  RefreshCw,
  PackageCheck,
  AlertCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const INITIAL_PRODUCTS = [
  { id: 'p1', name: 'ก๋วยเตี๋ยวหมูน้ำตกพิเศษ', category: 'noodle', price: 60, stockQuantity: 25, isAvailable: true, description: 'น้ำตกเข้มข้น หมูนุ่ม ลูกชิ้นแน่น', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop' },
  { id: 'p2', name: 'ข้าวผัดกะเพราหมูกรอบไข่ดาว', category: 'rice', price: 70, stockQuantity: 15, isAvailable: true, description: 'กะเพราแท้หมูกรอบกร๊อบกรอบ พร้อมไข่ดาวเป็ด', image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop' },
  { id: 'p3', name: 'เกี๊ยวหมูทอดกรอบ', category: 'snack', price: 35, stockQuantity: 5, isAvailable: true, description: 'เกี๊ยวหมูเด้งทอดกรอบเสิร์ฟพร้อมน้ำจิ้มบ๊วย', image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop' },
  { id: 'p4', name: 'ชาไทยเย็นสูตรเข้มข้น', category: 'drink', price: 40, stockQuantity: 30, isAvailable: true, description: 'ชาไทยคั่วหอม หวานมันกำลังดี', image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&auto=format&fit=crop' },
];

export default function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'stock' | 'tracking' | 'rider'
  
  // Products & Stock State
  const [products, setProducts] = useState(INITIAL_PRODUCTS);

  // Cart & Order State
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [flexPreview, setFlexPreview] = useState(null);

  // Rider Location Sim
  const [riderLocation, setRiderLocation] = useState({ lat: 13.7563, lng: 100.5018 });

  useEffect(() => {
    initLiff().then(profile => {
      if (profile) setUserProfile(profile);
    });
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      const data = await res.json();
      if (data.success && data.data) {
        // Merge category fallback
        const merged = data.data.map(p => ({
          ...p,
          category: p.category || (p.id === 'p1' ? 'noodle' : p.id === 'p2' ? 'rice' : p.id === 'p3' ? 'snack' : 'drink')
        }));
        setProducts(merged);
      }
    } catch (err) {
      console.log('Using initial products state fallback');
    }
  };

  // Merchant Adjust Stock
  const handleUpdateStock = async (productId, newStock) => {
    const targetStock = Math.max(0, newStock);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stockQuantity: targetStock, isAvailable: targetStock > 0 } : p));

    try {
      await fetch(`${API_BASE}/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: targetStock, isAvailable: targetStock > 0 })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Submit Order to Backend (และตัดสต็อก)
  const handlePlaceOrder = async (orderPayload) => {
    setLoading(true);

    try {
      const payload = {
        lineUserId: userProfile?.userId,
        storeName: 'ร้านก๋วยเตี๋ยวเรือ & กะเพราถาดยอดฮิต',
        items: orderPayload.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, note: i.note })),
        deliveryAddress: orderPayload.deliveryAddress,
        subtotal: orderPayload.subtotal,
        deliveryFee: orderPayload.deliveryFee,
        paymentMethod: orderPayload.paymentMethod,
        specialNote: orderPayload.specialNote
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setCurrentOrder(data.data);
        setOrderStatus('PENDING');
        setFlexPreview(data.flexPreview);
        if (data.products) setProducts(data.products);
        setCart([]);
        setActiveTab('tracking');
      } else {
        alert(data.message || 'ไม่สามารถสั่งซื้อได้');
      }
    } catch (err) {
      console.error(err);
      alert('สร้างออเดอร์ไม่สำเร็จ (โปรดตรวจสอบว่า Backend run อยู่)');
    } finally {
      setLoading(false);
    }
  };

  // 2. Rider Updates Status
  const handleRiderUpdateStatus = async (newStatus) => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${currentOrder.orderNumber}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, riderId: userProfile?.userId || 'RIDER_01' })
      });
      const data = await res.json();
      if (data.success) {
        setOrderStatus(newStatus);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Update Rider GPS
  const handleSimulateGPS = async () => {
    const nextLat = riderLocation.lat + 0.001;
    const nextLng = riderLocation.lng + 0.001;
    setRiderLocation({ lat: nextLat, lng: nextLng });

    try {
      await fetch(`${API_BASE}/rider/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: 'RIDER_01',
          latitude: nextLat,
          longitude: nextLng,
          heading: 45
        })
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col shadow-xl pb-20">
      
      {/* Header Profile */}
      <header className="bg-line text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <img
            src={userProfile?.pictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop'}
            alt="Profile"
            className="w-10 h-10 rounded-full border-2 border-white object-cover"
          />
          <div>
            <div className="text-xs opacity-90">ยินดีต้อนรับคุณ</div>
            <div className="font-semibold text-sm leading-tight">{userProfile?.displayName || 'คุณลูกค้า (LINE User)'}</div>
          </div>
        </div>
        <div className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
          LIFF Connected
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="grid grid-cols-4 bg-white border-b text-[11px] font-medium text-center">
        <button
          onClick={() => setActiveTab('customer')}
          className={`py-3 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'customer' ? 'text-line border-b-2 border-line font-bold bg-green-50/50' : 'text-gray-500'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>เลือกสินค้า</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`py-3 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'stock' ? 'text-line border-b-2 border-line font-bold bg-green-50/50' : 'text-gray-500'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>คลังสินค้า</span>
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`py-3 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'tracking' ? 'text-line border-b-2 border-line font-bold bg-green-50/50' : 'text-gray-500'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>สถานะ</span>
        </button>

        <button
          onClick={() => setActiveTab('rider')}
          className={`py-3 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'rider' ? 'text-line border-b-2 border-line font-bold bg-green-50/50' : 'text-gray-500'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>ไรเดอร์</span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="p-4 flex-1">

        {/* TAB 1: CUSTOMER ORDER PAGE */}
        {activeTab === 'customer' && (
          <CustomerOrderPage
            products={products}
            cart={cart}
            setCart={setCart}
            onPlaceOrder={handlePlaceOrder}
            loading={loading}
          />
        )}

        {/* TAB 2: MERCHANT STOCK MANAGEMENT */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm space-y-1">
              <div className="flex justify-between items-center">
                <div className="font-bold text-sm flex items-center">
                  <PackageCheck className="w-4 h-4 mr-2 text-green-400" /> แผงจัดการสต็อกสินค้า (Merchant)
                </div>
              </div>
              <p className="text-xs text-slate-300">
                ปรับจำนวนสินค้าคงเหลือเรียลไทม์ หากสต็อกเป็น 0 ระบบจะปิดไม่ให้ลูกค้ากดสั่งซื้อโดยอัตโนมัติ
              </p>
            </div>

            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className="bg-white rounded-xl p-4 border shadow-sm space-y-3">
                  <div className="flex items-center space-x-3">
                    <img src={product.image} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-xs text-gray-900">{product.name}</div>
                      <div className="text-xs text-line font-bold">฿{product.price}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        สถานะ: {product.stockQuantity > 0 ? (
                          <span className="text-green-600 font-bold">พร้อมขาย</span>
                        ) : (
                          <span className="text-red-500 font-bold">สินค้าหมด</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock Control Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="font-bold text-gray-700">จำนวนสต็อกคงเหลือ:</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleUpdateStock(product.id, product.stockQuantity - 5)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-2 py-1 rounded border text-xs"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleUpdateStock(product.id, product.stockQuantity - 1)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded border border-red-200 text-xs"
                      >
                        -1
                      </button>

                      <span className="font-bold text-base w-8 text-center text-gray-900">
                        {product.stockQuantity}
                      </span>

                      <button
                        onClick={() => handleUpdateStock(product.id, product.stockQuantity + 1)}
                        className="bg-green-50 hover:bg-green-100 text-green-600 font-bold px-2.5 py-1 rounded border border-green-200 text-xs"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleUpdateStock(product.id, product.stockQuantity + 10)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-2 py-1 rounded border text-xs"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ORDER TRACKING */}
        {activeTab === 'tracking' && (
          <div className="space-y-5">
            {!currentOrder ? (
              <div className="bg-white rounded-xl p-8 text-center border shadow-sm space-y-3">
                <Clock className="w-12 h-12 text-gray-300 mx-auto" />
                <div className="font-bold text-gray-700 text-sm">ยังไม่มีคำสั่งซื้อล่าสุด</div>
                <p className="text-xs text-gray-400">เลือกสินค้าและกดสั่งซื้อได้ที่แท็บ "เลือกสินค้า"</p>
                <button
                  onClick={() => setActiveTab('customer')}
                  className="bg-line text-white text-xs px-4 py-2 rounded-lg font-medium"
                >
                  เริ่มเลือกสินค้า
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 border shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="text-xs text-gray-400">หมายเลขออเดอร์</div>
                      <div className="font-bold text-sm text-gray-900">#{currentOrder.orderNumber}</div>
                    </div>
                    <span className="bg-green-100 text-line font-bold text-xs px-2.5 py-1 rounded-full animate-pulse">
                      {orderStatus === 'PENDING' && 'รอร้านรับงาน'}
                      {orderStatus === 'PREPARING' && 'กำลังเตรียมอาหาร'}
                      {orderStatus === 'PICKED_UP' && 'ไรเดอร์กำลังนำส่ง'}
                      {orderStatus === 'DELIVERED' && 'ส่งสำเร็จแล้ว 🎉'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-medium text-gray-500">
                    <div className={`p-2 rounded-lg ${orderStatus === 'PENDING' ? 'bg-line text-white font-bold' : 'bg-gray-100'}`}>
                      1. รอยืนยัน
                    </div>
                    <div className={`p-2 rounded-lg ${orderStatus === 'PREPARING' ? 'bg-line text-white font-bold' : 'bg-gray-100'}`}>
                      2. ร้านทำอาหาร
                    </div>
                    <div className={`p-2 rounded-lg ${orderStatus === 'PICKED_UP' ? 'bg-line text-white font-bold' : 'bg-gray-100'}`}>
                      3. ไรเดอร์ส่งของ
                    </div>
                    <div className={`p-2 rounded-lg ${orderStatus === 'DELIVERED' ? 'bg-line text-white font-bold' : 'bg-gray-100'}`}>
                      4. สำเร็จ
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-line">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">พี่สมชาย ไรเดอร์สายสปีด</div>
                        <div className="text-[11px] text-gray-500">ทะเบียน กข-9999 กทม.</div>
                      </div>
                    </div>
                    <button className="p-2 bg-slate-100 rounded-full text-line">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-slate-100 rounded-lg h-36 border relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="text-center space-y-1 z-10">
                      <Navigation className="w-6 h-6 text-line mx-auto animate-bounce" />
                      <div className="text-xs font-bold text-gray-700">พิกัดไรเดอร์เรียลไทม์</div>
                      <div className="text-[10px] text-gray-500">
                        Lat: {riderLocation.lat.toFixed(4)}, Lng: {riderLocation.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RIDER DASHBOARD */}
        {activeTab === 'rider' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <div className="font-bold text-sm flex items-center">
                  <Bike className="w-4 h-4 mr-2 text-green-400" /> แผงควบคุมสำหรับไรเดอร์
                </div>
                <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">ONLINE</span>
              </div>
              <p className="text-xs text-slate-300">
                เมื่อลูกค้าสั่งอาหารผ่าน LINE ออเดอร์จะเด้งมาที่หน้านี้ให้ไรเดอร์กดรับงาน
              </p>
            </div>

            {!currentOrder ? (
              <div className="bg-white rounded-xl p-6 text-center border text-xs text-gray-400">
                ขณะนี้ไม่มีงานใหม่เข้ามาในระบบ
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 border shadow-md space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-xs text-gray-700">งานใหม่ #{currentOrder.orderNumber}</span>
                  <span className="text-xs text-line font-bold">฿{currentOrder.deliveryFee} (ค่ารอบ)</span>
                </div>

                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start space-x-2">
                    <Store className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-gray-800">จุดรับ: {currentOrder.storeName}</div>
                      <div className="text-[10px] text-gray-400">ระยะทาง 1.2 กม.</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-line mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-gray-800">🏠 ที่อยู่จัดส่งของลูกค้า: {currentOrder.deliveryAddress}</div>
                      <div className="text-[10px] text-gray-400">ลูกค้าชำระเงินแบบ: {currentOrder.paymentMethod}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs font-bold text-gray-700">อัปเดตสถานะการจัดส่ง:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRiderUpdateStatus('PREPARING')}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 rounded-lg text-xs"
                    >
                      🍳 ร้านกำลังทำอาหาร
                    </button>
                    <button
                      onClick={() => handleRiderUpdateStatus('PICKED_UP')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs"
                    >
                      🛵 รับอาหารแล้ว (กำลังส่ง)
                    </button>
                  </div>
                  <button
                    onClick={() => handleRiderUpdateStatus('DELIVERED')}
                    className="w-full bg-line hover:bg-line-hover text-white font-bold py-2.5 rounded-lg text-xs shadow-xs"
                  >
                    ✅ จัดส่งเรียบร้อยแล้ว (Delivered)
                  </button>

                  <button
                    onClick={handleSimulateGPS}
                    className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg text-xs flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    <span>จำลองส่งพิกัด GPS ใหม่ (+0.001)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
}
