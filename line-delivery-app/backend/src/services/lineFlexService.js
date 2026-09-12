const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'MOCK_TOKEN',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'MOCK_SECRET',
};

const client = new line.Client(config);

/**
 * สร้าง Flex Message Object สำหรับแสดงใบเสร็จและปุ่มติดตามสถานะ
 */
function createOrderFlexMessage(order) {
  const {
    orderNumber,
    storeName,
    items,
    subtotal,
    deliveryFee,
    totalAmount,
    deliveryAddress,
    liffUrl,
    heroImageUrl
  } = order;

  // แปลงรายการสินค้าให้อยู่ในโครงสร้าง Flex Box
  const itemBoxes = items.map((item) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${item.name} (x${item.quantity})`,
        size: 'sm',
        color: '#555555',
        flex: 4
      },
      {
        type: 'text',
        text: `฿${item.price * item.quantity}`,
        size: 'sm',
        color: '#111111',
        align: 'end',
        flex: 2
      }
    ]
  }));

  return {
    type: 'flex',
    altText: `ใบเสร็จคำสั่งซื้อ #${orderNumber} จาก ${storeName}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: heroImageUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: storeName,
            weight: 'bold',
            size: 'xl',
            color: '#1DB446'
          },
          {
            type: 'text',
            text: `หมายเลขออเดอร์: #${orderNumber}`,
            size: 'xs',
            color: '#888888',
            margin: 'xs'
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: itemBoxes
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ราคารวมสินค้า', size: 'xs', color: '#888888' },
                  { type: 'text', text: `฿${subtotal}`, size: 'xs', color: '#888888', align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ค่าจัดส่ง', size: 'xs', color: '#888888' },
                  { type: 'text', text: `฿${deliveryFee}`, size: 'xs', color: '#888888', align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                contents: [
                  { type: 'text', text: 'ยอดรวมทั้งสิ้น', size: 'md', weight: 'bold', color: '#111111' },
                  { type: 'text', text: `฿${totalAmount}`, size: 'md', weight: 'bold', color: '#1DB446', align: 'end' }
                ]
              }
            ]
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            contents: [
              { type: 'text', text: '📍 สถานที่จัดส่ง:', size: 'xs', weight: 'bold', color: '#555555' },
              {
                type: 'text',
                text: deliveryAddress,
                size: 'xs',
                color: '#777777',
                wrap: true,
                margin: 'xs'
              }
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
            height: 'sm',
            action: {
              type: 'uri',
              label: '🛵 ติดตามสถานะออเดอร์',
              uri: liffUrl || `https://liff.line.me/YOUR_LIFF_ID?order_id=${orderNumber}`
            }
          }
        ]
      }
    }
  };
}

/**
 * ส่ง Flex Message แจ้งเตือนไปยังลูกค้า
 */
async function sendOrderFlexMessage(lineUserId, orderData) {
  try {
    const flexMessage = createOrderFlexMessage(orderData);
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN !== 'YOUR_LINE_CHANNEL_ACCESS_TOKEN') {
      await client.pushMessage(lineUserId, flexMessage);
      console.log(`[LINE Service] Sent Push Flex Message to user ${lineUserId}`);
    } else {
      console.log(`[Mock LINE Service] Flex Message payload generated for ${lineUserId}`);
    }
    return flexMessage;
  } catch (error) {
    console.error('[LINE Service Error]', error);
    throw error;
  }
}

module.exports = {
  createOrderFlexMessage,
  sendOrderFlexMessage
};
