---
name: alva-dashboard
description: >
  Build investment research dashboards via Alva's Dashboard API, fetch real data,
  and render locally with Alva Design System (white dotted background, Delight font,
  chart color tokens). Use when user says: "build a dashboard", "做一个看板", "投研看板",
  "visualize", "可视化". Requires: Alva JWT token.
---

# Alva Dashboard

Create → Fetch → Render investment dashboards in one command.

## Architecture

```
User request
    ↓
POST /chat (Dashboard mode, skill_id: 1982927545146347011)
    ↓ streaming, 3-5 min
session_id + widget configs
    ↓
GetDashboardConfig (GraphQL, sha256: 095ea7...)
    ↓
Complete ECharts widget configs + alva:// data URIs
    ↓
GetTimeSeriesData (GraphQL, sha256: 790017...)
    ↓ batch fetch all URIs
Raw data arrays (OHLCV, MA, RSI, fundamentals...)
    ↓
Apply Alva Design System tokens + render HTML
    ↓
MEDIA: output
```

## Quick Reference

```bash
# Create a new dashboard
node {baseDir}/dashboard.mjs "Build an NVDA dashboard with 6M price+MA50, RSI, quarterly revenue, PE vs sector"

# Re-render existing dashboard (re-fetch fresh data)
node {baseDir}/dashboard.mjs --session <session_id>

# Custom output path
node {baseDir}/dashboard.mjs --output /tmp/my-dashboard.html "BTC macro dashboard"

# Extended timeout (default 600s)
node {baseDir}/dashboard.mjs --timeout 900 "Complex 6-widget dashboard"
```

## Design System

Rendering follows `skills/alva-design/` specifications:
- **Background**: White dotted pattern (`radial-gradient(circle, rgba(0,0,0,0.18) 0.6px, transparent 0.6px)`)
- **Font**: Delight (fallback: -apple-system), weight 400 only (500 for headings)
- **Chart colors**: Alva chart tokens (cyan, orange, green, blue, purple series)
- **Axis**: No axis lines/ticks, label color `rgba(0,0,0,0.7)`, `containLabel: true`
- **Tooltip**: White 96% opacity, border `rgba(0,0,0,0.08)`, no shadow
- **Lines**: Width 1px, hover circle symbol (10px, white border)
- **Watermark**: "Alva" at bottom-left, opacity 0.2
- **Layout**: Equal 2-column grid, 24px gap

## API Reference

### 1. Create Dashboard — `POST /chat`
- `skill_id: "1982927545146347011"`, `session_kind: "Dashboard"`
- Streaming NDJSON, tags: `WIDGET_BUILDING`, `WIDGET_PROCESS`, `REASONING`, `AGENT_CONFIG_WITH_VERSION`
- Returns `session_id` for subsequent queries

### 2. Get Config — `GetDashboardConfig` (GraphQL)
- `sha256Hash: "095ea7520bde2d2f6c491cd4816708db8a85a9f639256e567b158a56098a36f2"`
- Input: `{ sessionId }`
- Returns: widget configs with `chartData` (ECharts options), `widgetCode`, `chartCode`, `cronExpression`

### 3. Get Data — `GetTimeSeriesData` (GraphQL)
- `sha256Hash: "790017e6116231f959b7169b1176fe0b07c9007f4a578d131e7a395bc32f302f"`
- Input: `{ uri: "alva://time_series/{jagentId}/{node}/{output}?last=N" }`
- Returns: `{ data: "[{...}, ...]", newestSec }`

### 4. Market Data — `Ohlcv` (GraphQL, supplementary)
- Input: `{ symbol, entityKind: STOCK|CRYPTO|ETF|INDEX, period: "1d", timeStart, timeEnd, limit }`
- Returns: `{ payload: [{ timePeriodStart, priceOpen, priceHigh, priceLow, priceClose, volumeTraded }] }`

## Credential Resolution
1. `ALVA_JWT_TOKEN` env var
2. `../../secrets/alva.json` (`{ "token": "..." }`)

## Refreshing
Each widget has a `cronExpression` (e.g., `0 * * * *` hourly). To refresh:
- Re-run with `--session <id>` — fetches latest data from same URIs
- Data URIs are stable; only the underlying data updates server-side
