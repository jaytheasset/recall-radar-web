# Recall Radar

Recall Radar is a local-only Astro and TypeScript MVP for a US product recall search and SEO website. It uses mock TypeScript data and local JSON-ready folders only.

## Local-Only Warning

This project must stay isolated from all other projects.

- Exact project folder: `C:\Users\pc\codex-projects\recall-radar-web`
- Required local dev port: `5179`
- Do not connect Cloudflare, GitHub remotes, Render, Vercel, Netlify, Supabase, or any other remote service yet.
- Do not share `.env` files between projects.
- Do not create real `.env`, `.env.local`, `.env.production`, or secret files.
- Do not use Docker.
- Keep all data local until a later step explicitly changes that scope.

## Setup

Run all commands from:

```powershell
cd C:\Users\pc\codex-projects\recall-radar-web
npm install
```

## Development

```powershell
npm run dev
```

The dev server must use port `5179`.

## Build

```powershell
npm run build
```

## Preview

```powershell
npm run preview
```

The preview server is configured for port `5179`.

## Check

```powershell
npm run check
```

## Current Scope

- Astro + TypeScript
- Local mock recall data
- Local search helper returning `exact`, `possible`, `related`, or `none`
- Static email alert signup UI only
- No database
- No external API calls
- No remote services

## Next-Step Checklist

- Review local mock recall fields and labels.
- Confirm search matching rules for exact, possible, related, and none.
- Add more local mock data before connecting official sources.
- Decide the first official source integration in a future isolated step.
- Add automated tests after the MVP shape is approved.
- Keep this repo isolated from all other projects.
