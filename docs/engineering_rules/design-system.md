# Design System — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** Frontend UI (`client/`)  
> **Stack:** Tailwind CSS 3 + custom component classes  
> **Liên quan:** [`frontend-convention.md`](./frontend-convention.md) · [`fe-master-context.md`](./fe-master-context.md)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Design Tokens](#2-design-tokens)
3. [Typography](#3-typography)
4. [Color System](#4-color-system)
5. [Spacing & Layout](#5-spacing--layout)
6. [Component Classes](#6-component-classes)
7. [UI Components Catalog](#7-ui-components-catalog)
8. [Patterns theo vùng UI](#8-patterns-theo-vùng-ui)
9. [Icons](#9-icons)
10. [Responsive Design](#10-responsive-design)
11. [Rich Content (Product Description)](#11-rich-content-product-description)
12. [Admin UI Patterns](#12-admin-ui-patterns)
13. [Trạng thái hiện tại vs Khuyến nghị](#13-trạng-thái-hiện-tại-vs-khuyến-nghị)

---

## 1. Tổng quan

LaptopStore frontend dùng **Tailwind CSS utility-first** với một lớp **component classes** định nghĩa trong `client/src/index.css`. Không dùng component library (shadcn, MUI, Ant Design).

| Aspect | Choice |
|--------|--------|
| CSS framework | Tailwind CSS 3.4 |
| Plugins | typography, forms, line-clamp |
| Fonts | Inter (body), Poppins (display) |
| Icons | lucide-react (primary) |
| Locale | Vietnamese UI copy |
| Currency | VND (`vi-VN`) |

### Kiến trúc styling

```
tailwind.config.js     → Design tokens (colors, fonts, container)
src/index.css          → @layer base + @layer components
Component JSX          → Tailwind utility classes (inline)
utils/cn.js            → clsx + tailwind-merge (defined, chưa dùng)
```

---

## 2. Design Tokens

**File:** `client/tailwind.config.js`

### 2.1. Colors

```javascript
colors: {
  primary: {
    50: "#eff6ff",  100: "#dbeafe",  200: "#bfdbfe",
    300: "#93c5fd",  400: "#60a5fa",  500: "#3b82f6",
    600: "#2563eb",  700: "#1d4ed8",  800: "#1e40af",
    900: "#1e3a8a",
  },
  accent: {
    50: "#fff7ed",  100: "#ffedd5",  200: "#fed7aa",
    300: "#fdba74",  400: "#fb923c",  500: "#f97316",
    600: "#ea580c",  700: "#c2410c",  800: "#9a3412",
    900: "#7c2d12",
  },
}
```

### 2.2. Semantic color mapping (khuyến nghị)

| Token | Tailwind class | Usage |
|-------|----------------|-------|
| Primary action | `primary-600` / `blue-600`* | Buttons, links, focus ring |
| Primary hover | `primary-700` / `blue-700`* | Button hover |
| Accent / CTA | `accent-500` / `orange-500`* | Promotions, highlights |
| Background | `gray-50` | Page background |
| Surface | `white` | Cards, modals |
| Text primary | `gray-900` | Headings, body |
| Text secondary | `gray-500`, `gray-600` | Captions, meta |
| Border | `gray-200`, `gray-300` | Cards, inputs |
| Success | `green-100`/`green-800` | Badges, alerts |
| Warning | `yellow-100`/`yellow-800` | Badges |
| Error | `red-100`/`red-800` | Badges, validation |
| Info | `blue-100`/`blue-800` | Badges |

`*` **Thực tế JSX dùng `blue-*` trực tiếp**, không dùng `primary-*` token.

### 2.3. Container

```javascript
container: {
  center: true,
  padding: { DEFAULT: "1rem", lg: "2rem" },
  screens: { "2xl": "1280px" },
}
```

Usage: `<div className="container mx-auto px-4">`.

---

## 3. Typography

### 3.1. Font families

| Token | Font | Usage |
|-------|------|-------|
| `font-sans` | Inter, system-ui | Body text, UI |
| `font-display` | Poppins, system-ui | Headings (defined, ít dùng explicit) |

**Import:** Google Fonts trong `src/index.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap");
```

### 3.2. Type scale (conventions in JSX)

| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-2xl font-bold text-gray-900` | HomePage heading |
| Section title | `text-xl font-semibold` | Filter sections |
| Card title | `text-lg font-medium` | ProductCard name |
| Body | `text-base text-gray-700` | Descriptions |
| Caption | `text-sm text-gray-500` | Meta info, dates |
| Price | `text-lg font-bold text-blue-600` | ProductCard price |
| Price original | `text-sm text-gray-400 line-through` | Discount display |

### 3.3. Typography plugin

`@tailwindcss/typography` enabled — dùng cho rich HTML product descriptions:

```html
<div className="prose prose-sm max-w-none product-desc">
  {/* dangerouslySetInnerHTML product description */}
</div>
```

---

## 4. Color System

### 4.1. Brand palette

```
Primary Blue:  #2563eb (blue-600) — main actions, links, prices
Accent Orange: #f97316 (orange-500) — discounts, promotions (defined, underused)
Neutral Gray:  gray-50 → gray-900 scale
```

### 4.2. Status colors (orders)

| Status | Badge classes |
|--------|---------------|
| Processing | `bg-blue-100 text-blue-800` |
| Shipping | `bg-yellow-100 text-yellow-800` |
| Delivered | `bg-green-100 text-green-800` |
| Cancelled | `bg-red-100 text-red-800` |
| Awaiting payment | `bg-orange-100 text-orange-800` |

### 4.3. Interactive states

| State | Pattern |
|-------|---------|
| Hover (button) | `hover:bg-blue-700` |
| Focus (input) | `focus:ring-2 focus:ring-blue-500 focus:outline-none` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Active nav | `text-blue-600 font-medium` |

---

## 5. Spacing & Layout

### 5.1. Spacing scale (Tailwind defaults)

| Context | Classes |
|---------|---------|
| Page padding | `px-4`, `py-6`, `py-8` |
| Section gap | `space-y-6`, `gap-6` |
| Card padding | `p-4`, `p-6` |
| Grid gap | `gap-4`, `gap-6` |
| Form field gap | `space-y-4` |

### 5.2. Layout patterns

| Pattern | Classes |
|---------|---------|
| Max content width | `max-w-7xl mx-auto` |
| Auth card width | `max-w-md w-full` |
| Checkout width | `max-w-4xl mx-auto` |
| Admin content | `flex-1 p-6` (inside AdminRoute sidebar layout) |
| Product grid | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` |
| Filter sidebar | `w-64 shrink-0` + main content `flex-1` |

### 5.3. Border radius

| Element | Class |
|---------|-------|
| Buttons, inputs | `rounded-lg` |
| Cards | `rounded-xl` |
| Badges | `rounded-full` |
| Modals | `rounded-2xl` |
| Product images | `rounded-lg` |

### 5.4. Shadows

| Element | Class |
|---------|-------|
| Card default | `shadow-sm` |
| Card hover | `hover:shadow-md` |
| Auth card | `shadow-sm` |
| Modal/dropdown | `shadow-lg` |

---

## 6. Component Classes

**File:** `client/src/index.css` — `@layer components`

### 6.1. Buttons

```css
.btn-primary   → bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700
.btn-secondary → bg-white text-primary-600 border-2 border-primary-600 hover:bg-primary-50
.btn-accent    → bg-accent-500 text-white hover:bg-accent-600
```

### 6.2. Form inputs

```css
.input-field → w-full px-4 py-3 border border-gray-300 rounded-lg
               focus:ring-2 focus:ring-primary-500 focus:border-transparent
```

### 6.3. Cards & badges

```css
.card           → bg-white rounded-xl shadow-sm border hover:shadow-md
.badge          → inline-flex px-3 py-1 rounded-full text-sm font-medium
.badge-success  → bg-green-100 text-green-800
.badge-warning  → bg-yellow-100 text-yellow-800
.badge-error    → bg-red-100 text-red-800
.badge-info     → bg-blue-100 text-blue-800
```

### 6.4. Trạng thái sử dụng

> **Quan trọng:** Các class trên **đã định nghĩa nhưng hầu như không được dùng** trong JSX. Code thực tế dùng inline Tailwind utilities. Khuyến nghị migrate dần sang dùng component classes để nhất quán.

**Inline pattern thực tế (buttons):**

```jsx
<button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
  Đặt hàng
</button>
```

**Inline pattern thực tế (inputs):**

```jsx
<input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
```

---

## 7. UI Components Catalog

### 7.1. Layout & Navigation

| Component | File | Mô tả |
|-----------|------|-------|
| `Layout` | `components/Layout.jsx` | Public shell: Header + Outlet + Footer |
| `Header` | `components/Header.jsx` | Nav, search, cart badge, auth menu |
| `Footer` | `components/Footer.jsx` | 4-column footer, social links |
| `AdminRoute` | `components/AdminRoute.jsx` | Admin sidebar layout (embedded) |

### 7.2. Product

| Component | File | Mô tả |
|-----------|------|-------|
| `ProductCard` | `components/ProductCard.jsx` | Grid card: image, specs, price, discount badge |
| `ProductFilter` | `components/ProductFilter.jsx` | Sidebar filter panel |
| `ProductRecommendations` | `components/ProductRecommendations.jsx` | KNN carousel |
| `SpecsTable` | `components/SpecsTable.jsx` | Spec comparison table |
| `SpecsModal` | `components/SpecsModal.jsx` | Full specs modal |
| `CompareBar` | `components/CompareBar.jsx` | Floating compare bar (max 3) |
| `CompareModal` | `components/CompareModal.jsx` | Side-by-side compare |

### 7.3. Commerce

| Component | File | Mô tả |
|-----------|------|-------|
| `PaymentOptions` | `components/PaymentOptions.jsx` | COD / VNPay radio selection |
| `MapPicker` | `components/MapPicker.jsx` | Leaflet map for geo confirm |
| `EditShippingAddressDialog` | `components/EditShippingAddressDialog.jsx` | Modal edit address |
| `ChangePaymentMethodDialog` | `components/ChangePaymentMethodDialog.jsx` | Modal change payment |

### 7.4. Utility

| Component | File | Mô tả |
|-----------|------|-------|
| `LoadingSpinner` | `components/LoadingSpinner.jsx` | `sm`/`md`/`lg` blue spinner |
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | Auth gate |
| `AdminRoute` | `components/AdminRoute.jsx` | Admin role gate + sidebar |

---

## 8. Patterns theo vùng UI

### 8.1. Auth pages (Login, Register)

```jsx
<div className="min-h-screen flex items-center justify-center bg-gray-50">
  <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
    <h1 className="text-2xl font-bold text-center mb-6">Đăng nhập</h1>
    {/* form fields */}
    <button className="w-full bg-blue-600 text-white py-3 rounded-lg ...">
      Đăng nhập
    </button>
  </div>
</div>
```

### 8.2. Product card

```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
  <img className="w-full h-48 object-cover" />
  <div className="p-4">
    <h3 className="font-medium text-gray-900 line-clamp-2">{name}</h3>
    <p className="text-sm text-gray-500">{specs}</p>
    <div className="flex items-center gap-2 mt-2">
      <span className="text-lg font-bold text-blue-600">{price}</span>
      {discount && <span className="text-sm line-through text-gray-400">{original}</span>}
    </div>
  </div>
</div>
```

### 8.3. Error / alert banner

```jsx
<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
  {errorMessage}
</div>
```

### 8.4. Empty state

```jsx
<div className="text-center py-12 text-gray-500">
  <p>Giỏ hàng trống</p>
  <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
    Tiếp tục mua sắm
  </Link>
</div>
```

### 8.5. Loading state

```jsx
<LoadingSpinner size="md" />
// or inline:
<div className="flex justify-center py-8">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
</div>
```

---

## 9. Icons

### 9.1. Primary: lucide-react

```jsx
import { ShoppingCart, User, Search, Menu, X, ChevronDown } from "lucide-react"

<ShoppingCart className="w-5 h-5" />
```

**Sizing convention:**

| Context | Size class |
|---------|------------|
| Inline with text | `w-4 h-4` |
| Button icon | `w-5 h-5` |
| Nav/header | `w-5 h-5` to `w-6 h-6` |
| Empty state | `w-12 h-12 text-gray-300` |

### 9.2. OAuth: react-icons

```jsx
import { FcGoogle } from "react-icons/fc"
import { FaFacebookSquare } from "react-icons/fa"
// LoginPage.jsx, RegisterPage.jsx only
```

### 9.3. Admin sidebar inconsistency

Admin sidebar dùng **emoji** (🏠, 📊, 📦) thay vì lucide — nên migrate sang lucide cho nhất quán.

---

## 10. Responsive Design

### 10.1. Breakpoints (Tailwind defaults)

| Breakpoint | Min width | Usage |
|------------|-----------|-------|
| `sm` | 640px | 2-col product grid |
| `md` | 768px | Show desktop nav |
| `lg` | 1024px | 3-col grid, filter sidebar |
| `xl` | 1280px | 4-col product grid |
| `2xl` | 1536px | Container max |

### 10.2. Mobile patterns

| Feature | Mobile | Desktop |
|---------|--------|---------|
| Navigation | Hamburger menu (`Menu`/`X` icons) | Full nav bar |
| Product filter | Collapsible / drawer | Fixed sidebar |
| Compare bar | Bottom fixed bar | Bottom fixed bar |
| Admin sidebar | Collapsible | Fixed left sidebar |
| Checkout map | Full width | Split layout |

---

## 11. Rich Content (Product Description)

Admin nhập mô tả bằng **react-quill** (HTML output). Storefront render bằng `dangerouslySetInnerHTML` với class `product-desc`.

**Custom styles** (`src/index.css`):

```css
.product-desc img       → full width, rounded, object-fit cover
.product-desc figure    → margin spacing
.product-desc figcaption → gray-500, centered, small
.product-desc details summary → collapsible sections, gray-100 bg
```

**Typography plugin:** Wrap trong `prose prose-sm max-w-none product-desc`.

---

## 12. Admin UI Patterns

### 12.1. Admin layout (AdminRoute)

```
┌──────────┬─────────────────────────────┐
│ Sidebar  │  Main content area          │
│ (fixed)  │  p-6                        │
│ w-64     │                             │
│          │  Page title + actions       │
│ Nav links│  Table / Form / Charts      │
│          │                             │
└──────────┴─────────────────────────────┘
```

### 12.2. Admin table

```jsx
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">...</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      <tr className="hover:bg-gray-50">...</tr>
    </tbody>
  </table>
</div>
```

### 12.3. Admin form input constant

```javascript
// AdminProductNewPage.jsx
const defaultInputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
```

### 12.4. Charts (Recharts)

`AdminDashboard.jsx` — line/bar charts cho revenue, orders. Colors: `#2563eb` (blue), `#f97316` (orange).

---

## 13. Trạng thái hiện tại vs Khuyến nghị

### 13.1. Technical debt

| Issue | Current | Recommended |
|-------|---------|-------------|
| Color tokens | JSX uses `blue-600` | Migrate to `primary-600` |
| Component classes | Defined but unused | Use `.btn-primary`, `.input-field`, `.card` |
| `cn()` utility | Zero imports | Use for conditional classes |
| `@/` alias | Configured, unused | Migrate imports to `@/components/...` |
| Admin icons | Emoji | lucide-react |
| `"use client"` directive | Present in some files | Remove (Vite, not Next.js) |
| Form library | None | Consider react-hook-form + zod |
| Dark mode | `uiSlice.theme` defined | Not implemented |

### 13.2. Migration checklist

- [ ] Replace all `blue-*` with `primary-*` in JSX
- [ ] Use `.btn-primary`, `.input-field`, `.card` component classes
- [ ] Adopt `cn()` for conditional styling
- [ ] Standardize admin sidebar icons (lucide)
- [ ] Extract repeated input class to shared constant/component
- [ ] Create `<Button variant="primary|secondary|accent">` component
- [ ] Create `<Input>`, `<Badge>`, `<Card>` wrapper components
- [ ] Remove `"use client"` directives

---

## Phụ lục — Formatting utilities

**File:** `client/app/utils/formatters.js`

```javascript
formatPrice(15000000)   → "15.000.000 ₫"
formatDate(date)        → "26 tháng 5, 2026"
formatDateTime(date)    → "26 tháng 5, 2026, 14:30"
```

Locale: `vi-VN` — dùng xuyên suốt storefront và admin.

---

*Phản ánh design patterns thực tế trong `client/` và hướng dẫn chuẩn hóa UI.*
