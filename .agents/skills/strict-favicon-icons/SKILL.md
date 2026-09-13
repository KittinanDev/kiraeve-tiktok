---
name: strict-favicon-icons
description: Enforce strict favicon icons instead of Unicode emojis. Forbids any emojis in responses, replaces service/tool/brand icons with Google Favicon Service, and uses plain Markdown bullets.
---

# Skill: Strict Favicon Icons (No Emojis)

## Core Directive
- **Do not use Unicode emojis** anywhere in your responses (e.g. rocket, lightbulb, pin, warning, checkmark, cross are strictly forbidden).
- Whenever an icon or visual marker is needed to represent a service, tool, website, or brand, use the domain's **favicon** instead.

## Icon Formatting Rule
Render favicons inline using Google's Favicon Service with Markdown image syntax:

`![<Alt Text>](https://www.google.com/s2/favicons?domain=<domain.com>&sz=32)`

### Syntax Breakdown
- `<domain.com>`: The official root domain of the brand or service (e.g., `github.com`, `google.com`, `apple.com`, `tiktok.com`).
- `sz=32`: Standard icon size (keep at 32 for optimal inline rendering).
- `<Alt Text>`: The clean name of the service or brand.

## Examples

### Allowed (Using Favicons)
- ![GitHub](https://www.google.com/s2/favicons?domain=github.com&sz=32) **GitHub Repository**
- ![Google](https://www.google.com/s2/favicons?domain=google.com&sz=32) **Google Cloud**
- ![Notion](https://www.google.com/s2/favicons?domain=notion.so&sz=32) **Notion Workspace**
- ![TikTok](https://www.google.com/s2/favicons?domain=tiktok.com&sz=32) **TikTok Live**
- ![OBS Studio](https://www.google.com/s2/favicons?domain=obsproject.com&sz=32) **OBS Studio**
- ![Node.js](https://www.google.com/s2/favicons?domain=nodejs.org&sz=32) **Node.js Runtime**
- ![Python](https://www.google.com/s2/favicons?domain=python.org&sz=32) **Python Backend**
- ![Electron](https://www.google.com/s2/favicons?domain=electronjs.org&sz=32) **Electron Framework**

### Forbidden (Emojis)
- Unicode emojis of any kind (e.g. rocket, checkmark, cross, warning, lightbulb, memo, fire, sparkles, party popper) are strictly forbidden.

## General Bullet Points
If a bullet point does not reference a specific brand or website with a known domain, use plain Markdown bullets (`-` or `*`) without any leading images or emojis.