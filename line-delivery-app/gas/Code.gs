/**
 * ============================================================================
 * LINE Food Delivery & Rider System - Google Apps Script (GAS) Implementation
 * ============================================================================
 * ระบบสั่งอาหาร สต็อกสินค้า และแจ้งเตือนไรเดอร์ 100% บน Google Apps Script + Google Sheets
 */

const LINE_ACCESS_TOKEN = "YOUR_LINE_CHANNEL_ACCESS_TOKEN";

/**
 * 1. Webhook Entry Point (doPost) รับค่าจาก LINE Platform
 */
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    const events = json.events || [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // ----------------------------------------------------------------------
      // A. จัดการกรณีผู้ใช้พิมพ์ข้อความ (Text Messages)
      // ----------------------------------------------------------------------
      if (event.type === "message" && event.message.type === "text") {
        const text = event.message.text.trim();

        if (text.indexOf("เมนู") !== -1 || text.indexOf("สั่งอาหาร") !== -1 || text.indexOf("สั่งของ") !== -1) {
          const flexCarousel = createMenuFlexCarouselGAS();
          replyLineMessage(replyToken, [
            { type: "text", text: "🍜 ยินดีต้อนรับครับ! เลือกสินค้าเพิ่มลงตะกร้าจากเมนูด้านล่างได้เลยครับ:" },
            flexCarousel
          ]);
        }
        else if (text.indexOf("เช็คสต็อก") !== -1 || text.indexOf("สต็อก") !== -1) {
          const stockFlex = createStockFlexGAS();
          replyLineMessage(replyToken, [stockFlex]);
        }
        else if (text.indexOf("ตะกร้า") !== -1 || text.indexOf("สรุปยอด") !== -1) {
          const cartFlex = getCartSummaryFlexGAS(userId);
          replyLineMessage(replyToken, [cartFlex]);
        }
        else {
          replyLineMessage(replyToken, [
            {
              type: "text",
              text: "สวัสดีครับ! สั่งอาหารและเช็คสต็อกผ่าน LINE Chatbot🤖 (Google Apps Script)\n\n• พิมพ์ 'ดูเมนู' เพื่อสั่งซื้ออาหาร\n• พิมพ์ 'เช็คสต็อก' เพื่อดูสินค้าคงเหลือ\n• พิมพ์ 'ตะกร้า' เพื่อดูรายการและสั่งซื้อ"
            }
          ]);
        }
      }

      // ----------------------------------------------------------------------
      // B. จัดการกรณีผู้ใช้กดปุ่ม (Postback Events)
      // ----------------------------------------------------------------------
      if (event.type === "postback") {
        const data = event.postback.data;
        const params = parseQueryStringGAS(data);
        const action = params.action;

        if (action === "ADD_TO_CART") {
          addToCartGAS(userId, params.productId);
          replyLineMessage(replyToken, [
            { type: "text", text: `✅ เพิ่มสินค้าลงตะกร้าเรียบร้อยแล้ว!\nพิมพ์ 'ตะกร้า' เพื่อดูรายการและยืนยันสั่งซื้อครับ` }
          ]);
        }
        else if (action === "REMOVE_ITEM") {
          removeFromCartGAS(userId, params.productId);
          const cartFlex = getCartSummaryFlexGAS(userId);
          replyLineMessage(replyToken, [
            { type: "text", text: "❌ ลบสินค้าออกจากตะกร้าเรียบร้อยแล้ว" },
            cartFlex
          ]);
        }
        else if (action === "CONFIRM_CHECKOUT") {
          replyLineMessage(replyToken, [
            {
              type: "text",
              text: "👤 โปรดพิมพ์ระบุ 'ชื่อเล่น' และ 'ที่อยู่จัดส่ง' ของคุณในแชทนี้ได้เลยครับ\n(ตัวอย่าง: คุณแจ็ค - 123/45 คอนโดสุขุมวิท ซอย 21 กทม.)"
            }
          ]);
        }
        else if (action === "ADD_STOCK") {
          updateStockInSheetGAS(params.productId, parseInt(params.amount || 10));
          replyLineMessage(replyToken, [
            { type: "text", text: `📦 เพิ่มสต็อกสินค้า ID: ${params.productId} จำนวน +${params.amount} ชิ้น ใน Google Sheets เรียบร้อย!` }
          ]);
        }
      }
    }
  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 2. ฟังก์ชันดึงสินค้าจาก Google Sheets (Sheet Name: "Products")
 */
