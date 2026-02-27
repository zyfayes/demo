# Alva Skills

Agent skills for building investment dashboards with the [Alva](https://alva.ai) platform.

## Skills

### `alva-design`

Alva Design System specification. Defines design tokens (colors, typography, spacing, radius), layout rules, widget types, and component templates. Used as the authoritative reference for all visual output.

**Not executable** — this is a reference skill that other skills read from.

### `alva-dashboard`

End-to-end dashboard builder. Creates investment dashboards via Alva's API, fetches time series data, and renders standalone HTML pages styled with the Alva Design System.

**Requires:** Alva API credentials (JWT token).

```bash
# Create a new dashboard
node skills/alva-dashboard/dashboard.mjs "Build an NVDA dashboard with price, RSI, and revenue"

# Re-render an existing dashboard
node skills/alva-dashboard/dashboard.mjs --session <session_id> --refresh

# Custom output path
node skills/alva-dashboard/dashboard.mjs "..." --output ./my-dashboard.html
```

## Setup

1. Get an Alva JWT token from [alva.ai](https://alva.ai)
2. Save credentials:
   ```json
   // secrets/alva.json
   { "token": "your-jwt-token" }
   ```
3. Run with proxy if needed: `HTTPS_PROXY=http://127.0.0.1:7897 node dashboard.mjs "..."`

## Architecture

```
User prompt
  → Alva /chat API (creates widgets)
  → GetDashboardConfig (fetches ECharts specs)
  → GetTimeSeriesData (resolves alva:// data URIs)
  → HTML render (Alva Design System tokens + ECharts)
  → Standalone .html file
```
