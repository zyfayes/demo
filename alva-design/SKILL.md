---
name: alva-design
description: "Alva 设计系统，在生成各类型 Alva 页面、Dashboard Widgets、Playbooks 时，提供统一设计规范。触发场景：(1) 生成 Alva Dashboard Widgets (2) 生成 Playbooks (3) 设计 Alva 页面 (4) 设计新页面或模块 (5) 需要 Alva 设计规范参考时。关键词：Alva、Trading Strategy、Dashboard、Widget、Chart、Playbook、Design System、Guideline、设计规范。"
---

# Alva Design System

## Design Tokens

### Colors 颜色规范

```css
/* Text */
--text-n10: rgb(0,0,0);   /* 强调文本 */
--text-n9: rgba(0,0,0,0.9);   /* 主文本 */
--text-n7: rgba(0,0,0,0.7);   /* 次级 */
--text-n5: rgba(0,0,0,0.5);   /* 辅助 */
--text-n3: rgba(0,0,0,0.3);   /* 占位提示 */

/* Semantic */
--main-m1: #49A3A6;           /* Alva全局主题色 青 */
--main-m1-10: #49A3A6;        /* 带透明度背景 青 */
--main-m2: #2196F3;           /* 文字链 蓝 */
--main-m2-10: rgba(33,150,243,0.1); /* 带透明度背景 蓝 */
--main-m3: #2a9b7d;           /* 正向/上涨 绿 */
--main-m3-10: rgba(42,155,125,0.1); /* 带透明度背景 绿 */
--main-m4: #e05357;           /* 负向/下跌 红 */
--main-m4-10: rgba(224,83,87,0.1); /* 带透明度背景 红 */
--main-m5: #E6A91A;           /* 警示 黄 */
--main-m5-10: rgba(230,169,26,0.1); /* 带透明度背景 黄 */
--main-m6: #ff9800;           /* 强调 橙 */
--main-m7: rgba(0,0,0,0.5);    /* 弹窗背景遮罩 */

/* Chart */
--chart-orange1-main: #FF9800;
--chart-orange1-1: #FFBB1C;
--chart-orange1-2: #F8CB86;
--chart-green1-main: #40A544;
--chart-green1-1: #007949;
--chart-green1-2: #78C26D;
--chart-green2-main: #8FC13A;
--chart-green2-1: #5B8513;
--chart-green2-2: #C0D40F;
--chart-cyan1-1: #117A7D;
--chart-cyan1-2: #77C9C2;
--chart-cyan2-main: #7CAFAD;
--chart-cyan2-1: #4C807E;
--chart-cyan2-2: #A5C7C6;
--chart-blue1-main: #3D8BD1;
--chart-blue1-1: #005DAF;
--chart-blue1-2: #88B7E0;
--chart-blue2-main: #0D7498;
--chart-blue2-1: #54A5C2;
--chart-blue2-2: #91D1DB;
--chart-purple1-main: #5F75C9;
--chart-purple1-1: #3A52BE;
--chart-purple1-2: #9AB1D7;
--chart-purple2-main: #7474D8;
--chart-purple2-1: #4646AE;
--chart-purple2-2: #AFBBF7;
--chart-violet1-main: #A878DC;
--chart-violet1-1: #7F4EB4;
--chart-violet1-2: #D4B2E1;
--chart-pink1-main: #DC7AA5;
--chart-pink1-1: #BA5883;
--chart-pink1-2: #ECB0CA;
--chart-red1-main: #C76466;
--chart-red1-1: #A94749;
--chart-red1-2: #F2A0A1;
--chart-grey-main: #838383;
--chart-grey-1: #555555;
--chart-grey-2: #B7B7B7;

/* Other */
--b0-page: #ffffff;           /* 页面默认背景 */
--b0-container: #ffffff;      /* 大模块背景 */
--b0-sidebar: #2A2A38;       /* 侧边栏背景 */
--b0-sidebar-selected: rgba(255,255,255,.03);      /* 侧边栏背景悬浮态 */
--grey-g01: #fafafa;          /* Dashboard卡片背景 */
--line-l07: rgba(0,0,0,0.07); /* 默认分割线 */
--line-l05: rgba(0,0,0,0.05); /* 弱化分割线 */
--line-l12: rgba(0,0,0,0.12); /* 加强分割线 */
--line-l2: rgba(0,0,0,0.2);  /* 下拉框/悬浮组件 边框 */
--line-l3: rgba(0,0,0,0.3);  /* 按钮/输入框/选择框 边框 */
```

### Spacing & Radius 间距和圆角规范

```css
--spacing-xxxs: 2px;  --spacing-xxs: 4px;  --spacing-xs: 8px;   --spacing-s: 12px;
--spacing-m: 16px;   --spacing-l: 20px;   --spacing-xl: 24px;   --spacing-xxl: 28px;
--spacing-xxxl: 32px;   --spacing-xxxxl: 40px;   --spacing-xxxxxl: 48px;   --spacing-xxxxxxl: 56px;

--radius-ct-xs: 2px;  /* 标签 */
--radius-ct-s: 4px;  /* 小卡片 */
--radius-ct-m: 6px;  /* 大卡片/内容区 */
--radius-ct-m: 8px;  /* 页面级 */
```

## General Design Guideline

### Background 背景规范

页面级别的背景颜色，必须使用--b0-page

### Typography & Font 字体规范

#### 字体通用规范

1. **默认使用Delight，代码使用JetBrains Mono**；
2. 备选字体为:-apple-system，BlinkMacSystemFont，sans-serif；

#### 字重规范

Alva 字重仅允许 Regular(400) 和 Medium(500)，不得使用 Semibold(600) 或 Bold(700)。

| font-size | 允许字重 |
|---|---|
| < 24px | Regular(400) 或 Medium(500) |
| **≥ 24px** | **仅 Regular(400)** |

## 使用方式

1. **设计 Page(页面)/Dashboard/Playbook/Module(模块)** → 遵循 Design Tokens，保持一致性
2. **设计 Page(页面)/Playbook/Dashboard** → 参考本文档 + [layout.md](references/layout.md)
3. **调用 Components(组件)** → 参考本文档 + [components.md](references/components.md)
4. **生成 Widget/Chart** → 参考本文档 + [widgets.md](references/widgets.md)

