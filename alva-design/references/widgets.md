# Widget 设计规范

## Widget 目录和类型
- [Widget](#widget-card)
- [Free Text](#free-text-card)
- [Chart](#chart-card)

## Widget 通用规范

### Widget 共享结构

这是所有Widget共享的外层结构和容器

```html
<div class="widget-card">
  <div class="widget-title">
    <span class="widget-title-text">Title</span>
    <span class="widget-timestamp">12:30</span>
  </div>
  <div class="widget-body">
    <!-- content -->
    <div class="alva-watermark">Alva</div>
  </div>
</div>
```

```css
.widget-card {
    background: transparent;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}

.widget-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 22px;
    margin-bottom: var(--spacing-m);
}

.widget-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: var(--radius-ct-s);
}

.widget-title-text {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-n9);
    letter-spacing: 0.14px;
    line-height: 22px;
}

.widget-timestamp {
    display: flex;
    align-items: center;
    gap: var(--spacing-xxs);
    font-size: 12px;
    color: var(--text-n5);
    line-height: 20px;
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
```

### Widget 布局规范

```css
/* 等宽双列（默认） */
.row-equal {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xl);
}

/* 左窄右宽 */
.row-narrow-wide {
    display: grid;
    grid-template-columns: 2fr 3fr;  /* 40% : 60% */
    gap: var(--spacing-xl);
}

/* 左宽右窄 */
.row-wide-narrow {
    display: grid;
    grid-template-columns: 3fr 2fr;  /* 60% : 40% */
    gap: var(--spacing-xl);
}

/* 三列等宽 */
.row-thirds {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-xl);
}
```

### Widget 设计规范

#### Widget 背景规范

**重要规范**：Widget 背景色根据类型区分

- **Chart Card（图表卡片）**：使用点状背景，样式见 `.chart-dotted-background`

- **其他所有 Widget（文字卡片、Feed Card、KPI Card 等）**：默认使用 g01 背景色
  ```css
  background-color: var(--grey-g01); /* #fafafa */
  ```

- **Table Card（表格卡片）**：无背景色

---

#### Widget 分割线规范

Widget 内部分割线不得通栏，两端必须与内容 padding 对齐。

**方案：Flex 独立分割线元素**

适用于所有使用 flex 布局的 Widget（KPI Card、Free Text Card 等）。

```tsx
{/* 竖向分割线 — my 值 = 单元格垂直 padding */}
<div
  className="my-[20px] w-px shrink-0"
  style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
/>

{/* 横向分割线 — mx 值 = 单元格水平 padding */}
<div
  className="mx-[20px] h-px"
  style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
/>
```

`my` / `mx` 必须等于相邻单元格的 padding 值：

| 单元格 padding | 分割线 margin |
|---|---|
| `p-[12px]` | `my-[12px]` / `mx-[12px]` |
| `p-[16px]` | `my-[16px]` / `mx-[16px]` |
| `p-[20px]` | `my-[20px]` / `mx-[20px]` |

颜色统一使用 `--line-l05`：`rgba(0, 0, 0, 0.05)`。

```css
/* ❌ 禁止 — 通栏贴边 */
border-bottom: 1px solid rgba(0,0,0,0.05);
border-right:  1px solid rgba(0,0,0,0.05);
```

---

## Free Text Card 文字卡片

用于展示叙事背景、投资逻辑等富文本内容。
1. 调用 Markdown 组件，参考本文档 + [components.md](components.md)；
2. 推荐默认高度370。
3. 关键指标文字大小可使用24px或28px。

```css
.free-text-body {
    padding: var(--spacing-l);
}
```

---

## Chart Card 图表卡片

1. 用于生成各类图表，如折线图、柱状图等，使用Echarts来实现，推荐默认高度370；
2. 图表颜色使用Design Tokens里chart的颜色，使用main分别搭配1和2随机调用；
3. 图例和图表部分不要重叠；

```css
.chart-dotted-background {
    background-color: #ffffff;
    background-image: radial-gradient(circle, rgba(0, 0, 0, 0.18) 0.6px, transparent 0.6px);
    background-size: 3px 3px;
}

.chart-body {
    flex: 1;
    padding: var(--spacing-m);
    position: relative;
}

/* 图例 */
.chart-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-xs);
    height: 16px;
    margin-bottom: var(--spacing-xxs);
}

.legend-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xxs);
    font-size: 10px;
    color: var(--text-n5);
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
```

**Chart.js 配置**:
- `borderWidth: 1`
- `tension: 0.1`
- `pointRadius: 0`
- `grid: { display: false }`

### 坐标轴标准 (Axis)

```javascript
// ⚠️ 坐标轴共享配置 AX — 每次生成 Chart 必须用此配置
const AX = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
        fontSize: 10,
        color: 'rgba(0,0,0,0.7)',       // ← --text-n7，不是 0.4 或 0.5
        fontFamily: "'Delight',-apple-system,BlinkMacSystemFont,sans-serif",  // ← Delight！不是 Inter
        margin: 8                        // ← 标签到轴线 8px 间距
    },
    splitLine: { show: false }
};

// ⚠️ Grid 必须用 containLabel:true — 自动计算轴标签到容器边距
grid: { top: 4, right: 4, bottom: 4, left: 4, containLabel: true }
// 禁止用硬编码 left:40/44/48 + bottom:32 的旧写法

// ⚠️ 折线图 xAxis 必须加 boundaryGap:false — 数据从边缘开始，不留空白
xAxis: { type: 'category', data: x, boundaryGap: false, ...AX }
```

### 分割线标准（markLine）

**重要规范**：虚线分割线仅在0轴出现

- **0轴分割线**：使用虚线样式
  - `color: 'rgba(0,0,0,0.3)'`
  - `type: [3, 2]` (Dash 3px, Gap 2px)
  - `width: 1`
  - `silent: true`
  - `symbol: 'none'`

- **非0轴分割线**：不显示（透明度为0或不添加 markLine）

**示例**：
```javascript
// 条形图 - x轴从0开始，应在0处显示虚线
markLine: {
  silent: true,
  symbol: 'none',
  data: [{ xAxis: 0 }],
  lineStyle: {
    color: 'rgba(0,0,0,0.3)',
    type: [3, 2],
    width: 1
  },
  label: { show: false }
}

// 折线图 - y轴范围80-160不包含0，不应显示 markLine
// 不添加 markLine 配置
```

### 悬浮提示标准 (Tooltip) 

**重要规范**：所有图表悬浮提示框必须遵循统一样式

**Chart.js 配置**：
```javascript
{
  plugins: {
    tooltip: {
      backgroundColor: 'rgba(255,255,255,0.96)',  // 近白色半透明背景
      titleColor: 'rgba(0,0,0,0.7)',              // 标题颜色 n7
      bodyColor: 'rgba(0,0,0,0.9)',               // 正文颜色 n9
      borderColor: 'rgba(0,0,0,0.12)',            // 极淡边框
      borderWidth: 1,                             // 1px 边框
      cornerRadius: 6,                            // 圆角 6px（--radius-ct-m）
      caretSize: 0,                               // 无箭头指向
      padding: 12,                                // 内边距 12px（四周）
      titleFont: {
        family: 'Delight',
        size: 12,
        weight: '400'
      },
      bodyFont: {
        family: 'Delight',
        size: 12,
        weight: '400'
      },
      displayColors: true,                        // 显示色块
      boxWidth: 8,                                // 色块宽 8px
      boxHeight: 8,                               // 色块高 8px
      boxPadding: 4,                              // 色块与文字间距 4px
      usePointStyle: true,                        // 色块使用圆点样式
      pointStyle: 'circle'                        // 圆形色块
    }
  },
  interaction: {
    mode: 'index',                                // 同 X 轴所有数据集联动
    intersect: false                              // 无需精确悬浮在点上
  }
}
```

**ECharts 配置**：

> ⚠️ ECharts 的 `textStyle.color` 是全局统一色，无法原生分离标题/数据行颜色。
> 必须通过 `formatter` 手动输出 HTML 来实现标题 n7 + 数据行 n9。

```javascript
// ── 共享 formatter 工厂函数（每个文件定义一次）──
// valueFn: 格式化每条数据的值，默认原始值，按图表单位覆盖
function mkFmt(valueFn) {
    valueFn = valueFn || (v => v);
    return params => {
        const t = params[0].axisValueLabel || params[0].axisValue;
        let s = `<div style="font-size:12px;color:rgba(0,0,0,0.7);margin-bottom:6px;">${t}</div>`;
        params.forEach(p => {
            s += `<div style="display:flex;align-items:center;gap:6px;line-height:20px;">` +
                 `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${p.color};"></span>` +
                 `<span style="color:rgba(0,0,0,0.9);">${p.seriesName}</span>` +
                 `<span style="color:rgba(0,0,0,0.9);margin-left:auto;">${valueFn(p.value, p)}</span>` +
                 `</div>`;
        });
        return s;
    };
}

