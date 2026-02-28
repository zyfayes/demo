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

  // Helpers
  function getWidgetTypedocs(w) {
    if (!w.chartData) return [];
    const uris = extractDataUris(w.chartData);
    return uris.map(uri => {
      const doc = typedocMap?.[uri];
      if (!doc) return null;
      const parsed = parseDataUri(uri);
      return { node: parsed?.nodeName, output: parsed?.outputName, typedoc: doc };
    }).filter(Boolean);
  }

  function getFieldMap(w) {
    const docs = getWidgetTypedocs(w);
    const allFields = new Map();
    for (const d of docs) {
      const pd = parseTypedoc(d.typedoc);
      if (pd) for (const f of pd.fields) if (!allFields.has(f.name)) allFields.set(f.name, f);
    }
    return Object.fromEntries(allFields);
  }

  function getWidgetKind(w) {
    if (!w.chartData) return 'unknown';
    try {
      const cd = JSON.parse(w.chartData);
      return cd.widgets?.[0]?.kind || 'chart';
    } catch { return 'unknown'; }
  }

  function resolveWidgetData(w) {
    if (!w.chartData) return null;
    try {
      const cd = JSON.parse(w.chartData);
      const wg = cd.widgets?.[0];
      if (!wg?.props) return null;
      const { data, dataResolver } = wg.props;
      if (dataResolver) {
        const fn = eval(dataResolver);
        if (data && Array.isArray(data) && data.length && typeof data[0] === 'string' && data[0].startsWith('alva://')) {
          const tsData = widgetDataMap[data[0]] || [];
          return fn(tsData);
        }
        return fn(data || []);
      }
      return data;
    } catch { return null; }
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function fmtNum(n) {
    if (n == null) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  const widgetTs = (w) => w.create_time ? new Date(w.create_time).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  // --- Renderers by kind ---
  function renderChartWidget(w, idx) {
    const cd = JSON.parse(w.chartData);
    const props = cd.widgets[0].props;
    const resolvedProps = resolveEChartsData(props, widgetDataMap);
    const fieldMap = getFieldMap(w);
    applyAlvaDesignTokens(resolvedProps, fieldMap);

    // Series → desc map for tooltip
    const seriesDescMap = buildSeriesDescMap(resolvedProps.series, fieldMap);
    const hasDescMap = Object.keys(seriesDescMap).length > 0;

    const html = `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body chart-dotted-background">
        <div class="chart-body">
          <div id="chart_${idx}" style="width:100%;height:340px;"></div>
          <div class="alva-watermark">Alva</div>
        </div>
      </div>
    </div>`;

    const script = `
    {
      const chart = echarts.init(document.getElementById('chart_${idx}'));
      ${hasDescMap ? `const _descMap = ${JSON.stringify(seriesDescMap)};` : ''}
      const opts = ${JSON.stringify(resolvedProps)};
      ${hasDescMap ? `
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
    return { html, script };
  }

  function renderNewsWidget(w) {
    const items = resolveWidgetData(w) || [];
    const cards = items.slice(0, 20).map(item => `
      <a href="${escapeHtml(item.url || '#')}" target="_blank" class="feed-item">
        ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" class="feed-thumb" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="feed-content">
          <div class="feed-item-title">${escapeHtml(item.title || '')}</div>
          <div class="feed-item-desc">${escapeHtml((item.description || '').slice(0, 160))}${(item.description || '').length > 160 ? '…' : ''}</div>
          <div class="feed-meta">
            ${item.source_icon ? `<img src="${escapeHtml(item.source_icon)}" class="feed-source-icon" onerror="this.style.display='none'">` : ''}
            <span>${escapeHtml(item.source_name || '')}</span>
            ${item.date ? `<span>· ${fmtTime(item.date)}</span>` : ''}
          </div>
        </div>
      </a>`).join('');

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body feed-body">
        ${cards || '<div class="feed-empty">No news available</div>'}
        <div class="alva-watermark">Alva</div>
      </div>
    </div>`, script: '' };
  }

  function renderTwitterWidget(w) {
    const items = resolveWidgetData(w) || [];
    const tweets = items.slice(0, 30).map(t => `
      <a href="${escapeHtml(t.url || '#')}" target="_blank" class="tweet-card">
        <div class="tweet-header">
          ${t.author_profile_image ? `<img src="${escapeHtml(t.author_profile_image)}" class="tweet-avatar">` : '<div class="tweet-avatar-placeholder"></div>'}
          <div class="tweet-author">
            <span class="tweet-name">${escapeHtml(t.author_name || '')}${t.author_verified ? ' <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>' : ''}</span>
            <span class="tweet-handle">@${escapeHtml(t.author_username || '')}</span>
          </div>
          ${t.date ? `<span class="tweet-time">${fmtTime(t.date)}</span>` : ''}
        </div>
        <div class="tweet-text">${escapeHtml((t.content || '').slice(0, 280))}${(t.content || '').length > 280 ? '…' : ''}</div>
        ${t.image_urls?.length ? `<div class="tweet-images">${t.image_urls.slice(0, 4).map(u => `<img src="${escapeHtml(typeof u === 'string' ? u : u?.url || '')}" class="tweet-img" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>` : ''}
        <div class="tweet-stats">
          <span>💬 ${fmtNum(t.comment_count)}</span>
          <span>🔁 ${fmtNum(t.retweets)}</span>
          <span>❤️ ${fmtNum(t.likes)}</span>
        </div>
      </a>`).join('');

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body feed-body">
        <div class="tweet-feed">${tweets || '<div class="feed-empty">No tweets available</div>'}</div>
        <div class="alva-watermark">Alva</div>
      </div>
    </div>`, script: '' };
  }

  function renderTextWidget(w) {
    const md = resolveWidgetData(w) || '';
    // Simple markdown → HTML (headers, bold, italic, lists, links)
    const html = String(md)
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body text-body">
        <div class="text-content"><p>${html}</p></div>
        <div class="alva-watermark">Alva</div>
      </div>
    </div>`, script: '' };
  }

  // --- Auto renderer: infer best layout from data shape + typedoc ---
  function renderAutoWidget(w, chartIdxRef) {
    const data = resolveWidgetData(w);
    const fieldMap = getFieldMap(w);
    const fields = Object.values(fieldMap);
    const sample = Array.isArray(data) ? data[0] : data;

    // If data is a string → treat as text
    if (typeof data === 'string') return renderTextWidget(w);

    // If not an array or empty → skip
    if (!Array.isArray(data) || !data.length) {
      // Maybe it's already an ECharts-compatible chart (has series/xAxis in props)
      try {
        const cd = JSON.parse(w.chartData);
        const props = cd.widgets?.[0]?.props;
        if (props?.series || props?.xAxis) return renderChartWidget(w, chartIdxRef.val++);
      } catch {}
      return null;
    }

    // Detect data shape from actual sample + typedoc
    const hasUrl = fields.some(f => f.name === 'url' || f.type === 'string' && /\burl\b|link/i.test(f.desc));
    const hasTitle = fields.some(f => /^title$/i.test(f.name));
    const hasContent = fields.some(f => /^content$/i.test(f.name));
    const hasAuthor = fields.some(f => /^author/i.test(f.name));
    const hasDate = fields.some(f => f.type === 'number' && /\b(date|time|timestamp)\b/i.test(f.name + ' ' + f.desc));
    const numericFields = fields.filter(f => f.type === 'number' && !/\b(date|time|timestamp|id)\b/i.test(f.name + ' ' + f.desc));

    // Social feed: has content + author
    if (hasContent && hasAuthor) {
      // Check if twitter-like (has likes/retweets)
      const hasSocialStats = fields.some(f => /likes|retweets|comment_count/i.test(f.name));
      if (hasSocialStats) return renderTwitterWidget(w);
      // Generic social feed → render as news-like with content as desc
      return renderNewsWidget(w);
    }

    // News/article: has title + url
    if (hasTitle && hasUrl) return renderNewsWidget(w);

    // KPI: few rows (≤5) with mostly numbers
    if (data.length <= 5 && numericFields.length >= 2) {
      return renderKpiWidget(w, data, fields);
    }

    // Time series: has date + multiple numeric fields → auto-generate line chart
    if (hasDate && numericFields.length >= 1 && data.length > 5) {
      return renderAutoChart(w, data, fields, chartIdxRef);
    }

    // Table fallback: structured data with many fields
    if (fields.length >= 3 && data.length > 1) {
      return renderTableWidget(w, data, fields);
    }

    // Last resort: dump as formatted text
    return renderTextWidget(w);
  }

  // KPI card renderer
  function renderKpiWidget(w, data, fields) {
    const latest = data[data.length - 1] || data[0] || {};
    const numFields = fields.filter(f => f.type === 'number' && !/\b(date|time|timestamp|id)\b/i.test(f.name + ' ' + f.desc));
    const kpis = numFields.slice(0, 6).map(f => {
      const val = latest[f.name];
      const isPct = /pct|percent|%/i.test(f.name + ' ' + f.desc);
      const formatted = val == null ? '—' : isPct ? (val >= 0 ? '+' : '') + val.toFixed(2) + '%' : fmtNum(val);
      const color = isPct && val != null ? (val >= 0 ? 'var(--main-m3)' : 'var(--main-m4)') : 'var(--text-n9)';
      return `<div class="kpi-item">
        <div class="kpi-value" style="color:${color}">${formatted}</div>
        <div class="kpi-label">${escapeHtml(f.desc || f.name)}</div>
      </div>`;
    }).join('');

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body kpi-body">
        <div class="kpi-grid">${kpis}</div>
        <div class="alva-watermark">Alva</div>
      </div>
    </div>`, span: 6, script: '' };
  }

  // Auto-generated line chart from time series data
  function renderAutoChart(w, data, fields, chartIdxRef) {
    const idx = chartIdxRef.val++;
    const dateField = fields.find(f => f.type === 'number' && /\b(date|time|timestamp)\b/i.test(f.name + ' ' + f.desc));
    const numFields = fields.filter(f => f.type === 'number' && f !== dateField && !/\bid\b/i.test(f.name));
    const sorted = [...data].sort((a, b) => (a[dateField.name] || 0) - (b[dateField.name] || 0));

    const colors = ['#49A3A6', '#5499D6', '#E6A91A', '#e05357', '#2a9b7d', '#9B59B6'];
    const series = numFields.slice(0, 6).map((f, i) => ({
      name: f.desc || f.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1 },
      itemStyle: { color: colors[i % colors.length] },
      data: sorted.map(r => [r[dateField.name], r[f.name]]),
    }));

    const opts = {
      backgroundColor: 'transparent',
      grid: { top: 50, right: 12, bottom: 0, left: 12, containLabel: true },
      xAxis: { type: 'time', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { fontSize: 10, color: 'rgba(0,0,0,0.7)' } },
      yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { fontSize: 10, color: 'rgba(0,0,0,0.7)' } },
      legend: { top: 0, right: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: 'rgba(0,0,0,0.5)', fontSize: 10 } },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1, borderRadius: 6, padding: 12, textStyle: { fontSize: 12, color: 'rgba(0,0,0,0.9)' },
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.1)', width: 1 } }, extraCssText: 'box-shadow:none;' },
      dataZoom: { type: 'inside' },
      series,
    };

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body chart-dotted-background">
        <div class="chart-body">
          <div id="chart_${idx}" style="width:100%;height:340px;"></div>
          <div class="alva-watermark">Alva</div>
        </div>
      </div>
    </div>`, script: `
    {
      const chart = echarts.init(document.getElementById('chart_${idx}'));
      chart.setOption(${JSON.stringify(opts)});
      window.addEventListener('resize', () => chart.resize());
    }` };
  }

  // Table renderer
  function renderTableWidget(w, data, fields) {
    const displayFields = fields.filter(f => f.type !== 'boolean' && !/\b(date|timestamp)\b/i.test(f.name)).slice(0, 8);
    const rows = data.slice(0, 50);
    const thead = displayFields.map(f => `<th>${escapeHtml(f.desc || f.name)}</th>`).join('');
    const tbody = rows.map(r => {
      const cells = displayFields.map(f => {
        let v = r[f.name];
        if (v == null) return '<td>—</td>';
        if (f.type === 'number') v = typeof v === 'number' ? v.toLocaleString() : v;
        if (typeof v === 'string' && v.startsWith('http')) return `<td><a href="${escapeHtml(v)}" target="_blank">🔗</a></td>`;
        return `<td>${escapeHtml(String(v).slice(0, 100))}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return { html: `
    <div class="widget-card">
      <div class="widget-title">
        <span class="widget-title-text">${escapeHtml(w.name)}</span>
        <span class="widget-timestamp">${widgetTs(w)}</span>
      </div>
      <div class="widget-body table-body">
        <table class="alva-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
        <div class="alva-watermark">Alva</div>
      </div>
    </div>`, script: '' };
  }

  // --- Build all widgets ---
  const renderedWidgets = [];
  const scripts = [];
  const chartIdxRef = { val: 0 };

  for (const w of widgets) {
    if (w.status === 'FAILED' || !w.chartData) {
      console.error(`  ⚠️ Skipping ${w.name} (${w.status || 'no chartData'})`);
      continue;
    }
    const kind = getWidgetKind(w);
    let result;

    // Try known templates first, then auto-detect
    switch (kind) {
      case 'news':
        result = renderNewsWidget(w);
        break;
      case 'twitter':
        result = renderTwitterWidget(w);
        break;
      case 'text':
        result = renderTextWidget(w);
        break;
      case 'chart':
        result = renderChartWidget(w, chartIdxRef.val++);
        break;
      default:
        // Auto-detect from data shape
        result = renderAutoWidget(w, chartIdxRef);
        break;
    }
    if (result) {
      // Auto-assign span based on kind
      const span = result.span || autoSpan(kind, widgets.length);
      const wrapped = result.html.replace('<div class="widget-card">', `<div class="widget-card span-${span}">`);
      renderedWidgets.push(wrapped);
      if (result.script) scripts.push(result.script);
    }
  }

  // Smart span assignment
  function autoSpan(kind, totalWidgets) {
    // Feed types always full width
    if (['news', 'twitter', 'text'].includes(kind)) return 12;
    // If only 1 chart, full width; 2 charts = half each; 3+ = mixed
    if (kind === 'chart' || kind === 'unknown') {
      if (totalWidgets === 1) return 12;
      if (totalWidgets === 2) return 6;
      if (totalWidgets === 3) return 4;
      return 6;
    }
    return 6;
  }

  function buildSeriesDescMap(series, fieldMap) {
    const map = {};
    if (!series) return map;
    const fieldEntries = Object.entries(fieldMap);
    for (const s of series) {
      if (!s.name) continue;
      const sn = s.name;
      const snLower = sn.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fieldMap[sn]) { map[sn] = fieldMap[sn].desc; continue; }
      for (const [fname, fdef] of fieldEntries) {
        if (fname.toLowerCase().replace(/[^a-z0-9]/g, '') === snLower) { map[sn] = fdef.desc; break; }
      }
      if (map[sn]) continue;
      for (const [fname, fdef] of fieldEntries) {
        if (fdef.desc.toLowerCase().includes(sn.toLowerCase())) { map[sn] = fdef.desc; break; }
      }
      if (map[sn]) continue;
      for (const [fname, fdef] of fieldEntries) {
        if (fdef.type === 'number' && snLower.includes(fname.toLowerCase().replace(/[^a-z0-9]/g, ''))) { map[sn] = fdef.desc; break; }
      }
    }
    return map;
  }

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
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--spacing-xl);
}
.widget-card {
  background: transparent;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
/* Span classes: span-4 (1/3), span-6 (1/2), span-8 (2/3), span-12 (full) */
.span-4  { grid-column: span 4; }
.span-6  { grid-column: span 6; }
.span-8  { grid-column: span 8; }
.span-12 { grid-column: span 12; }
@media (max-width: 900px) {
  .span-4, .span-6, .span-8 { grid-column: span 12; }
}
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
/* Feed (news) styles */
.feed-body { background: var(--grey-g01); padding: var(--spacing-m); max-height: 600px; overflow-y: auto; position: relative; }
.feed-item { display: flex; gap: var(--spacing-s); padding: var(--spacing-s) 0; border-bottom: 1px solid var(--line-l05); text-decoration: none; color: inherit; }
.feed-item:last-child { border-bottom: none; }
.feed-item:hover { background: var(--line-l05); border-radius: var(--radius-ct-s); }
.feed-thumb { width: 72px; height: 54px; object-fit: cover; border-radius: var(--radius-ct-s); flex-shrink: 0; }
.feed-content { flex: 1; min-width: 0; }
.feed-item-title { font-size: 13px; font-weight: 500; color: var(--text-n9); line-height: 1.4; margin-bottom: 2px; }
.feed-item-desc { font-size: 12px; color: var(--text-n5); line-height: 1.4; }
.feed-meta { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; color: var(--text-n3); }
.feed-source-icon { width: 14px; height: 14px; border-radius: 2px; }
.feed-empty { text-align: center; padding: 40px; color: var(--text-n3); font-size: 13px; }
/* Tweet styles */
.tweet-feed { max-height: 700px; overflow-y: auto; }
.tweet-card { display: block; padding: var(--spacing-s); border-bottom: 1px solid var(--line-l05); text-decoration: none; color: inherit; }
.tweet-card:hover { background: var(--line-l05); }
.tweet-header { display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: 6px; }
.tweet-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.tweet-avatar-placeholder { width: 36px; height: 36px; border-radius: 50%; background: var(--line-l07); flex-shrink: 0; }
.tweet-author { flex: 1; min-width: 0; }
.tweet-name { font-size: 13px; font-weight: 500; color: var(--text-n9); display: flex; align-items: center; gap: 2px; }
.tweet-handle { font-size: 12px; color: var(--text-n5); }
.tweet-time { font-size: 11px; color: var(--text-n3); white-space: nowrap; }
.tweet-text { font-size: 13px; color: var(--text-n9); line-height: 1.5; margin-bottom: 6px; white-space: pre-wrap; word-break: break-word; }
.tweet-images { display: flex; gap: 4px; margin-bottom: 6px; }
.tweet-img { max-width: 200px; max-height: 150px; border-radius: var(--radius-ct-s); object-fit: cover; }
.tweet-stats { display: flex; gap: var(--spacing-m); font-size: 12px; color: var(--text-n5); }
/* Text widget styles */
.text-body { background: var(--grey-g01); padding: var(--spacing-l); position: relative; max-height: 600px; overflow-y: auto; }
.text-content { font-size: 13px; color: var(--text-n9); line-height: 1.7; }
.text-content h2 { font-size: 18px; font-weight: 500; margin: 16px 0 8px; }
.text-content h3 { font-size: 15px; font-weight: 500; margin: 12px 0 6px; }
.text-content h4 { font-size: 13px; font-weight: 500; margin: 10px 0 4px; }
.text-content ul { padding-left: 20px; margin: 8px 0; }
.text-content li { margin: 4px 0; }
.text-content a { color: var(--main-m1); text-decoration: none; }
.text-content a:hover { text-decoration: underline; }
.text-content strong { font-weight: 500; }
/* KPI styles */
.kpi-body { background: var(--grey-g01); padding: var(--spacing-l); position: relative; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--spacing-l); }
.kpi-item { text-align: center; }
.kpi-value { font-size: 28px; font-weight: 500; line-height: 1.2; margin-bottom: 4px; }
.kpi-label { font-size: 11px; color: var(--text-n5); line-height: 1.3; }
/* Table styles */
.table-body { background: transparent; padding: 0; position: relative; overflow-x: auto; }
.alva-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.alva-table th { text-align: left; font-weight: 500; color: var(--text-n7); padding: 8px var(--spacing-s); border-bottom: 1px solid var(--line-l07); font-size: 11px; }
.alva-table td { padding: 6px var(--spacing-s); color: var(--text-n9); border-bottom: 1px solid var(--line-l05); }
.alva-table tr:hover td { background: var(--line-l05); }
.alva-table a { color: var(--main-m1); text-decoration: none; }
</style>
</head>
<body>

<div class="dashboard-header">
  <div class="dashboard-title">${escapeHtml(dashboardName)}</div>
  ${dashboardDesc ? `<div class="dashboard-desc">${escapeHtml(dashboardDesc)}</div>` : ''}
</div>

<div class="dashboard-grid">
  ${renderedWidgets.join('\n')}
</div>

<div class="footer">
  Generated ${timestamp} · Data by Alva · Rendered with Alva Design System
</div>

<script>
${scripts.join('\n')}
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
