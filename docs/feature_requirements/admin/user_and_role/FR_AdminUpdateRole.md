# Functional Requirement (FR) — Admin: Cập nhật vai trò (Admin Update Role)

## 1. Feature Overview

Admin/Manager cập nhật metadata của role (`role_name`, `description`, …) qua **mass assignment** từ `req.body`.

```
PUT /api/admin/roles/:role_id
Authorization: Bearer JWT
Body: JSON fields to update
```

**FE:** Không có UI.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Admin / Manager** | Caller |
| **updateRole** | Controller |

---

## 3. Scope

### In Scope

- `findByPk(role_id)` → `role.update(req.body)`.

### Out of Scope

- Đổi users gán role (dùng `updateUserRoles`).
- Sửa permissions.
- Chặn đổi tên role hệ thống `admin`.

---

## 4. API Contract

### Request

```http
PUT /api/admin/roles/3
Content-Type: application/json

{
  "role_name": "manager",
  "description": "Quản lý cửa hàng — cập nhật mô tả"
}
```

### Response — 200

```json
{
  "message": "Role updated successfully",
  "role": {
    "role_id": 3,
    "role_name": "manager",
    "description": "Quản lý cửa hàng — cập nhật mô tả",
    ...
  }
}
```

### Errors

| HTTP | Message |
|------|---------|
| 404 | `Role not found` |
| 409 | Unique `role_name` conflict |

---

## 5. Backend Logic

```javascript
const role = await Role.findByPk(role_id);
if (!role) return res.status(404).json({ message: "Role not found" });
await role.update(req.body);
res.json({ message: "Role updated successfully", role });
```

| # | Business rule |
|---|----------------|
| BR-01 | **Toàn bộ** `req.body` có thể ghi — chỉ nên gửi `role_name`, `description` |
| BR-02 | Đổi `role_name` của role đang gán user → JWT/`localStorage roles` user cũ **không** tự đổi đến khi login lại |
| BR-03 | Đổi `admin` → tên khác có thể **phá** `authorizeRoles` / FE checks |

---

## 6. Rủi ro đổi tên role

| Check trong code | Phụ thuộc `role_name` |
|------------------|------------------------|
| `authorizeRoles("admin", "manager")` | Literal strings |
| `AdminRoute` | `"admin"` |
| `productController.createAnswer` | `admin`, `staff` |
| `useLogin` → `localStorage roles` | Array tên lúc login |

Đổi tên role trong DB **không** sync các literal trên.

---

## 7. Related FRs

| FR | Liên kết |
|----|----------|
| `FR_AdminCreateRole` | Tạo |
| `FR_AdminDeleteRole` | Xóa |
| `FR_AdminListRoles` | List |

---

## 8. Source Files

| File | Vai trò |
|------|---------|
| `server/controllers/adminController.js` | `updateRole` L880–898 |
| `server/routes/adminRoutes.js` | `PUT /roles/:role_id` |

---

## 9. Acceptance Criteria

- [ ] PUT hợp lệ → 200, DB cập nhật.
- [ ] 404 `role_id` sai.
- [ ] Trùng `role_name` → lỗi unique.

---

## 10. Known Gaps

| # | Mô tả |
|---|--------|
| GAP-01 | Mass assignment không whitelist |
| GAP-02 | Không bảo vệ role hệ thống |
| GAP-03 | Không FE |