// ── 共享 TT 常量（包含默认 formatter）──
const TT = {
    trigger: 'axis',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    textStyle: {
        fontFamily: "'Delight',-apple-system,BlinkMacSystemFont,sans-serif",
        fontSize: 12,
        fontWeight: 400,
        color: 'rgba(0,0,0,0.9)'
    },
    axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.1)', width: 1 } },
    extraCssText: 'box-shadow:none;',             // 去除 ECharts 默认阴影
    formatter: mkFmt()                            // 默认：原始值，标题 n7
};

// ── 各图表按单位覆盖 formatter ──
// 原始数值（0-100）：tooltip: TT
// 带 $ 和 B 后缀：  tooltip: {...TT, formatter: mkFmt(v => '$' + v + 'B')}
// 带 % 后缀：       tooltip: {...TT, formatter: mkFmt(v => v + '%')}
// 带 x 后缀：       tooltip: {...TT, formatter: mkFmt(v => v + 'x')}
// 带符号的 %：      tooltip: {...TT, formatter: mkFmt(v => (v>=0?'+':'') + v + '%')}
```

### 折线图标准 (Line Chart)

**生成Line Chart** → 参考本文档 (.claude/skills/alva-design/references/reference-line-chart.html)

1. 折线粗细1px
2. 1条折线时有渐变背景色
3. 2条及以上时无渐变背景色

#### 悬浮圆点标准

**重要规范**：所有折线图悬浮时必须在对应折线位置显示圆点

**Chart.js 配置**：
```javascript
{
  pointRadius: 0,                    // 默认不显示
  pointHoverRadius: 5,                // 悬浮时半径 5px
  pointHoverBackgroundColor: '主色',   // 悬浮时圆点颜色
  pointHoverBorderColor: '#ffffff',   // 白色边框
  pointHoverBorderWidth: 1            // 边框 1px
}
```

**ECharts 配置**：
```javascript
{
  symbol: 'circle',                   // 圆形符号
  symbolSize: 10,                     // 圆点直径 10px（对应 Chart.js radius 5）
  showSymbol: false,                  // 默认不显示
  emphasis: {
    itemStyle: {
      borderColor: '#ffffff',         // 白色边框
      borderWidth: 1,                 // 边框 1px
      color: '主色'                   // 圆点颜色
    }
  }
}
```

**注意事项**：
- 不使用 `shadowBlur`、`shadowColor` 等阴影效果
- 不使用 `focus: 'series'`
- 确保所有折线图悬浮圆点样式统一



### 柱状图标准 (Bar Chart)

**生成Bar Chart** → 参考本文档 (.claude/skills/alva-design/references/reference-bar-chart.html)

1. 柱子最大宽度为16px，相邻柱子的间距为8px

## KPI Card

### KPI 颜色规则

| 类型 | Class | 颜色 | 示例 | Design Token |
|------|-------|------|------|
| 正向 | `.positive` | 绿 | Return +18% | --main-m3
| 负向 | `.negative` | 红 | Drawdown -12% | --main-m4
| 中性 | `.neutral` | 黑 | Volatility 22% | --text-n9

## Table Card 表格卡片

用于生成各类不同的表格，推荐默认高度370。

### Overview

| Property         | Value                          |
| ---------------- | ------------------------------ |
| Layout           | Vertical (flex-col)            |
| Gap              | 16px                           |
| Border Radius    | 4px                            |
| Isolation        | isolate                        |
| Width            | 100% (fill container)          |

---

### Typography

#### Font Family

| Token       | Value                                |
| ----------- | ------------------------------------ |
| Font Family | `Delight Regular`, sans-serif        |
| Font Weight | 400 (Regular)                        |
| Font Style  | normal                               |

> All text elements in this component uniformly use **Delight Regular** (font-weight: 400). No bold or other weight variants are used.

#### Text Styles

| Element            | Font Size | Font Weight | Line Height | Letter Spacing | Color                    |
| ------------------ | --------- | ----------- | ----------- | -------------- | ------------------------ |
| Title Text         | 14px      | 400         | 22px        | 0.14px         | rgba(0, 0, 0, 0.9)      |
| Table Header       | 14px      | 400         | 22px        | 0.14px         | rgba(0, 0, 0, 0.7)      |
| Table Body Cell    | 14px      | 400         | 22px        | 0.14px         | rgba(0, 0, 0, 0.9)      |

---

### Layout Detail

#### Table

| Property      | Value                  |
| ------------- | ---------------------- |
| Layout        | Horizontal (flex-row)  |
| Overflow      | clip                   |
| Width         | 100%                   |
| z-index       | 1                      |

#### Table Column

| Property      | Value                  |
| ------------- | ---------------------- |
| Layout        | Vertical (flex-col)    |
| Alignment     | flex-start             |
| Flex Shrink   | 0                      |

#### Table Header Cell

| Property             | Value                          |
| -------------------- | ------------------------------ |
| Padding (first col)  | 0 16px 12px 0                  |
| Padding (other cols) | 0 16px 12px 16px               |
| Border Bottom        | 1px solid rgba(0, 0, 0, 0.07) |

#### Table Body Cell

| Property             | Value                          |
| -------------------- | ------------------------------ |
| Padding (first col)  | 12px 16px 12px 0               |
| Padding (other cols) | 12px 16px                      |
| Border Bottom        | 1px solid rgba(0, 0, 0, 0.07) |
| Width                | 100% (fill column)             |
| White Space          | nowrap                         |

### Interaction & States

| State    | Description                                 |
| -------- | ------------------------------------------- |
| Default  | Static data display, no hover effects       |
| Overflow | Horizontal scroll when container too narrow |

---

### Responsive Behavior

| Breakpoint | Behavior                                          |
| ---------- | ------------------------------------------------- |
| >= 960px   | Full table displayed without scroll               |
| < 960px    | Horizontal overflow with clip, scrollable content |

## Feed Card 信息流卡片

```css
.feed-body {
    padding: var(--spacing-xxs) 0;
}
.feed-item {
    padding: var(--spacing-m);
    position: relative;
}
.feed-item::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: var(--spacing-m);
    right: var(--spacing-m);
    height: 1px;
    background: var(--line-l05);
}
.feed-item:last-child::after { display: none; }
.feed-thumb {
    width: 88px;
    height: 70px;
    border-radius: var(--radius-ct-s);
    flex-shrink: 0;
}
```

## Group Title 分组大标题

用于当 widgets 有分隔需求时，标识一个主题块的起始。不属于 widget-card，是页面级布局元素。

### 结构

```html
<div class="section-title">
  <span class="section-title-icon">🖥️</span>
  <span class="section-title-text">Data Center (AI GPUs)</span>
  <span class="section-title-sub">Highest Narrative Heat · Blackwell Demand</span>