function getProductsFromSheetGAS() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  if (!sheet) {
    return [
      { id: "p1", name: "ก๋วยเตี๋ยวหมูน้ำตกพิเศษ", price: 60, stock: 25, image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop" },
      { id: "p2", name: "ข้าวผัดกะเพราหมูกรอบไข่ดาว", price: 70, stock: 15, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop" }
    ];
  }

  const data = sheet.getDataRange().getValues();
  const products = [];
  for (let i = 1; i < data.length; i++) {
    products.push({
      id: data[i][0],
      name: data[i][1],
      price: Number(data[i][2]),
      stock: Number(data[i][3]),
      image: data[i][4]
    });
  }
  return products;
}

/**
 * 3. ฟังก์ชันสร้าง Menu Flex Carousel
 */
function createMenuFlexCarouselGAS() {
  const products = getProductsFromSheetGAS();
  const bubbles = products.map(function(p) {
    return {
      type: "bubble",
      hero: {
        type: "image",
        url: p.image,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: p.name, weight: "bold", size: "sm", color: "#111111" },
          { type: "text", text: "฿" + p.price, weight: "bold", size: "md", color: "#1DB446", margin: "xs" },
          { type: "text", text: p.stock > 0 ? "คลังเหลือ: " + p.stock + " ชิ้น" : "🔴 หมดสต็อก", size: "xs", color: p.stock > 0 ? "#777777" : "#E53935" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: p.stock > 0 ? "primary" : "secondary",
            color: p.stock > 0 ? "#1DB446" : undefined,
            height: "sm",
            action: {
              type: "postback",
              label: p.stock > 0 ? "+ เพิ่มลงตะกร้า" : "สินค้าหมด",
              data: "action=ADD_TO_CART&productId=" + p.id
            }
          }
        ]
      }
    };
  });

  return {
    type: "flex",
    altText: "🍜 เมนูสั่งอาหารผ่าน LINE Chatbot",
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}

/**
 * 4. ฟังก์ชันยิง Reply Message กลับไปยัง LINE Platform
 */
function replyLineMessage(replyToken, messages) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: messages
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Helper: Parse Query String ใน Apps Script
 */
function parseQueryStringGAS(queryString) {
  const params = {};
  const pairs = queryString.split("&");
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split("=");
    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || "");
  }
  return params;
}

// Global User Cart Storage for GAS Session
const cache = CacheService.getScriptCache();

function addToCartGAS(userId, productId) {
  let cart = JSON.parse(cache.get(userId) || "[]");
  cart.push(productId);
  cache.put(userId, JSON.stringify(cart), 21600); // 6 hours
}

function removeFromCartGAS(userId, productId) {
  let cart = JSON.parse(cache.get(userId) || "[]");
  const index = cart.indexOf(productId);
  if (index > -1) {
    cart.splice(index, 1);
  }
  cache.put(userId, JSON.stringify(cart), 21600);
}

function getCartSummaryFlexGAS(userId) {
  let cart = JSON.parse(cache.get(userId) || "[]");
  const products = getProductsFromSheetGAS();

  let subtotal = 0;
  const itemBoxes = cart.map(function(pid) {
    const p = products.find(x => x.id === pid) || { name: "สินค้า", price: 0 };
    subtotal += p.price;
    return {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: p.name, size: "xs", color: "#333333", flex: 4, weight: "bold" },
        { type: "text", text: "฿" + p.price, size: "xs", color: "#111111", align: "end", flex: 2 },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          flex: 2,
          action: { type: "postback", label: "❌ ลบ", data: "action=REMOVE_ITEM&productId=" + pid }
        }
      ]
    };
  });

  return {
    type: "flex",
    altText: "🛍️ ตะกร้าสินค้าของคุณ",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1DB446",
        contents: [
          { type: "text", text: "🛍️ ตะกร้าสินค้าใน LINE Chatbot (GAS)", color: "#FFFFFF", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: itemBoxes.length > 0 ? itemBoxes : [{ type: "text", text: "ตะกร้าว่างเปล่า", size: "xs", color: "#888888" }]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1DB446",
            action: { type: "postback", label: "👤 ยืนยันสั่งซื้อ (ระบุชื่อเล่น & ที่อยู่)", data: "action=CONFIRM_CHECKOUT" }
          }
        ]
      }
    }
  };
}

function updateStockInSheetGAS(productId, amount) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productId) {
      const currentStock = Number(data[i][3]);
      sheet.getRange(i + 1, 4).setValue(currentStock + amount);
      break;
    }
  }
}
