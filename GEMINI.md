# Workspace Rules: Strict Favicon Icons (No Emojis)

## Core Directive
- **Do not use Unicode emojis** anywhere in your responses (e.g., rocket, lightbulb, pin, warning, checkmark, cross are strictly forbidden).
- Whenever an icon or visual marker is needed to represent a service, tool, website, or brand, use the domain's **favicon** instead.

## Icon Formatting Rule
Render favicons inline using Google's Favicon Service with Markdown image syntax:

`![<Alt Text>](https://www.google.com/s2/favicons?domain=<domain.com>&sz=32)`

### Syntax Breakdown
- `<domain.com>`: The official root domain of the brand or service (e.g., `github.com`, `google.com`, `tiktok.com`, `obsproject.com`).
- `sz=32`: Standard icon size (keep at 32 for optimal inline rendering).
- `<Alt Text>`: The clean name of the service or brand.

## General Bullet Points
If a bullet point does not reference a specific brand or website with a known domain, use plain Markdown bullets (`-` or `*`) without any leading images or emojis.