</div>
```

`section-title-icon` 和 `section-title-sub` 均为可选，有内容时才添加。

### CSS

```css
.section-title {
    display: inline-flex;
    align-items: center;
    gap: 12px;                            /* --sp-s */
    margin-top: 8px;                      /* --sp-xs，与上方内容保持间距 */
}

/* Icon — Emoji，与标题等高 */
.section-title-icon {
    font-size: 22px;
    line-height: 1;
}

/* 主标题 */
.section-title-text {
    font-size: 22px;
    font-weight: 400;                     /* Regular only */
    color: var(--text-n9);               /* rgba(0,0,0,0.9) */
    letter-spacing: 0.3px;
}

/* 副标题 / 关键词摘要 */
.section-title-sub {
    font-size: 11px;
    color: var(--text-n5);               /* rgba(0,0,0,0.5) */
    padding-left: 8px;                   /* --sp-xs */
    border-left: 1px solid var(--line-l07); /* rgba(0,0,0,0.07) */
}
```

### Tailwind（React）

```tsx
<div className="inline-flex items-center gap-[12px] mt-[8px]">
  <span className="text-[22px] leading-none">🖥️</span>
  <span className="text-[22px] font-normal text-[rgba(0,0,0,0.9)] tracking-[0.3px]">
    Data Center (AI GPUs)
  </span>
  <span className="text-[11px] text-[rgba(0,0,0,0.5)] pl-[8px] border-l border-[rgba(0,0,0,0.07)]">
    Highest Narrative Heat · Blackwell Demand
  </span>
</div>
```

### 使用规则

| 属性 | 规范 |
|---|---|
| 字号 | 22px，固定不变 |
| 字重 | Regular (400) only |
| 图标 | Emoji，可省略 |
| 副标题分隔符 | `·`（中点），关键词之间两侧各留一个空格 |
| 副标题关键词数 | 不超过 3 个 |
| 与上方 widget 间距 | `margin-top: 8px` |
| 与下方 widget 行间距 | 沿用页面标准 `gap: 24px` |