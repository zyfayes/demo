# 基础组件模板

## 下拉框 Dropdown 模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>下拉框组件</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background-color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .dropdown-container {
            width: 320px;
        }

        .dropdown {
            background-color: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding-top: 8px;
            padding-bottom: 8px;
            position: relative;
            border-radius: 6px;
            width: 100%;
        }

        .dropdown-border {
            position: absolute;
            border: 0.5px solid rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            inset: 0;
            pointer-events: none;
        }

        .list-item {
            position: relative;
            flex-shrink: 0;
            width: 100%;
            cursor: pointer;
            transition: background-color 0.15s ease;
        }

        .list-item:hover {
            background-color: rgba(0, 0, 0, 0.03);
        }

        .list-item.selected {
            background-color: rgba(0, 0, 0, 0.03);
        }

        .list-item-inner {
            display: flex;
            flex-direction: row;
            align-items: center;
            width: 100%;
            height: 100%;
        }

        .list-item-content {
            display: flex;
            gap: 8px;
            align-items: center;
            padding-left: 16px;
            padding-right: 16px;
            padding-top: 7px;
            padding-bottom: 7px;
            position: relative;
            width: 100%;
        }

        .list-item-left {
            display: flex;
            flex: 1 0 0;
            gap: 8px;
            height: 22px;
            align-items: center;
            min-height: 1px;
            min-width: 1px;
            position: relative;
        }

        .list-item-text {
            flex: 1 0 0;
            font-size: 14px;
            line-height: 22px;
            min-height: 1px;
            min-width: 1px;
            font-style: normal;
            overflow: hidden;
            position: relative;
            color: rgba(0, 0, 0, 0.9);
            text-overflow: ellipsis;
            letter-spacing: 0.14px;
            white-space: nowrap;
        }

        /* 交互效果 */
        .list-item:active {
            background-color: rgba(0, 0, 0, 0.03);
        }
    </style>
</head>
<body>

    <div class="dropdown-container">
        <div class="dropdown" id="dropdown">
            <div class="dropdown-border" aria-hidden="true"></div>
            
            <div class="list-item" data-value="item-1">
                <div class="list-item-inner">
                    <div class="list-item-content">
                        <div class="list-item-left">
                            <p class="list-item-text">Item - Normal</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="list-item" data-value="item-2">
                <div class="list-item-inner">
                    <div class="list-item-content">
                        <div class="list-item-left">
                            <p class="list-item-text">Item - Normal</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="list-item" data-value="item-3">
                <div class="list-item-inner">
                    <div class="list-item-content">
                        <div class="list-item-left">
                            <p class="list-item-text">Item - Normal</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="list-item" data-value="item-4">
                <div class="list-item-inner">
                    <div class="list-item-content">
                        <div class="list-item-left">
                            <p class="list-item-text">Item - Normal</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="list-item" data-value="item-5">
                <div class="list-item-inner">
                    <div class="list-item-content">
                        <div class="list-item-left">
                            <p class="list-item-text">Item - Normal</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        // 获取所有列表项
        const listItems = document.querySelectorAll('.list-item');
        
        // 为每个列表项添加点击事件
        listItems.forEach(item => {
            item.addEventListener('click', function() {
                // 移除所有选中状态
                listItems.forEach(i => i.classList.remove('selected'));
                
                // 添加选中状态到当前项
                this.classList.add('selected');
                
                // 获取选中的值和文本
                const value = this.getAttribute('data-value');
                const text = this.querySelector('.list-item-text').textContent;
                
                console.log('选中项:', { value, text });
                
                // 这里可以添加更多的交互逻辑
                // 例如：触发表单提交、更新其他元素等
            });
        });

        // 可选：键盘导航支持
        let currentIndex = -1;

        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, listItems.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                updateSelection();
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                listItems[currentIndex].click();
            }
        });

        function updateSelection() {
            listItems.forEach((item, index) => {
                if (index === currentIndex) {
                    item.classList.add('selected');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('selected');
                }
            });
        }
    </script>

</body>
</html>
```

## 富文本 Markdown 模板

**重要规范**：Markdown所有粗体均使用Medium，font-weight:500

```css
/* ============================================
   1. 标题组件样式 (H1-H6)
   ============================================ */

