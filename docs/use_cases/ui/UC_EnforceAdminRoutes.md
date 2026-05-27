# Use Case — UC-UI-03: Bảo vệ route Admin (Enforce Admin Routes)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | UC-UI-03 |
| **Tên** | `AdminRoute` — chỉ user có role `admin` vào portal quản trị |
| **Mức độ ưu tiên** | Cao |
| **Phiên bản** | Bám code hiện tại |
| **Liên quan UC** | UC-UI-01, UC-UI-02, UC-SYS-02, UC-ADM-01 |

---

## 1. Mô tả ngắn

Mọi route **`/admin/*`** trong `App.jsx` bọc **`AdminRoute`**, thực hiện:

1. Chưa đăng nhập → **`/login`**
2. Đã login nhưng **không** có `user.roles.includes("admin")` → **`/`** (trang chủ)
3. Admin hợp lệ → render **`AdminLayout`** (sidebar) + page con

**Khác** `ProtectedRoute`: **không** fallback `localStorage.token` — chỉ tin `isAuthenticated` Redux.

**Khác** BE: API `/api/admin` cho cả `manager` — FE **chỉ** `admin` (UC-SYS-02 paradox).

**Lưu ý layout:** Admin routes vẫn nằm trong parent **`Layout`** → vẫn có **Header + Footer storefront** phía trên/ngoài sidebar admin (GAP UX).

---

## 2. Tác nhân

| Tác nhân | Vai trò |
|----------|---------|
| **Administrator** | Truy cập portal |
| **Customer / Manager** | Bị đá về `/` hoặc login |
| **AdminRoute** | Guard + shell |
| **AdminLayout** | Sidebar navigation |

---

## 3. Preconditions

| # | Điều kiện |
|---|-----------|
| PRE-01 | UC-UI-01 đã restore (hoặc vừa login) với `user.roles` chứa `"admin"` |
| PRE-02 | Navigate tới path `/admin` hoặc con |

---

## 4. Postconditions

| # | Kết quả |
|---|---------|
| POST-01 | Admin → sidebar + nội dung page (Dashboard, Products, …) |
| POST-E01 | Guest → `/login` |
| POST-E02 | Customer logged-in → `/` |
| POST-E03 | Manager logged-in → `/` (API admin vẫn 200 nếu gọi tay) |

---

## 5. Trigger

Navigate tới bất kỳ admin path:

| Path | Component |
|------|-----------|
| `/admin` | `AdminDashboard` (hub) |
| `/admin/analytics` | `AdminDashboard` (analytics view) |
| `/admin/products` | `AdminProducts` |
| `/admin/products/new` | `AdminProductNewPage` |
| `/admin/products/edit/:id` | `AdminProductEditPage` |
| `/admin/orders` | `AdminOrders` list |
| `/admin/orders/:orderId` | `AdminOrders` detail |
| `/admin/users` | `AdminUsers` |
| `/admin/categories` | `AdminCategories` |
| `/admin/brands` | `AdminBrands` |
| `/admin/questions` | `AdminQuestions` |
| `/admin/questions/:question_id` | `AdminQuestionDetail` |

---

## 6. Guard logic

```javascript
export default function AdminRoute({ children }) {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.roles?.includes("admin");

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    dispatch(logout());
  };

  return <AdminLayout onLogout={handleLogout}>{children}</AdminLayout>;
}
```

```mermaid
flowchart TD
  A[Request /admin/*] --> B{isAuthenticated?}
  B -->|No| L[/login]
  B -->|Yes| C{roles includes admin?}
  C -->|No| H[/]
  C -->|Yes| D[AdminLayout + children]
```

---

## 7. AdminLayout — sidebar

| Menu | Path | Icon |
|------|------|------|
| Dashboard | `/admin` | 🏠 |
| Analytics | `/admin/analytics` | 📊 |
| Sản phẩm | `/admin/products` | 📦 |
| Đơn hàng | `/admin/orders` | 🛒 |
| Người dùng | `/admin/users` | 👥 |
| Danh mục | `/admin/categories` | 📁 |
| Thương hiệu | `/admin/brands` | 🏷️ |
| Q&A | `/admin/questions` | 💬 |

