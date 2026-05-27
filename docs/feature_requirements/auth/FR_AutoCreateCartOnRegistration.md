# Functional Requirement (FR) — Tự động tạo giỏ hàng khi đăng ký / Tạo tài khoản mới

## 1. Feature Overview

Hệ thống thương mại **một-cart-một-user** (`Cart.user_id` **unique**) yêu cầu mỗi user có một bản ghi `carts`. Khi tài khoản được **khởi tạo lần đầu** qua các luồng sau, backend gọi **`Cart.create({ user_id })`** ngay trong cùng request (transaction **không** bọc explicit — Sequelize auto-commit):

| Luồng | Controller / Module | Ghi chú |
|-------|---------------------|---------|
| **Đăng ký trực tiếp** | `authController.register` | User active mặc định + token trong response |
| **Đăng ký chờ email** | `authController.registerEmailVerification` | `is_active: false` — cart **đã có** trước khi verify |
| **OAuth (Google/Facebook)** user **mới** | `passport.js` → `findOrCreateOAuthUser` nhánh create | Sau `User.create`, `Cart.create` |
| **Cart API phòng hờ** | `cartController.getOrCreateCart` | Nếu thiếu cart (migration / legacy / lỗi trước đó), GET cart tự tạo |

**Không** tạo cart khi chỉ đăng nhập lại, khi chỉ attach OAuth vào email trùng, hoặc khi user đã tồn tại.

Đây là nghiệp vụ lõi của **Đồ án laptop e-commerce**: giỏ hàng gắn user để khớp luồng checkout, `/api/cart`, và admin.

---

## 2. Business Motivation

- **Đồng nhất chiều dữ liệu:** Controller cart (`getCart`) gọi `getOrCreateCart` — có phần thừa redundancy với proactive create lúc register; chủ đích là không bao giờ vào state “user không có cart_id”.
- **Sẵn sàng thêm SKU:** Sau register, frontend có thể `invalidateQueries(["cart"])` (login/register success) và gọi `GET /api/cart` an toàn.
- **Đơn giản onboarding:** OAuth không cần bước thủ công tạo giỏ.

---

## 3. Model & Constraint

### `Cart` (`server/models/Cart.js`)

| Thuộc tính | Chi tiết |
|------------|---------|
| `cart_id` | PK INTEGER auto |
| `user_id` | INTEGER **NOT NULL**, **UNIQUE**, FK → `users.user_id` |
| Timestamps | `created_at`, `updated_at` |

Một user **đúng một** cart theo constraint.

---

## 4. Đăng ký — `POST /api/auth/register`

File: `server/controllers/authController.js`

Thứ tự sau validate + `User.create`:

1. `Role.findOne({ role_name: "customer" })` → `user.addRole(customerRole)` nếu có.
2. **`await Cart.create({ user_id: user.user_id })`**
3. `generateToken(user.user_id)`, response `201 { token, user, ... }`.

**Không** đổi nếu trùng username/email/SĐT — không tới được bước create.

---

## 5. Đăng ký chờ verify email — `POST /api/auth/register-email`

```javascript
await User.create({ ..., is_active: false })
// role customer
await Cart.create({ user_id: user.user_id })
// signPurposeToken email_verify, sendEmail
// 201 { message: "Verification email sent", email }
```

**Ý nghĩa:** User chưa thể đăng nhập (`login` kiểm `is_active`). **Giỏ đã được tạo** — họ có user_id cố định; sau verify + session JWT họ có thể add cart ngay.

---

## 6. OAuth — `findOrCreateOAuthUser` (`server/config/passport.js`)

### Không tạo cart

- Case 1: Tìm theo `(oauth_provider, oauth_id)` — user đã tồn tại → **không** tạo cart mới (đã có từ lần đăng ký trước).
- Case 2: Tìm theo email trùng → `user.update(...)` OAuth fields → **không** tạo cart (user và cart đã có).

### Có `Cart.create`

- Case 3: `User.create({ ... oauth fields, password_hash null ... })`:

