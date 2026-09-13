---
name: tiktok-architecture
description: Understanding the TikTok LIVE architecture, data flow, and components of the NPC Live Overlay project.
---

# TikTok LIVE Integration Architecture

This document summarizes the core working principles of the TikTok LIVE integration within the NPC Live Overlay ecosystem. Use this as a reference for understanding data flow, event handling, and system components.

## Core Components

- **Client Connector (`tiktok_connector.js`)**: Runs in the browser (usually via the Dashboard). It connects directly to TikTok's Webcast WebSocket servers using client-side connection libraries. Running this in the browser helps bypass strict WAF (Web Application Firewall) blocks that typically ban backend server IPs.
- **Backend Hub (`server.py`)**: A ![Python](https://www.google.com/s2/favicons?domain=python.org&sz=32) `aiohttp` server acting as the central nervous system. It maintains state (Timer, Gacha, Leaderboard, Auction, Jar) and broadcasts updates.
- **Visual Overlays (`overlay_*.html`)**: Browser-based widgets designed to run in ![OBS](https://www.google.com/s2/favicons?domain=obsproject.com&sz=32). They contain no business logic and rely entirely on WebSocket commands from `server.py`.
- **Avatar Proxy (`resolve_avatar.js` & `/api/avatar-proxy`)**: A ![Node.js](https://www.google.com/s2/favicons?domain=nodejs.org&sz=32) daemon and Python proxy designed to fetch high-quality WebP avatars directly from TikTok's API using `unique_id`, resolving issues with broken images.

## Event Data Pipeline

The journey of an event (e.g., a viewer sending a gift) follows a strict pipeline:

1. **Event Capture**: A user on ![TikTok](https://www.google.com/s2/favicons?domain=tiktok.com&sz=32) sends a gift. TikTok's server sends a Webcast message.
2. **Connector Reception**: `tiktok_connector.js` receives the raw WebSocket frame, decrypts it, and fires the `on('gift')` callback.
3. **HTTP Forwarding**: The connector parses the payload (resolving streaks, combo counts, and gift icons) and makes an HTTP `POST` request to `/api/tiktok-event` on `server.py`.
4. **Backend Processing**: 
   - `server.py` routes the payload (internally leveraging `handle_mock_event` for consistency between real and test events).
   - The server validates trigger conditions (e.g., does this gift trigger the CS:GO Gacha? Does it add time to the Subathon Timer?).
   - System states (e.g., `jar_state`, `timer_state`, `auction_state`) are updated in memory.
5. **WebSocket Broadcast**: The backend dispatches a standardized JSON update (e.g., `{"type": "gacha_spin", ...}`) to `ws://localhost:8765/ws`.
6. **Overlay Render**: Overlays listening to the WebSocket receive the payload, queue animations (if necessary), and manipulate the DOM to display the event.

## Key Mechanisms

- **Combo Handling (Streaks)**: TikTok often sends gifts as a rapid succession of single events. The frontend connector aggregates these using a `streakKey` to prevent spamming the backend, or the backend manages `count` to fire animations appropriately.
- **Timer Autonomy**: Overlays do not calculate time locally beyond visual smoothing. `server.py` owns the authoritative timer state and broadcasts `timer_tick` or `auction_tick` every second. Overlays use a local tick interval purely for visual fluidity between backend updates.
- **Gift Cataloging**: TikTok sends raw gift IDs. `server.py` uses a cached JSON catalog to map IDs to localized names, diamond costs, and CDN icons.

## Guidelines for Developers

- Never put critical state logic in the overlays. Overlays are strictly "dumb" UI clients.
- Always use the `unique_id` (username) rather than display names for tracking users, as display names change frequently and are not unique.
- When adding new overlay features, mock the event in `dashboard.html` -> `server.py` first before testing on a live TikTok stream.