### Navigation implementation

- Dùng thẻ **`<a href={path}>`** — **full page reload** khi click (không `Link` React Router).
- `isActive(path)`: exact `/admin` hoặc `pathname.startsWith(path)`.

### Logout sidebar

`dispatch(logout())` — **không** `navigate` — user có thể vẫn ở URL admin until reload (GAP).

---

## 8. Entry từ storefront — Header

```jsx
{user?.roles?.includes("admin") && (
  <Link to="/admin">Admin</Link>
)}
```

Chỉ hiện khi `isAuthenticated` và role admin trong **Redux user** (từ storage restore).

---

## 9. Trùng layout với `AdminDashboard.jsx`

File `AdminDashboard.jsx` định nghĩa **một `AdminLayout` khác** (Lucide icons, mobile drawer) — **không** dùng khi route qua `AdminRoute`.

| Layout | Dùng khi |
|--------|----------|
| `AdminRoute.jsx` → `AdminLayout` | **Tất cả** `/admin/*` trong App |
| `AdminDashboard.jsx` internal | **Dead code** cho shell (chỉ nội dung hub/analytics render) |

---

## 10. Cấu trúc DOM thực tế

```
Layout (storefront)
├── Header (search, cart, Admin link)
├── main
│   └── AdminRoute
│       ├── AdminLayout sidebar
│       └── Admin page content
└── Footer
```

User thấy **cả** header laptop store **và** admin sidebar — chiếm chiều cao dọc.

---

## 11. So sánh lớp bảo vệ

| Layer | Admin check |
|-------|-------------|
| **AdminRoute** | `roles.includes("admin")` |
| **Header link** | Cùng điều kiện |
| **BE authorizeRoles** | `admin` **or** `manager` |
| **ProtectedRoute** | Không áp dụng admin paths |

---

## 12. Luồng thay thế

### ALT-01 — Manager user

Login manager → Header **không** có Admin → gõ `/admin` → redirect `/`.

### ALT-02 — Admin bị khóa sau khi vào trang

`is_active: false` → API 401 → interceptor logout — AdminRoute lần sau → login.

### ALT-03 — `AdminDashboard` tại `/admin/analytics`

Cùng component, `location.pathname === "/admin/analytics"` → render `AdminAnalyticsDashboard` bên trong (không đổi guard).

---

## 13. Ánh xạ mã nguồn

| Thành phần | Đường dẫn |
|------------|-----------|
| Guard + sidebar | `client/app/components/AdminRoute.jsx` |
| Routes | `client/app/App.jsx` L124–230 |
| Header link | `client/app/components/Header.jsx` |
| Pages | `client/app/pages/admin/*.jsx` |
| Duplicate layout (unused shell) | `AdminDashboard.jsx` L12–144 |

---

## 14. Known gaps

| # | Gap |
|---|-----|
| GAP-01 | **Double chrome** — Layout Header/Footer + Admin sidebar |
| GAP-02 | Sidebar `<a href>` full reload |
| GAP-03 | **Không** `hasToken` fallback (khác ProtectedRoute) |
| GAP-04 | **Manager** BE vs FE admin-only |
| GAP-05 | Logout sidebar không redirect |
| GAP-06 | Không `returnUrl` khi kick to `/` |
| GAP-07 | `AdminDashboard` duplicate AdminLayout dead code |
| GAP-08 | Không verify `/auth/me` refresh roles on enter |

---

## 15. Tiêu chí chấp nhận

- [ ] Guest `/admin` → `/login`
- [ ] Customer login → `/admin` → `/`
- [ ] Admin login → `/admin` → dashboard + sidebar
- [ ] Header chỉ admin thấy link Admin
- [ ] `/admin/orders/123` admin → order detail trong admin shell
- [ ] Manager API curl OK nhưng FE `/admin` → `/`
