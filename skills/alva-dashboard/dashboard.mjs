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

async function getNodeTypedoc(token, jagentId, nodeName, outputName) {
  const query = `query GetNodeTypedoc($input: GetNodeTypedocInput!) { GetNodeTypedoc(input: $input) { typedoc } }`;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      operationName: 'GetNodeTypedoc',
      query,
      variables: { input: { jagentId, nodeName, outputName } },
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
  return json.data?.GetNodeTypedoc?.typedoc || null;
}

/** Parse alva://time_series/{jagentId}/{node}/{output}?last=N → {jagentId, nodeName, outputName} */
function parseDataUri(uri) {
  const m = uri.match(/alva:\/\/time_series\/(\d+)\/([^/?]+)\/([^/?]+)/);
  if (!m) return null;
  return { jagentId: m[1], nodeName: m[2], outputName: m[3] };
}

/**
 * Parse typedoc string into structured field definitions.
 * Format: "Description.\nfields:\n- name(type): desc\n- name2(type): desc2"
 * Returns { description, fields: [{ name, type, desc }] }
 */
function parseTypedoc(typedocStr) {
  if (!typedocStr) return null;
  const lines = typedocStr.split('\n');
  const descLines = [];
  const fields = [];
  let inFields = false;
  for (const line of lines) {
    if (/^fields:\s*$/i.test(line.trim())) { inFields = true; continue; }
    if (inFields) {
      const m = line.match(/^-\s*(\w+)\((\w+)\):\s*(.+)$/);
      if (m) fields.push({ name: m[1], type: m[2], desc: m[3].trim() });
    } else {
      if (line.trim()) descLines.push(line.trim());
    }
  }
  return { description: descLines.join(' '), fields };
}

/**
 * Infer field roles from parsed typedoc fields.
 * Returns { timeField, valueFields: [{ name, desc }], labelFields, boolFields }
 */
