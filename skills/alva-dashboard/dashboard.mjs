#!/usr/bin/env node
/**
 * Alva Dashboard Builder
 * Creates investment dashboards via Alva API, fetches data, renders HTML with Alva Design System.
 *
 * Usage:
 *   node dashboard.mjs "Build an NVDA dashboard with price, RSI, revenue, PE"
 *   node dashboard.mjs --session <id>            # Re-fetch & re-render existing dashboard
 *   node dashboard.mjs --session <id> --refresh   # Refresh data only (no new chat)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DASHBOARD_SKILL_ID = '1982927545146347011';
const CHAT_ENDPOINT = 'https://api-llm2.prd.alva.xyz/chat';
const QUERY_ENDPOINT = 'https://api-llm2.prd.alva.xyz/query';

// Persisted query hashes
const HASH_DASHBOARD_CONFIG = '095ea7520bde2d2f6c491cd4816708db8a85a9f639256e567b158a56098a36f2';
const HASH_TIMESERIES_DATA = '790017e6116231f959b7169b1176fe0b07c9007f4a578d131e7a395bc32f302f';

function loadCredentials() {
  if (process.env.ALVA_JWT_TOKEN) return { token: process.env.ALVA_JWT_TOKEN };
  const paths = [
    join(__dirname, '..', '..', 'secrets', 'alva.json'),
    join(__dirname, '..', 'alva-ask', 'data', 'credentials.json'),
  ];
  for (const p of paths) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf-8'));
      if (raw.token) return { token: raw.token };
    } catch {}
  }
  console.error('❌ No Alva credentials.');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) flags.sessionId = args[++i];
    else if (args[i] === '--refresh') flags.refresh = true;
    else if (args[i] === '--output' && args[i + 1]) flags.output = args[++i];
    else if (args[i] === '--timeout' && args[i + 1]) flags.timeout = parseInt(args[++i], 10);
    else positional.push(args[i]);
  }
  flags.message = positional.join(' ');
  return flags;
}

async function gqlQuery(token, operationName, variables, sha256Hash) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: {
        clientLibrary: { name: '@apollo/client', version: '4.0.9' },
        persistedQuery: { version: 1, sha256Hash },
      },
    }),
  };
  if (proxy) {
    try {
      const { ProxyAgent } = await import('undici');
      opts.dispatcher = new ProxyAgent(proxy);
    } catch {}
  }
  const resp = await fetch(QUERY_ENDPOINT, opts);
  const json = await resp.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function createDashboard(token, message, timeout = 600000) {
  console.error('⏳ Creating dashboard via Alva...');
  const body = {
    message,
    skill_id: DASHBOARD_SKILL_ID,
    session_kind: 'Dashboard',
    input_image_urls: [],
    timezone: 'Asia/Shanghai',
    timezone_offset_min: 480,
  };
  const fetchOpts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  };
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    try {
      const { ProxyAgent } = await import('undici');
      fetchOpts.dispatcher = new ProxyAgent(proxy);
    } catch {}
  }

  const resp = await fetch(CHAT_ENDPOINT, fetchOpts);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sessionId = null;
  let sessionName = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.session_id) sessionId = obj.session_id;
        if (obj.session_name) sessionName = obj.session_name;
        if (obj.msg?.includes('WIDGET_BUILDING')) {
          try {
            const m = obj.msg.match(/<WIDGET_BUILDING>(.*?)<\/WIDGET_BUILDING>/);
            if (m) {
              const tasks = JSON.parse(m[1]);
              const summary = tasks.map(t => {
                const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⏳';
                return `  ${icon} ${t.task_name}`;
              }).join('\n');
              console.error(`📋 Widgets:\n${summary}`);
            }
          } catch {}
        }
      } catch {}
    }
  }

  console.error(`✅ Dashboard created: ${sessionName} (${sessionId})`);
  return { sessionId, sessionName };
}

async function getDashboardConfig(token, sessionId) {
  console.error('📋 Fetching dashboard config...');
  const data = await gqlQuery(token, 'GetDashboardConfig', { input: { sessionId } }, HASH_DASHBOARD_CONFIG);
  const config = JSON.parse(data.GetDashboardConfig.config);
  return config;
}

async function getTimeSeriesData(token, uri) {
  const data = await gqlQuery(token, 'GetTimeSeriesData', { input: { uri } }, HASH_TIMESERIES_DATA);
  return JSON.parse(data.GetTimeSeriesData.data);
}

function extractDataUris(chartDataStr) {
  const uris = new Set();
  const re = /alva:\/\/time_series\/[^"'\s]+/g;
  let m;
  while ((m = re.exec(chartDataStr)) !== null) {
    uris.add(m[0]);
  }
  return [...uris];
}

function renderHTML(config, widgetDataMap, timestamp) {
  const dashboardName = config.name || 'Alva Dashboard';
  const dashboardDesc = config.description || '';
  const widgets = config.config || [];

  // Build widget HTML
  const widgetCards = widgets.map((w, idx) => {
    const chartData = w.chartData ? JSON.parse(w.chartData) : null;
    if (!chartData?.widgets?.length) return '';

    const echartsWidget = chartData.widgets[0];
    const props = echartsWidget.props || {};

    // Resolve data URIs in props
    const resolvedProps = resolveEChartsData(props, widgetDataMap);

    const widgetId = `chart_${idx}`;
    const ts = new Date(w.create_time).toLocaleString('en-US', { 
      month: '2-digit', day: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    return `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${ts}</span>
      </div>
      <div class="widget-body chart-dotted-background">
        <div class="chart-body">
          <div id="${widgetId}" style="width:100%;height:340px;"></div>
          <div class="alva-watermark">Alva</div>
        </div>
      </div>
    </div>`;
  }).filter(Boolean);

  // Build ECharts init scripts
  const initScripts = widgets.map((w, idx) => {
    const chartData = w.chartData ? JSON.parse(w.chartData) : null;
    if (!chartData?.widgets?.length) return '';

    const echartsWidget = chartData.widgets[0];
    const props = echartsWidget.props || {};
    const resolvedProps = resolveEChartsData(props, widgetDataMap);

    // Apply Alva design tokens to the resolved props
    applyAlvaDesignTokens(resolvedProps);

    return `
    {
      const chart = echarts.init(document.getElementById('chart_${idx}'));
      chart.setOption(${JSON.stringify(resolvedProps)});
      window.addEventListener('resize', () => chart.resize());
    }`;
  }).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(dashboardName)}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"><\/script>
<style>
:root {
  --text-n10: rgb(0,0,0);
  --text-n9: rgba(0,0,0,0.9);
  --text-n7: rgba(0,0,0,0.7);
  --text-n5: rgba(0,0,0,0.5);
  --text-n3: rgba(0,0,0,0.3);
  --main-m1: #49A3A6;
  --main-m3: #2a9b7d;
  --main-m4: #e05357;
  --main-m5: #E6A91A;
  --b0-page: #ffffff;
  --grey-g01: #fafafa;
  --line-l07: rgba(0,0,0,0.07);
  --line-l05: rgba(0,0,0,0.05);
  --spacing-xs: 8px;
  --spacing-s: 12px;
  --spacing-m: 16px;
  --spacing-l: 20px;
  --spacing-xl: 24px;
  --radius-ct-s: 4px;
  --radius-ct-m: 6px;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: var(--b0-page);
  font-family: 'Delight', -apple-system, BlinkMacSystemFont, sans-serif;
  padding: var(--spacing-xl);
  max-width: 2560px;
  margin: 0 auto;
  -webkit-font-smoothing: antialiased;
}
.dashboard-header {
  margin-bottom: var(--spacing-xl);
}
.dashboard-title {
  font-size: 22px;
  font-weight: 400;
  color: var(--text-n9);
  letter-spacing: 0.3px;
}
.dashboard-desc {
  font-size: 14px;
  color: var(--text-n5);
  margin-top: var(--spacing-xs);
  line-height: 22px;
}
.row-equal {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xl);
}
.widget-card {
  background: transparent;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.widget-card.full { grid-column: 1 / -1; }
.widget-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  margin-bottom: var(--spacing-m);
}
.widget-title-text {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-n9);
  letter-spacing: 0.14px;
  line-height: 22px;
}
.widget-timestamp {
  font-size: 12px;
  color: var(--text-n5);
  line-height: 20px;
}
.widget-body {
  border-radius: var(--radius-ct-m);
  overflow: hidden;
}
.chart-dotted-background {
  background-color: #ffffff;
  background-image: radial-gradient(circle, rgba(0,0,0,0.18) 0.6px, transparent 0.6px);
  background-size: 3px 3px;
}
.chart-body {
  flex: 1;
  padding: var(--spacing-m);
  position: relative;
}
.alva-watermark {
  position: absolute;
  bottom: var(--spacing-m);
  left: var(--spacing-m);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-n10);
  opacity: 0.2;
}
.footer {
  margin-top: var(--spacing-xl);
  text-align: center;
  font-size: 11px;
  color: var(--text-n3);
}
</style>
</head>
<body>

<div class="dashboard-header">
  <div class="dashboard-title">${escapeHtml(dashboardName)}</div>
  ${dashboardDesc ? `<div class="dashboard-desc">${escapeHtml(dashboardDesc)}</div>` : ''}
</div>

<div class="row-equal">
  ${widgetCards.join('\n')}
</div>

<div class="footer">
  Generated ${timestamp} · Data by Alva · Rendered with Alva Design System
</div>

<script>
${initScripts.join('\n')}
</script>
</body>
</html>`;
}

function resolveEChartsData(props, dataMap) {
  const resolved = JSON.parse(JSON.stringify(props));

  // Resolve xAxis data
  if (resolved.xAxis) {
    const axes = Array.isArray(resolved.xAxis) ? resolved.xAxis : [resolved.xAxis];
    for (const axis of axes) {
      if (axis.data && Array.isArray(axis.data) && axis.data.length === 1 && typeof axis.data[0] === 'string' && axis.data[0].startsWith('alva://')) {
        const uri = axis.data[0];
        const tsData = dataMap[uri];
        if (tsData && axis.dataResolver) {
          try {
            const fn = eval(axis.dataResolver);
            axis.data = fn(tsData);
          } catch { axis.data = []; }
        }
        delete axis.dataResolver;
      }
    }
  }

  // Resolve series data
  if (resolved.series) {
    for (const s of resolved.series) {
      if (s.data && Array.isArray(s.data) && s.data.length === 1 && typeof s.data[0] === 'string' && s.data[0].startsWith('alva://')) {
        const uri = s.data[0];
        const tsData = dataMap[uri];
        if (tsData && s.dataResolver) {
          try {
            const fn = eval(s.dataResolver);
            s.data = fn(tsData);
          } catch { s.data = []; }
        }
        delete s.dataResolver;
      }
    }
  }

  return resolved;
}

function applyAlvaDesignTokens(props) {
  // Override axis styles with Alva AX standard
  const AX = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontSize: 10, color: 'rgba(0,0,0,0.7)', fontFamily: "'Delight',-apple-system,BlinkMacSystemFont,sans-serif", margin: 8 },
    splitLine: { show: false },
  };

  if (props.xAxis) {
    const axes = Array.isArray(props.xAxis) ? props.xAxis : [props.xAxis];
    for (const a of axes) Object.assign(a, { ...AX, ...a, axisLabel: { ...AX.axisLabel, ...a.axisLabel } });
  }
  if (props.yAxis) {
    const axes = Array.isArray(props.yAxis) ? props.yAxis : [props.yAxis];
    for (const a of axes) Object.assign(a, { ...AX, ...a, axisLabel: { ...AX.axisLabel, ...a.axisLabel } });
  }

  // Override grid with containLabel — preserve array grids (e.g. candlestick + volume dual-axis)
  if (Array.isArray(props.grid)) {
    props.grid = props.grid.map(g => ({ containLabel: true, ...g }));
  } else if (props.grid && typeof props.grid === 'object') {
    // Check if it's an indexed object like {"0":{...}, "1":{...}} (Alva sometimes returns this)
    const numKeys = Object.keys(props.grid).filter(k => /^\d+$/.test(k));
    if (numKeys.length > 0) {
      props.grid = numKeys.sort((a, b) => +a - +b).map(k => ({ containLabel: true, ...props.grid[k] }));
    } else {
      props.grid = { top: 50, right: 12, bottom: 0, left: 12, containLabel: true, ...props.grid };
    }
  } else {
    props.grid = { top: 50, right: 12, bottom: 0, left: 12, containLabel: true };
  }

  // Override tooltip with Alva TT standard
  props.tooltip = {
    trigger: 'axis',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    textStyle: {
      fontFamily: "'Delight',-apple-system,BlinkMacSystemFont,sans-serif",
      fontSize: 12, fontWeight: 400, color: 'rgba(0,0,0,0.9)',
    },
    axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.1)', width: 1 } },
    extraCssText: 'box-shadow:none;',
    ...(props.tooltip || {}),
  };

  // Line series: width 1, hover circle
  if (props.series) {
    for (const s of props.series) {
      if (s.type === 'line') {
        s.lineStyle = { ...s.lineStyle, width: 1 };
        s.symbol = 'circle';
        s.symbolSize = 10;
        s.showSymbol = false;
        s.emphasis = {
          itemStyle: { borderColor: '#ffffff', borderWidth: 1, color: s.itemStyle?.color || s.lineStyle?.color || '#49A3A6' },
        };
      }
    }
  }

  props.backgroundColor = 'transparent';
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  const flags = parseArgs();
  const creds = loadCredentials();
  const timeout = (flags.timeout || 600) * 1000;

  let sessionId = flags.sessionId;

  // Step 1: Create dashboard if no session
  if (!sessionId) {
    if (!flags.message) {
      console.error('Usage: node dashboard.mjs "Build a dashboard..."');
      console.error('       node dashboard.mjs --session <id> [--refresh]');
      process.exit(1);
    }
    const result = await createDashboard(creds.token, flags.message, timeout);
    sessionId = result.sessionId;
  }

  // Step 2: Get dashboard config
  const config = await getDashboardConfig(creds.token, sessionId);
  console.error(`📊 Dashboard: ${config.name} (${(config.config || []).length} widgets)`);

  // Step 3: Extract all data URIs and fetch time series
  const allUris = new Set();
  for (const w of config.config || []) {
    if (w.chartData) {
      for (const uri of extractDataUris(w.chartData)) allUris.add(uri);
    }
  }

  console.error(`📡 Fetching ${allUris.size} time series...`);
  const dataMap = {};
  const uriArray = [...allUris];
  
  // Fetch in parallel (batches of 5)
  for (let i = 0; i < uriArray.length; i += 5) {
    const batch = uriArray.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(uri => getTimeSeriesData(creds.token, uri).then(d => ({ uri, data: d })))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        dataMap[r.value.uri] = r.value.data;
        console.error(`  ✅ ${r.value.uri.split('/').slice(-2).join('/')} (${r.value.data.length} pts)`);
      } else {
        console.error(`  ❌ ${r.reason.message}`);
      }
    }
  }

  // Step 4: Render HTML
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const html = renderHTML(config, dataMap, now);

  // Step 5: Output
  const outputPath = flags.output || `/tmp/alva-dashboard-${sessionId}.html`;
  writeFileSync(outputPath, html);
  console.log(`MEDIA:${outputPath}`);

  console.error('---');
  console.error(`session_id: ${sessionId}`);
  console.error(`output: ${outputPath}`);
  console.error(`→ refresh: node dashboard.mjs --session ${sessionId} --refresh`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
