import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  MapPin,
  ChevronRight,
  Plus,
  Minus,
  AlertCircle,
  X,
  CreditCard,
  Utensils,
  Clock,
  UserCheck
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', name: 'ทั้งหมด', icon: '🍽️' },
  { id: 'noodle', name: 'ก๋วยเตี๋ยว', icon: '🍜' },
  { id: 'rice', name: 'เมนูข้าว', icon: '🍚' },
  { id: 'snack', name: 'ของทานเล่น', icon: '🥟' },
  { id: 'drink', name: 'เครื่องดื่ม', icon: '🥤' }
];

export default function CustomerOrderPage({ products, cart, setCart, onPlaceOrder, loading }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerNickname, setCustomerNickname] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('123/45 คอนโดสุขุมวิทวิลล์ ซอย 21 ถนนสุขุมวิท กทม.');
  const [specialNote, setSpecialNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');

  // Filter products by Category & Search
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > product.stockQuantity) {
      alert(`ขออภัย สินค้า "${product.name}" เหลือในสต็อกเพียง ${product.stockQuantity} ชิ้น`);
      return;
    }

    setCart(prev => {
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, note: '' }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const updateCartNote = (productId, note) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, note } : item));
  };

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = totalItemsCount > 0 ? 25 : 0;
  const totalAmount = subtotal + deliveryFee;

  const handleConfirmCheckout = () => {
    if (cart.length === 0) return;
    if (!customerNickname.trim()) {
      alert('โปรดกรอก "ชื่อเล่นของคุณ" ก่อนกดยืนยันการสั่งซื้อครับ');
      return;
    }
    onPlaceOrder({
      items: cart,
      customerNickname: customerNickname.trim(),
      deliveryAddress,
      subtotal,
      deliveryFee,
      paymentMethod,
      specialNote
    });
    setIsCartOpen(false);
  };

  return (
    <div className="space-y-4 pb-24">

      {/* Store Cover & Header */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border">
        <div className="h-32 bg-cover bg-center relative" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop')` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
          <div className="absolute bottom-3 left-3 right-3 text-white flex justify-between items-end">
            <div>
              <span className="bg-line text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                ร้านค้าทางการ LINE
              </span>
              <h1 className="text-base font-bold leading-tight mt-1">ร้านก๋วยเตี๋ยวเรือ & กะเพราถาดนายเอก</h1>
              <p className="text-[11px] text-gray-200 flex items-center mt-0.5">
                <Clock className="w-3 h-3 mr-1" /> เปิด 09:00 - 20:00 น. • ⭐️ 4.8 (120+ รีวิว)
              </p>
            </div>
          </div>
        </div>

        {/* Address Banner */}
        <div className="p-3 bg-green-50/50 flex items-center justify-between text-xs border-t">
          <div className="flex items-center text-gray-700 font-medium truncate mr-2">
            <MapPin className="w-4 h-4 text-line shrink-0 mr-1.5" />
            <span className="truncate">ส่งไปที่: {deliveryAddress}</span>
          </div>
          <button
            onClick={() => {
              const newAddr = prompt('กรอกที่อยู่จัดส่งใหม่:', deliveryAddress);
              if (newAddr) setDeliveryAddress(newAddr);
            }}
            className="text-line font-bold shrink-0 hover:underline"
          >
            เปลี่ยน
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาชื่ออาหาร..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-line shadow-2xs"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills Slider */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center space-x-1.5 shadow-2xs ${
              selectedCategory === cat.id
                ? 'bg-line text-white font-bold shadow-xs'
                : 'bg-white text-gray-700 border hover:bg-gray-50'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Product List Cards */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-600 flex items-center justify-between">
          <span>รายการอาหาร ({filteredProducts.length})</span>
          <span className="text-[10px] text-gray-400 font-normal">เช็คสต็อกเรียลไทม์</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border text-xs text-gray-400 space-y-2">
            <Utensils className="w-8 h-8 text-gray-300 mx-auto" />
            <div>ไม่พบรายการอาหารที่ค้นหา</div>
          </div>
        ) : (
          filteredProducts.map(product => {
            const cartItem = cart.find(i => i.id === product.id);
            const isOutOfStock = product.stockQuantity <= 0 || !product.isAvailable;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-xl p-3 shadow-sm border flex items-center justify-between transition-all ${
                  isOutOfStock ? 'opacity-65 bg-gray-50' : 'hover:border-green-200'
                }`}
              >
                <img src={product.image} alt={product.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                
                <div className="flex-1 px-3 min-w-0">
                  <div className="font-semibold text-xs text-gray-900 truncate">{product.name}</div>
                  <div className="text-line font-bold text-sm mt-0.5">฿{product.price}</div>
                  
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">
                    {product.description || 'อร่อยสดใหม่ ทำตามออเดอร์'}
                  </p>

                  <div className="mt-1">
                    {isOutOfStock ? (
                      <span className="inline-flex items-center text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded">
                        <AlertCircle className="w-3 h-3 mr-0.5" /> สินค้าหมดสต็อก
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        คลังเหลือ: <strong className="ml-1 text-gray-900">{product.stockQuantity}</strong> ชิ้น
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isOutOfStock ? (
                    <span className="text-xs font-bold text-gray-400 bg-gray-200 px-3 py-1.5 rounded-lg">
                      หมด
                    </span>
                  ) : cartItem ? (
                    <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="w-7 h-7 rounded-md bg-white font-bold text-sm shadow-xs text-red-500 flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold px-1 min-w-4 text-center">{cartItem.quantity}</span>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-7 h-7 rounded-md bg-line font-bold text-sm text-white shadow-xs flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-line hover:bg-line-hover text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xs transition-all flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>สั่งซื้อ</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-line text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between hover:bg-line-hover transition-all animate-bounce-short"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-white text-line font-bold text-xs rounded-full flex items-center justify-center">
                {totalItemsCount}
              </div>
              <span className="font-bold text-xs">ดูตะกร้าสินค้า</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm">฿{totalAmount}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* CHECKOUT MODAL / DRAWER WITH NICKNAME FIELD */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-slide-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-line" />
                <h3 className="font-bold text-sm text-gray-900">สรุปการสั่งซื้อสินค้า</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Nickname Required Input */}
            <div className="bg-green-50 p-3 rounded-xl border border-green-200 space-y-1.5">
              <label className="text-xs font-bold text-gray-800 flex items-center">
                <UserCheck className="w-4 h-4 text-line mr-1.5" /> ระบุชื่อเล่นของคุณ <span className="text-red-500 ml-1">*จำเป็น</span>
              </label>
              <input
                type="text"
                placeholder="เช่น คุณแจ็ค, คุณนิว (เพื่อความสะดวกของไรเดอร์)"
                value={customerNickname}
                onChange={e => setCustomerNickname(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-line font-medium"
              />
            </div>

            {/* Selected Items List with Note Input */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-gray-700">รายการอาหารในตะกร้า ({cart.length})</div>
              {cart.map(item => (
                <div key={item.id} className="bg-slate-50 p-3 rounded-xl border space-y-2 text-xs">
                  <div className="flex justify-between items-start font-medium">
                    <span className="font-bold text-gray-800">{item.name}</span>
                    <span className="font-bold text-gray-900">฿{item.price * item.quantity}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก..."
                      value={item.note || ''}
                      onChange={e => updateCartNote(item.id, e.target.value)}
                      className="bg-white border rounded-lg px-2.5 py-1 text-[11px] w-3/5 focus:outline-none focus:border-line"
                    />

                    <div className="flex items-center space-x-2 bg-white rounded-lg p-0.5 border">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-5 h-5 font-bold text-red-500 flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="font-bold px-1 text-[11px]">{item.quantity}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-5 h-5 font-bold text-line flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 border-t pt-3">
              <label className="text-xs font-bold text-gray-700 flex items-center">
                <CreditCard className="w-3.5 h-3.5 text-line mr-1" /> เลือกวิธีชำระเงิน
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                    paymentMethod === 'COD' ? 'border-line bg-green-50 text-line font-bold' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  💵 เก็บเงินสด (COD)
                </button>
                <button
                  onClick={() => setPaymentMethod('PROMPTPAY')}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                    paymentMethod === 'PROMPTPAY' ? 'border-line bg-green-50 text-line font-bold' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  📲 สแกน QR PromptPay
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-gray-600 border">
              <div className="flex justify-between">
                <span>ราคารวมสินค้า</span>
                <span>฿{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าจัดส่ง</span>
                <span>฿{deliveryFee}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-gray-900 border-t pt-1.5">
                <span>ยอดรวมสุทธิ</span>
                <span className="text-line text-base">฿{totalAmount}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmCheckout}
              disabled={loading}
              className="w-full bg-line hover:bg-line-hover text-white font-bold py-3.5 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>กำลังยิงออเดอร์เข้า LINE...</span>
              ) : (
                <>
                  <span>ยืนยันการสั่งซื้อผ่าน LINE</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