function inferFieldRoles(fields) {
  const roles = { timeField: null, valueFields: [], labelFields: [], boolFields: [] };
  for (const f of fields) {
    if (f.type === 'boolean') { roles.boolFields.push(f); continue; }
    if (f.type === 'string') { roles.labelFields.push(f); continue; }
    // number: check if it's a time field
    if (f.type === 'number' && /\b(date|time|timestamp|epoch)\b/i.test(f.name + ' ' + f.desc)) {
      if (!roles.timeField) { roles.timeField = f; continue; }
    }
    if (f.type === 'number') roles.valueFields.push(f);
  }
  return roles;
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

function renderHTML(config, widgetDataMap, typedocMap, timestamp) {
  const dashboardName = config.name || 'Alva Dashboard';
  const dashboardDesc = config.description || '';
  const widgets = config.config || [];

  // Collect typedocs for each widget (keyed by widget name)
  function getWidgetTypedocs(w) {
    if (!w.chartData) return [];
    const uris = extractDataUris(w.chartData);
    const docs = [];
    for (const uri of uris) {
      const doc = typedocMap?.[uri];
      if (doc) {
        const parsed = parseDataUri(uri);
        docs.push({ node: parsed?.nodeName, output: parsed?.outputName, typedoc: doc });
      }
    }
    return docs;
  }

  // Build widget HTML
  const widgetCards = widgets.map((w, idx) => {
    const chartData = w.chartData ? JSON.parse(w.chartData) : null;
    if (!chartData?.widgets?.length) return '';

    const echartsWidget = chartData.widgets[0];
    const props = echartsWidget.props || {};
    const resolvedProps = resolveEChartsData(props, widgetDataMap);

    const widgetId = `chart_${idx}`;
    const ts = new Date(w.create_time).toLocaleString('en-US', { 
      month: '2-digit', day: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    // Typedoc metadata as hidden data attribute
    const docs = getWidgetTypedocs(w);
    const typedocAttr = docs.length ? ` data-typedoc="${escapeHtml(JSON.stringify(docs))}"` : '';

    return `
    <div class="widget-card"${typedocAttr}>
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

    // Collect parsed typedocs for this widget's data
    const docs = getWidgetTypedocs(w);
    const parsedDocs = docs.map(d => parseTypedoc(d.typedoc)).filter(Boolean);
    // Merge all fields from all typedocs (dedup by name)
    const allFields = new Map();
    for (const pd of parsedDocs) {
      for (const f of pd.fields) {
        if (!allFields.has(f.name)) allFields.set(f.name, f);
      }
    }
    const fieldMap = Object.fromEntries(allFields);

    // Apply Alva design tokens to the resolved props
    applyAlvaDesignTokens(resolvedProps, fieldMap);

    // Build series name → description map for tooltip
    // Match strategy: exact field name → normalized name → keyword in desc → fuzzy
    const seriesDescMap = {};
    if (resolvedProps.series) {
      const fieldEntries = Object.entries(fieldMap);
      for (const s of resolvedProps.series) {
        if (!s.name) continue;
        const sn = s.name;
        const snLower = sn.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // 1. Exact match: series name === field name
        if (fieldMap[sn]) { seriesDescMap[sn] = fieldMap[sn].desc; continue; }
        
        // 2. Normalized match: strip special chars
        for (const [fname, fdef] of fieldEntries) {
          if (fname.toLowerCase().replace(/[^a-z0-9]/g, '') === snLower) {
            seriesDescMap[sn] = fdef.desc; break;
          }
        }
        if (seriesDescMap[sn]) continue;
        
        // 3. Series name appears in field desc (e.g. "RSI(14)" in "RSI(14) value (0-100)")
        for (const [fname, fdef] of fieldEntries) {
          if (fdef.desc.toLowerCase().includes(sn.toLowerCase()) || fdef.desc.includes(sn)) {
            seriesDescMap[sn] = fdef.desc; break;
          }
        }
        if (seriesDescMap[sn]) continue;
        
        // 4. Field name appears in series name (e.g. field "rsi14" in series "RSI(14)")
        for (const [fname, fdef] of fieldEntries) {
          if (fdef.type === 'number' && snLower.includes(fname.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            seriesDescMap[sn] = fdef.desc; break;
          }
        }
      }
    }

    const hasDescMap = Object.keys(seriesDescMap).length > 0;

    return `
    {
      const chart = echarts.init(document.getElementById('chart_${idx}'));
      ${hasDescMap ? `const _descMap = ${JSON.stringify(seriesDescMap)};` : ''}
      const opts = ${JSON.stringify(resolvedProps)};
      ${hasDescMap ? `
      // Enhanced tooltip with typedoc field descriptions
      opts.tooltip = opts.tooltip || {};
      opts.tooltip.formatter = function(params) {
        if (!Array.isArray(params)) params = [params];
        let header = params[0]?.axisValueLabel || params[0]?.name || '';
        let html = '<div style="font-weight:500;margin-bottom:6px;font-size:12px">' + header + '</div>';
        for (const p of params) {
          const desc = _descMap[p.seriesName] || '';
          const label = desc ? '<span style="color:rgba(0,0,0,0.5);font-size:10px"> ' + desc + '</span>' : '';
          const val = typeof p.value === 'number' ? p.value.toLocaleString() :
                      Array.isArray(p.value) ? (p.value[1] ?? p.value).toLocaleString() : p.value;
          html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">'
            + (p.marker || '') + '<span style="font-size:12px">' + p.seriesName + ': <b>' + val + '</b></span>'
            + label + '</div>';
        }
        return html;
      };` : ''}
      chart.setOption(opts);
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

function applyAlvaDesignTokens(props, fieldMap = {}) {
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

  // Step 3: Extract all data URIs, fetch time series + typedocs in parallel
  const allUris = new Set();
  for (const w of config.config || []) {
    if (w.chartData) {
      for (const uri of extractDataUris(w.chartData)) allUris.add(uri);
    }
  }

  const uriArray = [...allUris];
  console.error(`📡 Fetching ${uriArray.length} time series + typedocs...`);
  const dataMap = {};
  const typedocMap = {}; // uri → typedoc string
  
  // Fetch data + typedocs in parallel (batches of 5)
  for (let i = 0; i < uriArray.length; i += 5) {
    const batch = uriArray.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.flatMap(uri => {
        const parsed = parseDataUri(uri);
        const dataFetch = getTimeSeriesData(creds.token, uri)
          .then(d => ({ type: 'data', uri, data: d }));
        const docFetch = parsed
          ? getNodeTypedoc(creds.token, parsed.jagentId, parsed.nodeName, parsed.outputName)
              .then(doc => ({ type: 'typedoc', uri, doc }))
              .catch(() => ({ type: 'typedoc', uri, doc: null }))
          : Promise.resolve({ type: 'typedoc', uri, doc: null });
        return [dataFetch, docFetch];
      })
    );
    for (const r of results) {
      if (r.status !== 'fulfilled') {
        console.error(`  ❌ ${r.reason?.message || 'fetch failed'}`);
        continue;
      }
      const v = r.value;
      if (v.type === 'data') {
        dataMap[v.uri] = v.data;
        console.error(`  ✅ ${v.uri.split('/').slice(-2).join('/')} (${v.data.length} pts)`);
      } else if (v.type === 'typedoc' && v.doc) {
        typedocMap[v.uri] = v.doc;
        console.error(`  📄 ${v.uri.split('/').slice(-2).join('/')} typedoc OK`);
      }
    }
  }

  // Step 4: Render HTML
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const html = renderHTML(config, dataMap, typedocMap, now);

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