```javascript
const customerRole = await Role.findOne({ where: { role_name: "customer" } })
if (customerRole) await user.addRole(customerRole)
await Cart.create({ user_id: user.user_id })
```

Sau đó `last_login` + `issueJwt`.

---

## 7. Fallback — `cartController.getOrCreateCart`

```javascript
async function getOrCreateCart(user_id) {
  let cart = await Cart.findOne({ where: { user_id } })
  if (!cart) cart = await Cart.create({ user_id })
  return cart
}
```

Được **`getCart`** (và các thao tác cart khác có thể dùng) gọi. Bù trừ các tình huống:

- Dữ liệu cũ trước khi có feature auto-create.
- Lỗi tạo cart lúc register (rollback partial — hiện không có transaction chung).

---

## 8. Frontend phản xạ

### Sau login (`useLogin` `onSuccess`)

```javascript
qc.invalidateQueries({ queryKey: ["cart"] })
qc.refetchQueries({ queryKey: ["cart"] })
```

Đảm bảo Redux/local cart UI đồng bộ sau khi user đã có cart phía BE.

### Register direct (mutation `useRegister`)

Response có token — app có thể dispatch credentials tương tự và refetch cart (tùy màn đăng ký — kiểm tra `RegisterPage` hiện dùng `register-email`; flow direct ít dùng trên FE).

---

## 9. Ordering & Failures

| Rủi ro | Chi tiết |
|--------|-----------|
| `Cart.create` fail sau `User.create` | User mồ côi **không** có cart → lần GET `/cart` sẽ `getOrCreateCart` **vá** |
| Duplicate cart | UNIQUE `user_id` — second `Cart.create` throw |
| Role `customer` thiếu seed | Cart vẫn tạo; user không có role — ảnh hưởng RBAC/admin (ngoài FR này) |

---

## 10. Transactions

Code hiện tại **không** bọc `User.create` + `Cart.create` + `addRole` trong `sequelize.transaction()`. Rolling back khi một bước fail là **manual / không có**.

Đề xuất cải tiến (ngoài FR): Sequelize transaction để đồng bộ atomic.

---

## 11. Relation to đồ án (checkout & orders)

| Thành phần | Vai trò |
|------------|---------|
| `Cart`, `CartItem` | Chuẩn bị order |
| `cartRoutes` | `authenticateToken` + `cartController` |
| Order flow | Consume cart/items khi đặt hàng (xem FR/order riêng) |

Auto-create cart đảm bảo user mới không gặp lỗi “404 cart” khi add to cart lần đầu (trừ khi toàn bộ flow fail trước đó).

---

## 12. Related Features

| FR / File | Quan hệ |
|-----------|---------|
| `FR_RegisterDirect.md` | Register + cart |
| `FR_RegisterEmailVerification.md` | Verify path + cart đã tồn tại |
| `FR_OAuthGoogle.md` / `FR_OAuthFacebook.md` | Cart khi user OAuth mới |
| `server/controllers/cartController.js` | `getOrCreateCart` |

---

## 13. Source Files (tham chiếu nhanh)

| Vị trí | Nội dung |
|--------|----------|
| `server/controllers/authController.js` | `register`, `registerEmailVerification` — `Cart.create` |
| `server/config/passport.js` | `findOrCreateOAuthUser` — `Cart.create` |
| `server/controllers/cartController.js` | `getOrCreateCart` |
| `server/models/Cart.js` | Schema unique `user_id` |

---

## 14. Acceptance Criteria

- **AC1:** User mới từ `POST /register` có đúng một row `carts` với `user_id` khớp.
- **AC2:** User mới từ `POST /register-email` có cart trước khi verify email.
- **AC3:** User OAuth mới (create path) có cart.
- **AC4:** User OAuth merge email / login lại **không** tạo cart thứ hai.
- **AC5:** `GET /api/cart` với user thiếu cart (edge) tự tạo cart — server không 500.
- **AC6:** Constraint DB: không thể insert hai cart cùng `user_id`.
