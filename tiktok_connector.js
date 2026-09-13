const path = require('path');
const fs = require('fs');
const http = require('http');

let TikTokLiveClass = null;

function autoPatchLegacyConnector() {
    const candidates = [
        path.join(__dirname, 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(__dirname, '..', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(process.cwd(), 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(process.cwd(), 'resources', 'app', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(__dirname, 'python_embed', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js')
    ];
    for (const file of candidates) {
        try {
            if (fs.existsSync(file)) {
                let code = fs.readFileSync(file, 'utf-8');
                let modified = false;
                if (code.includes('function getTopViewerAttributes(topViewers) {\n\treturn topViewers.map')) {
                    code = code.replace(
                        'function getTopViewerAttributes(topViewers) {\n\treturn topViewers.map',
                        'function getTopViewerAttributes(topViewers) {\n\tif (!Array.isArray(topViewers)) return [];\n\treturn topViewers.map'
                    );
                    modified = true;
                }
                if (code.includes('Object.values(webcastObject.anchorsInfo).forEach')) {
                    code = code.replace(
                        'Object.values(webcastObject.anchorsInfo).forEach((anchor) => {',
                        'if (webcastObject && webcastObject.anchorsInfo) Object.values(webcastObject.anchorsInfo).forEach((anchor) => {'
                    );
                    modified = true;
                }
                if (modified) {
                    fs.writeFileSync(file, code, 'utf-8');
                    console.log('[TikTok-Live-Connector] Applied robustness patch to ' + file);
                }
            }
        } catch (e) {}
    }
}
autoPatchLegacyConnector();

async function getTikTokLiveClass() {
    if (TikTokLiveClass) return TikTokLiveClass;

    // 1. Try candidates first (allows local patched file to take precedence)
    const candidates = [
        path.join(__dirname, 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(__dirname, 'node_modules', 'tiktok-live-connector', 'dist', 'index.js'),
        path.join(__dirname, '..', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(__dirname, '..', 'node_modules', 'tiktok-live-connector', 'dist', 'index.js'),
        path.join(process.cwd(), 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(process.cwd(), 'resources', 'app', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js'),
        path.join(__dirname, 'python_embed', 'node_modules', 'tiktok-live-connector', 'dist', 'legacy.js')
    ];

    for (const cand of candidates) {
        try {
            if (fs.existsSync(cand)) {
                const fileUrl = 'file:///' + cand.replace(/\\/g, '/');
                const mod = await import(fileUrl);
                const cls = (mod && mod.WebcastPushConnection) || (mod && mod.TikTokLiveConnection) || (mod && mod.default);
                if (cls) {
                    TikTokLiveClass = cls;
                    return cls;
                }
            }
        } catch (e) {}
    }

    // 2. Try legacy export from ES module
    try {
        const legacyMod = await import('tiktok-live-connector/legacy');
        if (legacyMod && (legacyMod.WebcastPushConnection || legacyMod.default)) {
            TikTokLiveClass = legacyMod.WebcastPushConnection || legacyMod.default;
            return TikTokLiveClass;
        }
    } catch (e) {}

    // 3. Try main export
    try {
        const mainMod = await import('tiktok-live-connector');
        if (mainMod && (mainMod.WebcastPushConnection || mainMod.TikTokLiveConnection || mainMod.default)) {
            TikTokLiveClass = mainMod.WebcastPushConnection || mainMod.TikTokLiveConnection || mainMod.default;
            return TikTokLiveClass;
        }
    } catch (e) {}

    return null;
}

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
        data.avatarLarge?.urls,
        data.avatarMedium?.urls,
        data.avatarThumb?.urls,
        data.avatarLarge?.url_list,
        data.avatarMedium?.url_list,
        data.avatarThumb?.url_list,
        data.user?.profilePictureUrl,
        data.user?.userDetails?.profilePictureUrls,
        data.user?.avatarLarge?.urlList,
        data.user?.avatarMedium?.urlList,
        data.user?.avatarThumb?.urlList,
        data.user?.avatarLarge?.urls,
        data.user?.avatarMedium?.urls,
        data.user?.avatarThumb?.urls,
        data.user?.avatarLarge?.url_list,
        data.user?.avatarMedium?.url_list,
        data.user?.avatarThumb?.url_list,
        data.user?.profilePicture?.urlList,
        data.user?.avatarUri,
        data.avatarUri,
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
    // Deep recursive fallback for any nested avatar URL in protobuf
    function findAvatarDeep(obj, depth = 0) {
        if (!obj || depth > 4) return '';
        if (typeof obj === 'string') {
            if (obj.startsWith('http') && (obj.includes('tiktokcdn.com') || obj.includes('/tos-') || obj.includes('webcast')) && (obj.includes('avt') || obj.includes('avatar') || obj.includes('shrink') || obj.includes('100x100') || obj.includes('c5_') || obj.includes('.webp') || obj.includes('.jpeg') || obj.includes('.jpg'))) {
                return obj;
            }
            return '';
        }
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const res = findAvatarDeep(item, depth + 1);
                if (res) return res;
            }
            return '';
        }
        if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                if (key.toLowerCase().includes('avatar') || key.toLowerCase().includes('picture') || key.toLowerCase().includes('user') || key.toLowerCase().includes('image')) {
                    const res = findAvatarDeep(obj[key], depth + 1);
                    if (res) return res;
                }
            }
        }
        return '';
    }
    return findAvatarDeep(data);
}

const streakMap = new Map();

async function tryConnect() {
    if (isConnected || isPolling) return;
    isPolling = true;

    try {
        const ConnClass = await getTikTokLiveClass();
        if (!ConnClass) {
            throw new Error("tiktok-live-connector is not installed in the app environment. Please run install-prereqs.bat as Administrator.");
        }

        tiktokLiveConnection = new ConnClass(username, {
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
            const sender = (data.user && (data.user.nickname || data.user.displayId || data.user.uniqueId)) || data.nickname || data.uniqueId || 'ผู้สนับสนุน';
            const giftId = data.giftId || (data.gift && data.gift.gift_id) || 1;
            const streakKey = `${sender}_${giftId}`;
            const repeatCount = data.repeatCount || data.count || 1;
            const isStreakEnd = data.repeatEnd === 1 || data.repeatEnd === true;

            // Calculate delta count so every tap drops into the jar immediately
            let spawnCount = repeatCount;
            if (streakMap.has(streakKey)) {
                const prev = streakMap.get(streakKey);
                spawnCount = Math.max(1, repeatCount - prev);
            }
            if (isStreakEnd) {
                streakMap.delete(streakKey);
            } else {
                streakMap.set(streakKey, repeatCount);
                setTimeout(() => streakMap.delete(streakKey), 15000);
            }

            const cached = giftCatalogById[giftId] || giftCatalogById[String(giftId)] || giftCatalogById[Number(giftId)];
            const giftName = (cached && cached.name) || data.giftName || (data.giftDetails && data.giftDetails.giftName) || data.describe || 'Gift';
            const unitCoins = (data.diamondCount || (cached && (cached.diamond_count || cached.coins)) || 1);
            const coins = unitCoins * spawnCount;
            const iconUrl = (cached && (cached.icon || cached.image_url)) || data.giftPictureUrl || extractGiftIcon(data) || '';
            const profilePic = extractAvatarUrl(data);

            console.log(`[Gift Received] ${sender} sent ${giftName} (ID: ${giftId}) x${spawnCount} (${coins} coins)`);
            postEventToServer('gift', {
                gift_id: giftId,
                sender: sender,
                gift_name: giftName,
                count: spawnCount,
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
