const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'MOCK_TOKEN',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'MOCK_SECRET',
};

const client = new line.Client(config);

// Mock Database & Active Chatbot Carts
const userCarts = new Map(); // lineUserId => { items: [], state: 'IDLE' }

const PRODUCTS = [
  { id: 'p1', name: 'ก๋วยเตี๋ยวหมูน้ำตกพิเศษ', price: 60, stockQuantity: 25, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop' },
  { id: 'p2', name: 'ข้าวผัดกะเพราหมูกรอบไข่ดาว', price: 70, stockQuantity: 15, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop' },
  { id: 'p3', name: 'เกี๊ยวหมูทอดกรอบ', price: 35, stockQuantity: 5, image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=400&auto=format&fit=crop' },
  { id: 'p4', name: 'ชาไทยเย็นสูตรเข้มข้น', price: 40, stockQuantity: 30, image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&auto=format&fit=crop' },
];

/**
 * 1. ฟังก์ชันสร้าง Menu Carousel ในแชทสำหรับให้ลูกค้ากดเลือกซื้อสินค้าผ่าน Chatbot
 */
function createMenuCarouselFlex() {
  const bubbles = PRODUCTS.map(prod => ({
    type: 'bubble',
    hero: {
      type: 'image',
      url: prod.image,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: prod.name, weight: 'bold', size: 'sm', color: '#111111' },
        { type: 'text', text: `฿${prod.price}`, weight: 'bold', size: 'md', color: '#1DB446', margin: 'xs' },
        {
          type: 'text',
          text: prod.stockQuantity > 0 ? `คลังเหลือ: ${prod.stockQuantity} ชิ้น` : `🔴 สินค้าหมดสต็อก`,
          size: 'xs',
          color: prod.stockQuantity > 0 ? '#777777' : '#E53935',
          margin: 'xs'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: prod.stockQuantity > 0 ? 'primary' : 'secondary',
          color: prod.stockQuantity > 0 ? '#1DB446' : undefined,
          height: 'sm',
          action: {
            type: 'postback',
            label: prod.stockQuantity > 0 ? '+ เพิ่มลงตะกร้า' : 'สินค้าหมด',
            data: `action=ADD_TO_CART&productId=${prod.id}`
          }
        }
      ]
    }
  }));

  return {
    type: 'flex',
    altText: '🍜 เลือกสั่งอาหารผ่าน LINE Chatbot',
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

/**
 * 2. ฟังก์ชันแสดงตะกร้าสินค้าแบบมีปุ่มกดลบลายสินค้าได้ในแชท
 */
function createCartSummaryFlex(cartItems) {
  const subtotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const deliveryFee = cartItems.length > 0 ? 25 : 0;
  const total = subtotal + deliveryFee;

  const itemBoxes = cartItems.map(item => ({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: `${item.name} (x${item.quantity})`, size: 'xs', color: '#333333', flex: 4, weight: 'bold' },
      { type: 'text', text: `฿${item.price * item.quantity}`, size: 'xs', color: '#111111', align: 'end', flex: 2 },
      {
        type: 'button',
        style: 'secondary',
        height: 'sm',
        flex: 2,
        action: {
          type: 'postback',
          label: '❌ ลบ',
          data: `action=REMOVE_ITEM&productId=${item.id}`
        }
      }
    ]
  }));

  return {
    type: 'flex',
    altText: '🛍️ ตะกร้าสินค้าของคุณ (กดลบสินค้าได้)',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1DB446',
        contents: [
          { type: 'text', text: '🛍️ ตะกร้าสินค้าของคุณ', color: '#FFFFFF', weight: 'bold', size: 'md' },
          { type: 'text', text: 'ระบุชื่อเล่นและที่อยู่จัดส่งเพื่อยืนยันสั่งซื้อ', color: '#E8F5E9', size: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          ...itemBoxes,
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'ราคารวมสินค้า', size: 'xs', color: '#777777' },
              { type: 'text', text: `฿${subtotal}`, size: 'xs', color: '#777777', align: 'end' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'xs',
            contents: [
              { type: 'text', text: 'ค่าจัดส่ง', size: 'xs', color: '#777777' },
              { type: 'text', text: `฿${deliveryFee}`, size: 'xs', color: '#777777', align: 'end' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'ยอดรวมทั้งสิ้น', size: 'sm', weight: 'bold', color: '#111111' },
              { type: 'text', text: `฿${total}`, size: 'sm', weight: 'bold', color: '#1DB446', align: 'end' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1DB446',
            action: {
              type: 'postback',
              label: '👤 ยืนยันสั่งซื้อ (ระบุชื่อเล่น & ที่อยู่)',
              data: 'action=CONFIRM_CHECKOUT'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: '🗑️ ล้างตะกร้าทั้งหมด',
              data: 'action=CLEAR_CART'
            }
          }
        ]
      }
    }
  };
}

/**
 * 3. LINE Webhook Event Listener (รองรับกรอกชื่อเล่นและที่อยู่ลูกค้า)
 */
router.post('/webhook', async (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    const userId = event.source.userId || 'MOCK_USER';
    const replyToken = event.replyToken;

    if (!userCarts.has(userId)) {
      userCarts.set(userId, { items: [], state: 'IDLE' });
    }
    const cartSession = userCarts.get(userId);

    // -------------------------------------------------------------
    // A. ตัวจัดการกรณีผู้ใช้พิมพ์ข้อความ (Text Messages)
    // -------------------------------------------------------------
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      if (text.includes('เมนู') || text.includes('สั่งอาหาร') || text.includes('สั่งของ') || text.includes('หิว')) {
        const flexMsg = createMenuCarouselFlex();
        if (replyToken) {
          await client.replyMessage(replyToken, [
            { type: 'text', text: '🍜 ยินดีต้อนรับครับ! กดเลือกสินค้าเพิ่มลงตะกร้าจากรายการด้านล่างได้เลยครับ:' },
            flexMsg
          ]).catch(err => console.log('Reply skipped:', err.message));
        }
      } 
      else if (text.includes('ตะกร้า') || text.includes('เช็คเอาท์') || text.includes('สรุปยอด') || text.includes('ชำระเงิน')) {
        if (cartSession.items.length === 0) {
          if (replyToken) {
            await client.replyMessage(replyToken, { type: 'text', text: '🛒 ตะกร้าของคุณยังว่างอยู่ครับ! พิมพ์ "ดูเมนู" เพื่อเริ่มเลือกสั่งอาหารได้เลยครับ' });
          }
        } else {
          const flexMsg = createCartSummaryFlex(cartSession.items);
          if (replyToken) {
            await client.replyMessage(replyToken, flexMsg).catch(err => console.log('Reply skipped:', err.message));
          }
        }
      }
      else if (text.includes('ล้างตะกร้า') || text.includes('ยกเลิก')) {
        cartSession.items = [];
        cartSession.state = 'IDLE';
        if (replyToken) {
          await client.replyMessage(replyToken, { type: 'text', text: '🗑️ ล้างตะกร้าสินค้าเรียบร้อยแล้วครับ!' });
        }
      }
      // กรณีลูกค้าระบุชื่อเล่นและที่อยู่จัดส่งเข้ามาในแชท
      else if (cartSession.state === 'WAITING_FOR_INFO' || text.includes('คุณ') || text.includes('ส่งที่') || text.includes('คอนโด')) {
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
        const subtotal = cartSession.items.reduce((s, i) => s + (i.price * i.quantity), 0);
        const totalAmount = subtotal + 25;

        const successMsg = `🎉 สั่งซื้อสำเร็จแล้วครับ!\nหมายเลขออเดอร์: #${orderNumber}\n👤 ชื่อลูกค้า: ${text.split('-')[0] || text.split(' ')[0]}\n🏠 ที่อยู่จัดส่ง: ${text}\n💰 ยอดรวมชำระเงิน (COD): ฿${totalAmount}\n\nร้านค้าและไรเดอร์กำลังจัดเตรียมอาหารให้คุณครับ!`;
        
        cartSession.items = [];
        cartSession.state = 'IDLE';

        if (replyToken) {
          await client.replyMessage(replyToken, { type: 'text', text: successMsg }).catch(err => console.log('Reply skipped:', err.message));
        }
      }
      else {
        if (replyToken) {
          await client.replyMessage(replyToken, {
            type: 'text',
            text: 'สวัสดีครับ! ยินดีต้อนรับสู่ร้านค้าสั่งซื้อผ่าน LINE Chatbot🤖\n\n• พิมพ์ "ดูเมนู" เพื่อสั่งอาหาร\n• พิมพ์ "ตะกร้า" เพื่อเช็ค/ลบสินค้าในตะกร้า\n• พิมพ์ "เช็คสต็อก" เพื่อดูคลังสินค้า'
          }).catch(err => console.log('Reply skipped:', err.message));
        }
      }
    }

    // -------------------------------------------------------------
    // B. ตัวจัดการกรณีผู้ใช้กดปุ่ม (Postback Events)
    // -------------------------------------------------------------
    if (event.type === 'postback') {
      const dataParams = new URLSearchParams(event.postback.data);
      const action = dataParams.get('action');
      const productId = dataParams.get('productId');

      if (action === 'ADD_TO_CART') {
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          const existing = cartSession.items.find(i => i.id === productId);
          if (existing) {
            existing.quantity += 1;
          } else {
            cartSession.items.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });
          }

          const currentTotal = cartSession.items.reduce((s, i) => s + (i.price * i.quantity), 0);
          const replyText = `✅ เพิ่ม "${product.name}" ลงในตะกร้าเรียบร้อยแล้ว!\n🛒 ในตะกร้ามี ${cartSession.items.length} รายการ (฿${currentTotal})\n\nพิมพ์ "ตะกร้า" เพื่อยืนยันสั่งซื้อครับ`;

          if (replyToken) {
            await client.replyMessage(replyToken, { type: 'text', text: replyText }).catch(err => console.log('Reply skipped:', err.message));
          }
        }
      } 
      else if (action === 'REMOVE_ITEM') {
        const removedItem = cartSession.items.find(i => i.id === productId);
        cartSession.items = cartSession.items.filter(i => i.id !== productId);

        if (cartSession.items.length === 0) {
          if (replyToken) {
            await client.replyMessage(replyToken, {
              type: 'text',
              text: `❌ ลบ "${removedItem?.name || 'สินค้า'}" ออกเรียบร้อยแล้ว!`
            }).catch(err => console.log('Reply skipped:', err.message));
          }
        } else {
          const flexMsg = createCartSummaryFlex(cartSession.items);
          if (replyToken) {
            await client.replyMessage(replyToken, [
              { type: 'text', text: `❌ ลบ "${removedItem?.name || 'สินค้า'}" ออกจากตะกร้าเรียบร้อยแล้ว!` },
              flexMsg
            ]).catch(err => console.log('Reply skipped:', err.message));
          }
        }
      }
      else if (action === 'CONFIRM_CHECKOUT') {
        cartSession.state = 'WAITING_FOR_INFO';
        if (replyToken) {
          await client.replyMessage(replyToken, {
            type: 'text',
            text: '👤 โปรดพิมพ์ระบุ "ชื่อเล่น" และ "ที่อยู่จัดส่ง" ของคุณในแชทนี้ได้เลยครับ\n(ตัวอย่าง: คุณแจ็ค - 123/45 คอนโดสุขุมวิท ซอย 21 กทม.)'
          }).catch(err => console.log('Reply skipped:', err.message));
        }
      } 
      else if (action === 'CLEAR_CART') {
        cartSession.items = [];
        cartSession.state = 'IDLE';
        if (replyToken) {
          await client.replyMessage(replyToken, { type: 'text', text: '🗑️ ล้างตะกร้าสินค้าทั้งหมดเรียบร้อยแล้วครับ' }).catch(err => console.log('Reply skipped:', err.message));
        }
      }
    }
  }

  return res.status(200).send('OK');
});

module.exports = {
  router,
  createMerchantFlexMessage: () => {},
  createRiderJobFlexMessage: () => {},
  createStockManagementFlexMessage: () => {}
};
