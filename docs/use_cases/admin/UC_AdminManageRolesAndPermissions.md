# Use Case — UC-ADM-07: Quản trị vai trò & quyền (Admin Manage Roles And Permissions)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | UC-ADM-07 |
| **Tên** | API CRUD role, gán role cho user; mô hình Permission trong DB (chưa enforce) |
| **Mức độ ưu tiên** | Trung bình (API sẵn, **không có màn hình admin**) |
| **Phiên bản** | Bám code hiện tại |
| **Liên quan FR** | `FR_AdminListRoles.md`, `FR_AdminCreateRole.md`, `FR_AdminUpdateRole.md`, `FR_AdminDeleteRole.md`, `FR_AdminUpdateUserRoles.md` |
| **Liên quan UC** | UC-ADM-01, UC-ADM-06, UC-AUTH-* |

---

## 1. Mô tả ngắn

Hệ thống RBAC **2 tầng thực tế**:

| Tầng | Trạng thái |
|------|------------|
| **Role** (`admin`, `manager`, `customer`, …) | **Đang dùng** — `authorizeRoles` trên `/api/admin` |
| **Permission** (`permissions`, `role_permissions`) | **Có model + quan hệ**, **không** có API admin, **không** check trong middleware |

Admin (hoặc script) quản lý role qua REST; gán role user qua **`PUT /users/:id/roles`**.  
**Không có** trang React `/admin/roles`.

Phân quyền portal: FE `AdminRoute` chỉ `roles.includes("admin")`; BE `authorizeRoles("admin", "manager")`.

---

## 2. Tác nhân

| Tác nhân | Vai trò |
|----------|---------|
| **Administrator / DevOps** | Gọi API (Postman, curl, seed) |
| **adminController** | Role CRUD + `updateUserRoles` |
| **authorizeRoles** | Kiểm tra `role_name` string |
| **Seeder** | `seedAdmin.js` tạo role `admin` |

---

## 3. Mô hình dữ liệu

### Bảng `roles`

| Cột | Mô tả |
|-----|--------|
| `role_id` | PK |
| `role_name` | Unique, ví dụ `admin`, `customer`, `manager` |
| `description` | Text |

### Bảng `permissions`

| Cột | Mô tả |
|-----|--------|
| `permission_id` | PK |
| `permission_name` | Unique string |
| `description` | Text |

### `user_roles` (M:N User ↔ Role)

### `role_permissions` (M:N Role ↔ Permission)

Định nghĩa trong `server/models/index.js`:

```javascript
User.belongsToMany(Role, { through: "user_roles", foreignKey: "user_id" })
Role.belongsToMany(Permission, { through: "role_permissions", foreignKey: "role_id" })
```

**Không** có controller CRUD permission.

---

## 4. API Role — đầy đủ

Tất cả dưới prefix `/api/admin`, JWT + role admin/manager.

### GET `/roles`

```json
{
  "roles": [
    {
      "role_id": 1,
      "role_name": "admin",
      "description": "...",
      "Users": [ /* optional include */ ]
    }
  ]
}
```

`Role.findAll({ include: [User] })` — có thể payload nặng.

### POST `/roles`

```json
{ "role_name": "staff", "description": "Nhân viên kho" }
```

→ `201` `{ message, role }`.

### PUT `/roles/:role_id`

Body: partial `role_name`, `description` → `role.update(req.body)`.

### DELETE `/roles/:role_id`

- Nếu `role.countUsers() > 0` → **400** `Cannot delete role with assigned users`.
- Ngược lại → `destroy`.

### PUT `/users/:user_id/roles`

```json
{ "role_ids": [1, 3] }
```

Logic:

```javascript
const roles = await Role.findAll({ where: { role_id: role_ids } })
await user.setRoles(roles)  // thay thế toàn bộ roles cũ
```

Response:

```json
{
  "message": "User roles updated successfully",
  "user": {
    "user_id": 5,
    "username": "john",
    "roles": [{ "role_id": 1, "role_name": "customer" }]
  }
}
```

