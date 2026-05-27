# Functional Requirement (FR) — Lấy thông tin user hiện tại (Get Current User)

## 1. Feature Overview

API **`GET /api/auth/me`** trả về hồ sơ user đang đăng nhập, xác định bằng **JWT Bearer** trong header `Authorization`. Middleware `authenticateToken` verify JWT, load `User` + `Role` từ DB, kiểm tra `is_active`, gán `req.user`.

Đây là nguồn “truth” cho dữ liệu user đầy đủ sau khi F5 hoặc sau OAuth (token chỉ chứa `userId`). Frontend dùng trực tiếp `authAPI.getCurrentUser()` / `api.get("/auth/me")` và các hook `useMe`, `useCurrentUser`.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Authenticated User** | Có JWT hợp lệ (`userId` trong payload) |
| **Frontend** | `OAuthSuccess`, hooks, các màn có thể refetch profile |
| **Backend** | `authenticateToken`, `authController.getCurrentUser` |

---

## 3. Scope

### In Scope

- `GET /api/auth/me` — header `Authorization: Bearer <jwt>`.
- JWT session: `{ userId }`, `expiresIn: "7d"` (generate trong login, register, OAuth).
- Exclude `password_hash` khỏi JSON.
- Include danh sách role dạng mảng string `roles`.

### Out of Scope

- Cập nhật profile → `PUT /api/auth/profile` (`FR_UpdateProfile.md`).
- Refresh token / rotate JWT.
- Pagination hoặc field selection query.

---

## 4. Preconditions

- Request có header Bearer token.
- Token ký đúng `JWT_SECRET`.
- User tồn tại và `is_active === true` (middleware).
- Associations `User — Role` (many-to-many) hoạt động trong Sequelize.

---

## 5. Authentication & Middleware

File: `server/middleware/auth.js` — `authenticateToken`

| Bước | Chi tiết |
|------|----------|
| Parse header | `authHeader.split(" ")[1]` — expect `Bearer <token>` |
| Verify JWT | `jwt.verify(token, JWT_SECRET)` — lỗi → **401** `{ message: "Invalid or expired token" }` |
| Load user | `User.findByPk(decoded.userId, { include: Role, ... })` |
| Kiểm tra active | Không có user hoặc `!is_active` → **403** `{ message: "User not found or inactive" }` |
| Gán context | `req.user`, `req.userId`, `req.userRoles` |

**Lưu ý:** `getCurrentUser` chỉ đọc `req.user`; không gọi lại `authenticateToken` trong controller.

---

## 6. API Contract

### Endpoint

```
GET /api/auth/me
```

**Auth:** JWT Bearer — bắt buộc.

### Request

- Body: không có.

### Response — 200 OK

```json
{
  "user": {
    "user_id": 1,
    "username": "kiet_shop",
    "email": "kiet@example.com",
    "full_name": "Nguyen Kiet",
    "phone_number": "0901234567",
    "address": "123 Đường ABC",
    "avatar_url": "https://...",
    "roles": ["customer"]
  }
}
```

**Các field lấy từ model + map:**

- `roles`: `user.Roles.map(role => role.role_name)` (association `Roles` Sequelize).

### Response — 401 Unauthorized

- Thiếu token → `"Access token required"`.
- Token invalid/expired → `"Invalid or expired token"`.

### Response — 403 Forbidden

- User không tìm thấy hoặc inactive → `"User not found or inactive"`.

---

## 7. Difference: Login Response vs `/me`

| Aspect | POST `/login` | GET `/me` |
|--------|---------------|-----------|
| `avatar_url` | Có | Có |
| `address` | **Không** trong response login | **Có** |
| `roles` | Có | Có |

Sau khi login OAuth hoặc cần đồng bộ địa chỉ, **`/me`** phản ánh đầy đủ hơn cho một số field.

---

## 8. Frontend Integration

### Axios interceptor (`client/app/services/api.js`)

Tự đính `Authorization: Bearer ${localStorage.getItem("token")}` cho mọi request (trừ khi không có token).

### `OAuthSuccess.jsx`

