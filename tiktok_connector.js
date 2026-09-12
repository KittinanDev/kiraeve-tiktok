const { TikTokLiveConnection } = require('tiktok-live-connector');
const http = require('http');
const fs = require('fs');
const path = require('path');

const username = (process.argv[2] || 'tiktok').replace('@', '').trim();
console.log('[TikTok-Live-Connector] Starting connector manager for @' + username + '...');

let giftCatalogById = {};
try {
    const catalogPath = path.join(__dirname, 'gift_cache.json');
    if (fs.existsSync(catalogPath)) {
        const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        (raw.gifts || []).forEach(g => {
            if (g && g.id) {
                giftCatalogById[g.id] = g;
            }
        });
        console.log('[TikTok-Live-Connector] Loaded ' + Object.keys(giftCatalogById).length + ' gifts from gift_cache.json');
    }
} catch (e) {
    console.error('[TikTok-Live-Connector] Error loading gift catalog:', e);
}

let isConnected = false;
let isPolling = false;
let tiktokLiveConnection = null;

function postEventToServer(eventType, payload) {
    const data = JSON.stringify({ event_type: eventType, ...payload });
    const options = {
        hostname: '127.0.0.1',
        port: 8765,
        path: '/api/tiktok-event',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = http.request(options, () => {});
    req.on('error', (err) => {
        console.error('[TikTok-Event] Error sending event to server:', err.message);
    });
    req.write(data);
    req.end();
}

function extractGiftIcon(data) {
    if (!data) return '';
    const candidates = [
        data.giftPictureUrl,
        data.giftDetails?.giftImage?.giftPictureUrl,
        data.giftDetails?.giftPictureUrl,
        data.giftDetails?.icon,
        data.giftDetails?.giftImage?.urlList?.[0],
        data.giftDetails?.giftImage?.url_list?.[0],
        data.giftImage?.giftPictureUrl,
        data.giftImage?.urlList?.[0],
        data.gift?.gift_icon,
        data.gift?.giftPictureUrl,
        data.gift?.gift_picture_url,
        data.giftIcon,
        data.gift_icon,
        data.icon
    ];
    for (const c of candidates) {
        if (c && typeof c === 'string' && c.startsWith('http')) return c;
    }
    return '';
}

function extractAvatarUrl(data) {
    if (!data) return '';
    const rawCandidates = [
        data.userDetails?.profilePictureUrls,
        data.profilePictureUrl,
        data.profile_picture,
        data.avatarLarge?.urlList,
        data.avatarMedium?.urlList,
        data.avatarThumb?.urlList,
        data.avatarLarge,
        data.avatarMedium,
        data.avatarThumb,
        data.user?.profilePictureUrl,
        data.user?.userDetails?.profilePictureUrls,
        data.user?.avatarLarge?.urlList,
        data.user?.avatarMedium?.urlList,
        data.user?.avatarThumb?.urlList,
        data.user?.profilePicture?.urlList,
        data.profilePictureUrls,
        data.user?.profilePictureUrls
    ];
    for (const c of rawCandidates) {
        if (!c) continue;
        if (typeof c === 'string' && c.startsWith('http')) return c;
        if (Array.isArray(c)) {
            for (const item of c) {
                if (typeof item === 'string' && item.startsWith('http')) return item;
            }
        }
        if (typeof c === 'object' && c.urlList && Array.isArray(c.urlList)) {
            for (const item of c.urlList) {
                if (typeof item === 'string' && item.startsWith('http')) return item;
            }
        }
    }
    return '';
}

async function tryConnect() {
    if (isConnected || isPolling) return;
    isPolling = true;

    try {
        tiktokLiveConnection = new TikTokLiveConnection(username, {
            processInitialData: false,
            enableExtendedGiftInfo: false
        });

        tiktokLiveConnection.on('chat', data => {
            const sender = (data.user && (data.user.nickname || data.user.displayId || data.user.uniqueId)) || data.nickname || data.uniqueId || 'Anonymous';
            const text = data.content || data.comment || data.text || '';
            if (!text) return;
            console.log('[Chat] ' + sender + ': ' + text);
            postEventToServer('chat', {
                sender: sender,
                text: text,
                profilePictureUrl: extractAvatarUrl(data)
            });
        });

        tiktokLiveConnection.on('gift', data => {
            // Streak handling: If repeatEnd is 0 or false, it's an in-progress streak tap.
            // Wait for repeatEnd = 1 / true so we process the final count once without duplicates.
            if (data.repeatEnd === 0 || data.repeatEnd === false) {
                return;
            }

            const giftId = data.giftId || (data.gift && data.gift.gift_id);
            const cached = giftCatalogById[giftId] || giftCatalogById[String(giftId)] || giftCatalogById[Number(giftId)];

            const sender = (data.user && (data.user.nickname || data.user.displayId || data.user.uniqueId)) || data.nickname || data.uniqueId || 'ผู้สนับสนุน';
            const giftName = (cached && cached.name) || data.giftName || (data.giftDetails && data.giftDetails.giftName) || data.describe || 'Gift';
            const count = data.repeatCount || data.count || 1;
            const coins = (data.diamondCount || (cached && (cached.diamond_count || cached.coins)) || 1) * count;
            const iconUrl = (cached && (cached.icon || cached.image_url)) || data.giftPictureUrl || extractGiftIcon(data) || '';
            const profilePic = extractAvatarUrl(data);

            console.log(`[Gift Received] ${sender} sent ${giftName} (ID: ${giftId}) x${count} (${coins} coins) [Avatar: ${profilePic ? 'Found' : 'None'}]`);
            postEventToServer('gift', {
                gift_id: giftId,
                sender: sender,
                gift_name: giftName,
                count: count,
                coins: coins,
                gift_icon: iconUrl,
                profile_picture: profilePic
            });
        });

        tiktokLiveConnection.on('like', data => {
            const sender = data.uniqueId || data.nickname || (data.user && data.user.uniqueId) || 'Anonymous';
            postEventToServer('like', {
                sender: sender,
                likeCount: data.likeCount,
                totalLikes: data.totalLikeCount
            });
        });

        tiktokLiveConnection.on('streamEnd', action => {
            console.log('[TikTok-Live-Connector] Stream ended for @' + username);
            isConnected = false;
            postEventToServer('stream_end', { username });
            scheduleReconnect();
        });

        tiktokLiveConnection.on('disconnected', () => {
            isConnected = false;
            scheduleReconnect();
        });

        let roomState = await tiktokLiveConnection.connect();
        isConnected = true;
        isPolling = false;
        console.log('[TikTok-Live-Connector] Connected to @' + username + ' (Room ID: ' + roomState.roomId + ')');
        postEventToServer('live_connected', { roomId: roomState.roomId, username });

    } catch (err) {
        isConnected = false;
        isPolling = false;
        let errMsg = err ? err.toString() : 'Connection failed';
        if (err && (err.name === 'UserOfflineError' || errMsg.includes("isn't online") || errMsg.includes("UserOffline"))) {
            console.log('[TikTok-Live-Connector] @' + username + ' is currently offline. Auto-polling every 10 seconds...');
            postEventToServer('waiting_for_live', { username, message: 'รอสตรีมเมอร์เปิดไลฟ์สดบน TikTok... (Auto-Polling ทุก 10 วินาที)' });
        } else {
            console.error('[TikTok-Live-Connector] Connection error for @' + username + ':', err);
            postEventToServer('live_error', { error: errMsg, username });
        }
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    setTimeout(() => {
        if (!isConnected) {
            tryConnect();
        }
    }, 10000);
}

tryConnect();