**Lưu ý:** `role_ids` thiếu hoặc rỗng → user **mất hết role** (setRoles []).

---

## 5. Luồng authorize thực tế (runtime)

```mermaid
flowchart LR
  JWT[JWT userId] --> LoadUser[Load User + Roles]
  LoadUser --> AdminRoute{FE: admin?}
  LoadUser --> Authorize{BE: admin or manager?}
  AdminRoute -->|yes| Portal[/admin UI]
  Authorize -->|yes| AdminAPI[/api/admin/*]
  PermissionTable[(permissions)] -.->|not used| X[—]
```

`authorizeRoles`:

```javascript
const userRoles = req.user.Roles.map((role) => role.role_name)
const hasRole = roles.some((role) => userRoles.includes(role))
```

**Không** đọc `Permission`.

---

## 6. Role mặc định trong đồ án

| Role | Nguồn | Dùng cho |
|------|-------|----------|
| `admin` | `seedAdmin.js` | Full admin API + FE portal |
| `customer` | `authController` register | Storefront |
| `manager` | (seed/manual) | Admin API BE only — **FE chặn** |

Đăng ký mới luôn gán **`customer`**.

---

## 7. UI hiện có (chỉ đọc role)

`AdminUsers.jsx` hiển thị `user.Roles.map(r => r.role_name)` — **không** chỉnh sửa.

Login response / Redux:

```javascript
user: { ..., roles: ["admin", "customer"] }
```

`AdminRoute` chỉ check `"admin"`.

---

## 8. Client API — lệch route

| Khai báo `adminAPI` | Route thật |
|---------------------|------------|
| `PUT /admin/users/:id/role` | `PUT /admin/users/:id/roles` |
| (không có helpers roles) | `GET/POST/PUT/DELETE /admin/roles` |

Không có hook React Query cho roles.

---

## 9. Luồng thay thế — vận hành qua API

### Gán manager cho user (curl)

```bash
curl -X PUT "$API/admin/users/5/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_ids":[2,3]}'
```

### Tạo role mới

```bash
curl -X POST "$API/admin/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role_name":"warehouse","description":"Kho"}'
```

User với role `warehouse` **không** vào được `/api/admin` trừ khi thêm `"warehouse"` vào `authorizeRoles(...)`.

---

## 10. Ánh xạ mã nguồn

| Thành phần | Đường dẫn |
|------------|-----------|
| Routes | `server/routes/adminRoutes.js` L46–50 |
| Controller | `server/controllers/adminController.js` L847–947 |
| Models | `server/models/Role.js`, `Permission.js`, `index.js` |
| Middleware | `server/middleware/auth.js` |
| Seed admin role | `server/seedAdmin.js` |
| FE guard | `client/app/components/AdminRoute.jsx` |

---

## 11. Known gaps

| # | Gap |
|---|-----|
| GAP-01 | **Không UI** quản lý role/permission |
| GAP-02 | **Permission model không dùng** — không API, không middleware |
| GAP-03 | `GET /roles` include Users — có thể leak / chậm |
| GAP-04 | `updateUserRoles` không validate `role_ids` bắt buộc non-empty |
| GAP-05 | FE/BE mismatch `admin` vs `manager` |
| GAP-06 | `adminAPI.updateUserRole` path sai |
| GAP-07 | Không gán permission granular (products.read, orders.ship, …) |
| GAP-08 | Xóa role `admin` nếu không còn user — có thể vô tình (nếu countUsers=0) |

---

## 12. Tiêu chí chấp nhận

- [ ] GET `/admin/roles` → danh sách roles
- [ ] POST role mới → 201
- [ ] DELETE role đang gán user → 400
- [ ] PUT user roles → login lại thấy roles mới trong JWT payload user object (sau login)
- [ ] User chỉ `customer` → `/api/admin` → 403
- [ ] Permission tables tồn tại DB nhưng không ảnh hưởng authorize