1. Lấy `token` từ query `oauth/success?token=...`.
2. `api.defaults.headers.common.Authorization = Bearer token`, `localStorage.setItem("token", token)`.
3. `api.get("/auth/me")` → `dispatch(setCredentials({ token, user: data.user }))`.

### Hooks (`useAuth.js`)

| Hook | Query key | Ghi chú |
|------|-----------|---------|
| `useMe(enabled)` | `["me"]` | `authAPI.getCurrentUser()` |
| `useCurrentUser()` | `["currentUser"]` | `api.get("/auth/me")`, `onSuccess` lưu `roles` vào localStorage; `onError` 401/403 legacy → logout mềm |

### Login success

`useLogin` `onSuccess`: `invalidateQueries` + `refetchQueries` cho `["me"]`, `["currentUser"]`, `["cart"]`.

### Global 401 handling

Interceptor: nếu 401 (và không phải login/register) → xóa token, `logout`, redirect `/login`. Điều này ảnh hưởng mọi request kể cả `/me` khi token hết hạn.

---

## 9. Redux & Persistence

- `setCredentials` lưu `user` JSON vào `localStorage` key `user` (cùng với `token`).
- `App.jsx` khởi động: restore từ `token` + `user` nếu có.
- Dữ liệu restore có thể **cũ** so với DB; refetch `/me` khi cần đồng bộ (hooks).

---

## 10. Database / Query

- `User.findByPk(req.user.user_id, { include: [Role], attributes: { exclude: ["password_hash"] } })`

**Lưu ý:** Trong middleware, user đã được load một lần; controller load **lại** lần nữa — đảm bảo dữ liệu mới nhất sau các thao tác khác (trade-off: thêm query).

---

## 11. Edge Cases

| Case | Hành vi |
|------|---------|
| Token hợp lệ nhưng user vừa bị vô hiệu hóa | 403 tại middleware (trước khi vào controller) |
| Token purpose JWT (email_verify / password_reset) dùng làm Bearer | Verify **không** có field `userId` đúng format session / hoặc payload không khớp — thường 401 |
| Purpose token có `userId` nhưng không phải session style | `jwt.verify` thành công nếu cùng secret — **rủi ro thiết kế**: nên tách secret hoặc claim `type` (hiện tại chưa có) |

**Ghi nhận bảo mật:** Toàn bộ JWT (session + purpose) đang dùng chung `JWT_SECRET` — purpose token lý thuyết có thể dùng làm Bearer nếu payload chứa `userId` (ví dụ một số purpose token). Trong code hiện tại purpose tokens dùng thêm `purpose` field; middleware **không** kiểm tra absence of `purpose` — chỉ decode `userId`. Đây là điểm cần aware khi hardening.

---

## 12. Related Features

| FR | Quan hệ |
|----|---------|
| `FR_Login.md` | Cấp JWT + user tối thiểu |
| `FR_UpdateProfile.md` | Sau khi update, client có thể refetch `/me` |
| `FR_OAuthSuccessCallback.md` | Gọi `/me` ngay sau OAuth |
| `FR_VerifyEmail.md` | Redirect OAuth success cũng dùng token session + `/me` pattern tương tự |

---

## 13. Source Files

| Layer | File |
|-------|------|
| Route | `server/routes/authRoutes.js` — `router.get("/me", authenticateToken, ...)` |
| Controller | `server/controllers/authController.js` → `getCurrentUser` |
| Middleware | `server/middleware/auth.js` → `authenticateToken` |
| FE OAuth | `client/app/pages/OAuthSuccess.jsx` |
| FE Hooks | `client/app/hooks/useAuth.js` → `useMe`, `useCurrentUser` |
| FE API | `client/app/services/api.js` → `authAPI.getCurrentUser` |
| Session JWT | `authController.generateToken`, `passport.js` `issueJwt` |

---

## 14. Acceptance Criteria

- **AC1:** Bearer hợp lệ + user active → 200 với `user` không có `password_hash`.
- **AC2:** Thiếu Authorization → 401 Access token required.
- **AC3:** Token sai/hết hạn → 401 Invalid or expired token.
- **AC4:** User inactive → 403 User not found or inactive.
- **AC5:** `roles` là mảng tên role từ DB.
- **AC6:** OAuth success page gọi `/me` và hydrate Redux + localStorage user.