.markdown-h1 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 20px;
  line-height: 30px;
  letter-spacing: 0.2px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  padding-bottom: 4px;
  padding-top: 12px;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.markdown-h2 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 20px;
  line-height: 30px;
  letter-spacing: 0.2px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  padding-bottom: 4px;
  padding-top: 12px;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.markdown-h3 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 18px;
  line-height: 28px;
  letter-spacing: 0.18px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  padding-top: 4px;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.markdown-h4 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.markdown-h5 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.markdown-h6 {
  font-family: 'Delight';
  font-weight: 500;
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  margin: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

/* ============================================
   2. 段落组件样式
   ============================================ */

.markdown-paragraph {
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
  color: rgba(0, 0, 0, 0.9);
  font-style: normal;
  white-space: pre-wrap;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* ============================================
   3. 列表组件样式
   ============================================ */

/* 有序列表 */
.markdown-ordered-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.markdown-ordered-list-item {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.markdown-list-number {
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
  color: rgba(0, 0, 0, 0.9);
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 无序列表 */
.markdown-unordered-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.markdown-unordered-list-item {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.markdown-bullet {
  width: 24px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.markdown-bullet::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.9);
}

/* ============================================
   4. 代码块样式
   ============================================ */

.markdown-code-block {
  background-color: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 2px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
}

.markdown-code-content {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: 0.12px;
  color: rgba(0, 0, 0, 0.7);
}

/* ============================================
   5. 容器样式
   ============================================ */

.markdown-container {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

/* ============================================
   6. 通用样式
   ============================================ */

.markdown-container * {
  box-sizing: border-box;
}

.markdown-divider * {
  height: 1px;
  background: rgba(0, 0, 0, 0.07);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .markdown-container {
    max-width: 100%;
    padding: 0 16px;
  }

  .markdown-table {
    overflow-x: scroll;
  }
}
```


## 按钮 Button 模板

### 一、组件概览

按钮组件系统包含 **2 种类型** × **4 种尺寸** × **4 种状态** = 32 种组合

- **Primary Button（主按钮）**：用于主要操作（提交、确认、保存）
- **Secondary Button（次按钮）**：用于次要操作（取消、返回、查看）

---

### 二、HTML 类名规范

#### 基础结构
```html
<button class="btn [类型] [尺寸] [状态]">按钮文字</button>
```

#### 类名组合表

| 组合 | 类名 | 示例 |
|-----|------|------|
| 基础类 | `btn` | 必须 |
| 主按钮 | `btn-primary` | `btn btn-primary btn-large` |
| 次按钮 | `btn-secondary` | `btn btn-secondary btn-medium` |
| 大尺寸 | `btn-large` | 48px 高度 |
| 中尺寸 | `btn-medium` | 40px 高度 |
| 小尺寸 | `btn-small` | 32px 高度 |
| 超小尺寸 | `btn-extra-small` | 28px 高度 |
| 禁用状态 | `btn-disabled` | 需同时添加 `disabled` 属性 |
| 加载状态 | `btn-loading` | 显示旋转动画 |

---

### 三、按钮类型详解

#### 1. Primary Button（主按钮）

**HTML 代码：**
```html
<button class="btn btn-primary btn-large">Primary Button</button>
```

**CSS 样式：**
```css
.btn-primary {
  background-color: #49a3a6;
  color: white;
}
```

**设计属性：**
- 背景色：`#49a3a6`（品牌色）
- 文字颜色：`white`
- Hover：叠加 `rgba(0, 0, 0, 0.1)`
- Active：叠加 `rgba(0, 0, 0, 0.2)`
- Disabled：白底 + 灰色文字 + 0.5px 灰色边框

**使用场景：**
- ✅ 表单提交、确认操作、保存更改、购买支付、创建新项目
- ❌ 每个页面只应有 1-2 个主按钮

---

#### 2. Secondary Button（次按钮）

**HTML 代码：**
```html
<button class="btn btn-secondary btn-large">Secondary Button</button>
```

**CSS 样式：**
```css
.btn-secondary {
  background-color: transparent;
  color: rgba(0, 0, 0, 0.9);
  border: 0.5px solid rgba(0, 0, 0, 0.3);
}
```

**设计属性：**
- 背景色：`transparent`
- 文字颜色：`rgba(0, 0, 0, 0.9)`
- 边框：`0.5px solid rgba(0, 0, 0, 0.3)`
- Hover：边框变为 `rgba(0, 0, 0, 0.5)`
- Active：背景变为 `rgba(0, 0, 0, 0.02)`
- Disabled：文字和边框都变为 `rgba(0, 0, 0, 0.2)`

**使用场景：**
- ✅ 取消操作、返回上一步、查看详情、下载文件、次要功能
- ✅ 可以有多个次按钮

---

### 四、按钮尺寸规范

#### Large - 大尺寸（48px）

```html
<button class="btn btn-primary btn-large">Large Button</button>
```

```css
.btn-large {
  height: 48px;
  padding: 11px 20px;
  gap: 8px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
}
```

| 属性 | 值 |
|-----|---|
| 高度 | 48px |
| 横向内边距 | 20px |
| 纵向内边距 | 11px |
| 圆角 | 6px |
| 字号 | 16px |
| 行高 | 26px |
| 字间距 | 0.16px |
| 最小宽度 | 建议 80px |

**适用场景：** 重要的主要操作，页面核心功能

---

#### Medium - 中尺寸（40px）

```html
<button class="btn btn-primary btn-medium">Medium Button</button>
```

```css
.btn-medium {
  height: 40px;
  padding: 9px 20px;
  gap: 8px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 22px;
  letter-spacing: 0.14px;
}
```

| 属性 | 值 |
|-----|---|
| 高度 | 40px |
| 横向内边距 | 20px |
| 纵向内边距 | 9px |
| 圆角 | 6px |
| 字号 | 14px |
| 行高 | 22px |
| 字间距 | 0.14px |
| 最小宽度 | 建议 80px |

**适用场景：** 标准操作，最常用的按钮尺寸

---

#### Small - 小尺寸（32px）

```html
<button class="btn btn-primary btn-small">Small Button</button>
```

```css
.btn-small {
  height: 32px;
  padding: 6px 16px;
  gap: 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.12px;
}
```

| 属性 | 值 |
|-----|---|
| 高度 | 32px |
| 横向内边距 | 16px |
| 纵向内边距 | 6px |
| 圆角 | 4px |
| 字号 | 12px |
| 行高 | 20px |
| 字间距 | 0.12px |
| 最小宽度 | 建议 64px |

**适用场景：** 紧凑界面或次要操作

---

#### Extra Small - 超小尺寸（28px）

```html
<button class="btn btn-primary btn-extra-small">XS Button</button>
```

```css
.btn-extra-small {
  height: 28px;
  padding: 4px 12px;
  gap: 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.12px;
}
```

| 属性 | 值 |
|-----|---|
| 高度 | 28px |
| 横向内边距 | 12px |
| 纵向内边距 | 4px |
| 圆角 | 4px |
| 字号 | 12px |
| 行高 | 20px |
| 字间距 | 0.12px |
| 最小宽度 | 建议 56px |

**适用场景：** 极紧凑界面、工具栏、表格行内操作

---

### 五、按钮状态

#### 1. Default（默认状态）

正常显示状态，无需额外类名。

**Primary Button：**
```html
<button class="btn btn-primary btn-large">Primary Button</button>
```

**Secondary Button：**
```html
<button class="btn btn-secondary btn-large">Secondary Button</button>
```

---

#### 2. Hover（悬停状态）

鼠标悬停时自动触发，无需手动添加类名。

**Primary Button CSS：**
```css
.btn-primary:hover:not(.btn-disabled) {
  background-image: 
    linear-gradient(90deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.1) 100%),
    linear-gradient(90deg, #49a3a6 0%, #49a3a6 100%);
}
```

**Secondary Button CSS：**
```css
.btn-secondary:hover:not(.btn-disabled) {
  border-color: rgba(0, 0, 0, 0.5);
}
```

---

#### 3. Active（激活状态）

按钮被点击时自动触发。

**Primary Button CSS：**
```css
.btn-primary:active:not(.btn-disabled) {
  background-image: 
    linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%),
    linear-gradient(90deg, #49a3a6 0%, #49a3a6 100%);
}
```

**Secondary Button CSS：**
```css
.btn-secondary:active:not(.btn-disabled) {
  border-color: rgba(0, 0, 0, 0.3);
  background-color: rgba(0, 0, 0, 0.02);
}
```

---

#### 4. Disabled（禁用状态）

按钮不可用时的状态。

**HTML：**
```html
<button class="btn btn-primary btn-large btn-disabled" disabled>
  Disabled Button
</button>
```

**Primary Button CSS：**
```css
.btn-primary.btn-disabled {
  background-color: white;
  color: rgba(0, 0, 0, 0.2);
  cursor: not-allowed;
  border: 0.5px solid rgba(0, 0, 0, 0.3);
}
```

**Secondary Button CSS：**
```css
.btn-secondary.btn-disabled {
  color: rgba(0, 0, 0, 0.2);
  border-color: rgba(0, 0, 0, 0.3);
  cursor: not-allowed;
}
```

**注意：**
- 必须同时添加 `btn-disabled` 类和 `disabled` 属性
- 禁用状态下，`:hover` 和 `:active` 不生效

---

#### 5. Loading（加载状态）

显示加载动画。

**HTML：**
```html
<button class="btn btn-primary btn-large btn-loading" disabled>
  加载中...
</button>
```

**CSS：**
```css
.btn-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin-left: -8px;
  margin-top: -8px;
  border: 2px solid currentColor;
  border-radius: 50%;
  border-top-color: transparent;
  animation: btn-spin 0.6s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
```

---

### 六、完整 CSS 代码

#### ```css
/* 基础按钮样式 */
.btn {
  border: none;
  outline: none;
  background: none;
  margin: 0;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Delight Medium', 'Helvetica Neue', Arial, sans-serif;
  font-style: normal;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
  position: relative;
  font-weight: 500;
}

/* 主按钮 */
.btn-primary {
  background-color: #49a3a6;
  color: white;
}

.btn-primary:hover:not(.btn-disabled) {
  background-image: 
    linear-gradient(90deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.1) 100%),
    linear-gradient(90deg, #49a3a6 0%, #49a3a6 100%);
}

.btn-primary:active:not(.btn-disabled) {
  background-image: 
    linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%),
    linear-gradient(90deg, #49a3a6 0%, #49a3a6 100%);
}

.btn-primary.btn-disabled {
  background-color: white;
  color: rgba(0, 0, 0, 0.2);
  cursor: not-allowed;
  border: 0.5px solid rgba(0, 0, 0, 0.3);
}

/* 次按钮 */
.btn-secondary {
  background-color: transparent;
  color: rgba(0, 0, 0, 0.9);
  border: 0.5px solid rgba(0, 0, 0, 0.3);
}

.btn-secondary:hover:not(.btn-disabled) {
  border-color: rgba(0, 0, 0, 0.5);
}

.btn-secondary:active:not(.btn-disabled) {
  border-color: rgba(0, 0, 0, 0.3);
  background-color: rgba(0, 0, 0, 0.02);
}

.btn-secondary.btn-disabled {
  color: rgba(0, 0, 0, 0.2);
  border-color: rgba(0, 0, 0, 0.3);
  cursor: not-allowed;
}

/* 尺寸 - Large */
.btn-large {
  height: 48px;
  padding: 11px 20px;
  gap: 8px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 26px;
  letter-spacing: 0.16px;
}

/* 尺寸 - Medium */
.btn-medium {
  height: 40px;
  padding: 9px 20px;
  gap: 8px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 22px;
  letter-spacing: 0.14px;
}

/* 尺寸 - Small */
.btn-small {
  height: 32px;
  padding: 6px 16px;
  gap: 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.12px;
}

/* 尺寸 - Extra Small */
.btn-extra-small {
  height: 28px;
  padding: 4px 12px;
  gap: 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.12px;
}

/* 禁用状态 */
.btn-disabled {
  cursor: not-allowed;
  pointer-events: none;
}

/* 加载状态 */
.btn-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin-left: -8px;
  margin-top: -8px;
  border: 2px solid white;
  border-radius: 50%;
  border-top-color: transparent;
  animation: btn-spin 0.6s linear infinite;
}

.btn-secondary.btn-loading::after {
  border-color: rgba(0, 0, 0, 0.9);
  border-top-color: transparent;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

/* 焦点状态 */
.btn:focus-visible {
  outline: 2px solid #49a3a6;
  outline-offset: 2px;
}
```

---