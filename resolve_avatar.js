const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

let webClientInstance = null;

async function getWebClient() {
    if (webClientInstance) return webClientInstance;
    try {
        const candidates = [
            path.join(__dirname, 'node_modules', 'tiktok-live-connector', 'dist', 'lib-QI8aOkkz.js'),
            path.join(process.cwd(), 'node_modules', 'tiktok-live-connector', 'dist', 'lib-QI8aOkkz.js')
        ];
        for (const cand of candidates) {
            if (fs.existsSync(cand)) {
                const fileUrl = 'file:///' + cand.replace(/\\/g, '/');
                const mod = await import(fileUrl);
                const presets = mod.a();
                const webConfig = mod.o(presets);
                webClientInstance = new mod.r(webConfig);
                return webClientInstance;
            }
        }
    } catch (e) {
        console.error('[Avatar Resolver] Failed to initialize WebClient:', e.message);
    }
    return null;
}

const userAvatarCache = new Map();

async function resolveRealTikTokAvatar(uniqueId) {
    if (!uniqueId) return '';
    const cleanId = uniqueId.replace('@', '').trim().toLowerCase();
    if (!cleanId) return '';

    if (userAvatarCache.has(cleanId)) {
        return userAvatarCache.get(cleanId);
    }

    const avatarsDir = path.join(__dirname, 'media', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
        try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch (e) {}
    }
    const dest = path.join(avatarsDir, `avatar_${cleanId}.webp`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
        const localUrl = `/media/avatars/avatar_${cleanId}.webp`;
        userAvatarCache.set(cleanId, localUrl);
        return localUrl;
    }

    try {
        const client = await getWebClient();
        if (!client) return '';
        const data = await client.getJsonObjectFromTikTokApi("api-live/user/room/", {
            ...client.clientParams,
            uniqueId: cleanId,
            sourceType: "54"
        });

        const user = data && data.data && data.data.user;
        const avatarUrl = user && (user.avatarThumb || user.avatarMedium || user.avatarLarger);
        if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
            await new Promise((resolve) => {
                https.get(avatarUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/'
                    }
                }, res => {
                    if (res.statusCode === 200) {
                        const chunks = [];
                        res.on('data', c => chunks.push(c));
                        res.on('end', () => {
                            try {
                                const buf = Buffer.concat(chunks);
                                if (buf.length > 100) {
                                    fs.writeFileSync(dest, buf);
                                    console.log(`[Avatar] Saved real TikTok avatar for @${cleanId} (${buf.length} bytes)`);
                                }
                            } catch (e) {}
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                }).on('error', () => resolve());
            });

            if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
                const localUrl = `/media/avatars/avatar_${cleanId}.webp`;
                userAvatarCache.set(cleanId, localUrl);
                return localUrl;
            }
        }
    } catch (e) {
        console.error(`[Avatar] Failed resolving @${cleanId}:`, e.message);
    }
    return '';
}

function startServer(port = 8766) {
    const server = http.createServer(async (req, res) => {
        try {
            const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
            if (reqUrl.pathname === '/resolve-avatar') {
                const user = (reqUrl.searchParams.get('user') || '').replace('@', '').trim();
                if (!user) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ ok: false, error: 'Missing user' }));
                }
                const avatar = await resolveRealTikTokAvatar(user);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                return res.end(JSON.stringify({ ok: true, avatar: avatar, username: user }));
            }
            res.writeHead(404);
            res.end();
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[Avatar Helper] Port ${port} in use, avatar resolver helper is already running.`);
        } else {
            console.error('[Avatar Helper] Server error:', err.message);
        }
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`[Avatar Helper] TikTok avatar resolver running on http://127.0.0.1:${port}`);
    });
    return server;
}

const arg = process.argv[2];
if (arg && arg !== '--server') {
    resolveRealTikTokAvatar(arg).then(url => {
        console.log(`Result:`, url || 'Failed to resolve');
        process.exit(0);
    });
} else {
    startServer(8766);
}

module.exports = { resolveRealTikTokAvatar, startServer };
