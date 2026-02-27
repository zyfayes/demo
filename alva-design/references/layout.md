# 页面/模块设计规范

## Dashboard

Dashboard由不同的Widgets组成，生成 Widget 参考本文档 + [widgets.md](widgets.md)

### Dashboard 页面规范

**重要规范**：复用Freshman Dashboard的通用顶部栏组件和样式

- **Chart Card（图表卡片）**：使用点状背景
  ```css
  background-color: #ffffff;
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.18) 0.6px, transparent 0.6px);
  background-size: 3px 3px;
  ```

### Dashboard 布局规范

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

### 响应式

```css
/* 桌面端（默认） */
.playbook-container {
    max-width: 2560px;
    margin: 0 auto;
}
```

