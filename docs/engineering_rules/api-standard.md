# API Standard — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** REST API backend (`server/`)  
> **Chi tiết endpoint:** [`READMEAPI.md`](../../READMEAPI.md)  
> **Liên quan:** [`backend-convention.md`](./backend-convention.md) · [`naming-convention.md`](./naming-convention.md) · [`frontend-api-integration.md`](./frontend-api-integration.md)

---

## Mục lục

1. [Base URL & Versioning](#1-base-url--versioning)
2. [HTTP Methods](#2-http-methods)
3. [Authentication](#3-authentication)
4. [Request Format](#4-request-format)
5. [Response Format](#5-response-format)
6. [HTTP Status Codes](#6-http-status-codes)
7. [Pagination](#7-pagination)
8. [Filtering & Sorting](#8-filtering--sorting)
9. [Validation](#9-validation)
10. [Error Handling](#10-error-handling)
11. [File Upload](#11-file-upload)
12. [Endpoint Naming Rules](#12-endpoint-naming-rules)
13. [Domain-specific Conventions](#13-domain-specific-conventions)
14. [Chuẩn đề xuất cho endpoint mới](#14-chuẩn-đề-xuất-cho-endpoint-mới)

---

## 1. Base URL & Versioning

### 1.1. Base URL

| Môi trường | Base URL |
|------------|----------|
| Development | `http://localhost:5000/api` |
| Docker (Nginx) | `http://localhost/api/` |
| Production | `https://{domain}/api` |

**Entry point:** `server/server.js` — tất cả routes mount dưới prefix `/api`.

### 1.2. Versioning

| Pattern | Ví dụ | Ghi chú |
|---------|-------|---------|
| Không version global | `/api/products`, `/api/orders` | Mặc định hiện tại |
| Version trên resource | `/api/products/v2` | Chỉ product list filter nâng cao |

**Quy tắc:** Không dùng `/api/v1/...` toàn cục. Nếu breaking change, thêm suffix `/v2` trên resource cụ thể.

### 1.3. Route mount map

| Prefix | Router file | Auth |
|--------|-------------|------|
| `/api/auth` | `authRoutes.js`, `authSocialRoutes.js` | Mixed |
| `/api/products` | `productRoutes.js` | Public + JWT (Q&A) |
| `/api/cart` | `cartRoutes.js` | JWT required (router-level) |
| `/api/orders` | `orderRoutes.js` | JWT required (router-level) |
| `/api/admin` | `adminRoutes.js` | JWT + admin/manager |
| `/api` | `geo.js`, `vnpayRoutes.js`, `shippingRoutes.js` | Public |
| `/api/health` | inline `server.js` | Public |

---

## 2. HTTP Methods

| Method | Mục đích | Idempotent | Body |
|--------|----------|------------|------|
| **GET** | Đọc dữ liệu, không thay đổi state | ✅ | Không |
| **POST** | Tạo resource, hành động nghiệp vụ | ❌ | JSON |
| **PUT** | Cập nhật toàn bộ / thay thế | ✅ | JSON |
| **DELETE** | Xóa resource | ✅ | Hiếm khi |

**Không dùng PATCH** trong codebase hiện tại — mọi partial update dùng PUT.

### Ví dụ theo domain

| Action | Method | Path |
|--------|--------|------|
| List products | GET | `/api/products/v2` |
| Create order | POST | `/api/orders` |
| Cancel order | POST | `/api/orders/:order_id/cancel` |
| Update profile | PUT | `/api/auth/profile` |
| Admin ship order | POST | `/api/admin/orders/:order_id/ship` |
| Delete cart item | DELETE | `/api/cart/:cart_item_id` |

**Quy ước action:** Dùng `POST` cho hành động không phải CRUD thuần (`/cancel`, `/ship`, `/deliver`, `/refund`, `/payments/retry`).

---

## 3. Authentication

### 3.1. JWT Bearer Token

```
Authorization: Bearer <token>
```

| Thuộc tính | Giá trị |
|------------|---------|
| Algorithm | HS256 (jsonwebtoken default) |
| Payload | `{ userId: number }` |
| Secret | `process.env.JWT_SECRET` |
| Expiry | 7 ngày (`expiresIn: "7d"`) |
| Middleware | `authenticateToken` (`middleware/auth.js`) |

### 3.2. Token issuance

Token được cấp khi:
- `POST /api/auth/register` — đăng ký thành công
- `POST /api/auth/login` — đăng nhập thành công
- OAuth callback — redirect FE `/oauth/success?token=...`

### 3.3. Purpose tokens (không phải session)

| Mục đích | Expiry | Query param |
|----------|--------|-------------|
| Email verification | 24h | `?token=` |
| Password reset | 15 phút | `?token=` |

### 3.4. Role authorization

```javascript
// middleware/auth.js
authorizeRoles("admin", "manager")  // OR logic — cần ít nhất 1 role
```

**Admin routes:** `adminRoutes.js` áp dụng cả `authenticateToken` + `authorizeRoles` ở router level.

### 3.5. Response khi auth fail

| Status | Message | Khi nào |
|--------|---------|---------|
| 401 | `"Access token required"` | Thiếu header |
| 401 | `"Invalid or expired token"` | JWT invalid/expired |
| 403 | `"User not found or inactive"` | User bị deactivate |
| 403 | `"Insufficient permissions"` | Thiếu role |

### 3.6. Login response shape

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "phone_number": "0901234567",
    "avatar_url": null,
    "roles": ["customer"]
  }
}
```

---

## 4. Request Format

### 4.1. Content-Type

| Type | Usage |
|------|-------|
| `application/json` | Mặc định cho mọi POST/PUT |
| `multipart/form-data` | Admin upload (product, category, brand) |

**Global middleware:** `express.json()` + `express.urlencoded({ extended: true })`.

### 4.2. Body field naming

**snake_case** — khớp database columns:

```json
{
  "variation_id": 42,
  "payment_provider": "VNPAY",
  "payment_method": "VNPAYQR",
  "shipping_address": "123 Nguyễn Huệ, Q1, TP.HCM",
  "province_id": 1,
  "ward_id": 100,
  "geo_lat": 10.776889,
  "geo_lng": 106.700806
}
```

### 4.3. Query parameter naming

**snake_case** là chuẩn chính:

```
GET /api/products/v2?category_id=1,2&min_price=10000000&sort_by=price_asc&page=1&limit=12
```

**Aliases được hỗ trợ** (product filters):

| Alias (camelCase) | Canonical (snake_case) |
|-------------------|------------------------|
| `sortBy` | `sort_by` |
| `cpu` | `processor` |
| `gpu` | `graphics_card` |
| `ssd` | `storage` |
| `screenSize` | `screen_size` |

---

## 5. Response Format

### 5.1. Trạng thái hiện tại (không envelope thống nhất)

Codebase **không** dùng wrapper `{ success, code, data, timestamp }` toàn cục. Mỗi endpoint trả shape riêng. Các pattern phổ biến:

#### Pattern A — Resource + message

```json
{
  "message": "Order created successfully",
  "order": { "order_id": 1, "order_code": "ORD-20260526-001", ... }
}
```

#### Pattern B — Collection + pagination

```json
{
  "products": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 12,
    "totalPages": 13
  }
}
```

> **Lưu ý:** Một số endpoint duplicate `total`/`totalPages` ở root level — tránh khi viết endpoint mới.

#### Pattern C — Single resource wrapper

```json
{ "order": { ... } }
{ "cart": { "items": [...], "totalItems": 3 } }
{ "user": { ... } }
```

#### Pattern D — Raw array (geo)

```json
[
  { "province_id": 1, "name": "Hồ Chí Minh", ... }
]
```

#### Pattern E — Created (201)

```json
{
  "message": "Product created successfully",
  "product": { ... }
}
```

### 5.2. Error response shapes

#### Simple message

```json
{ "message": "Product not found" }
```

#### Validation (express-validator)

```json
{
  "errors": [
    { "type": "field", "value": "ab", "msg": "Username must be 3-50 characters", "path": "username", "location": "body" }
  ]
}
```

#### Sequelize validation (errorHandler)

```json
{
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Validation isEmail on email failed" }
  ]
}
```

#### Structured duplicate

```json
{
  "message": "Duplicate entry",
  "errors": [
    { "field": "email", "code": "DUPLICATE", "message": "Email already exists" }
  ]
}
```

#### External service failure

```json
{
  "products": [],
  "basedOn": { "variationId": 42 },
  "source": "knn",
  "error": "adapter_exception",
  "detail": { "message": "...", "code": "ECONNREFUSED", "base": "http://127.0.0.1:8000" }
}
```

### 5.3. Ngôn ngữ message

| Ngữ cảnh | Ngôn ngữ | Ví dụ |
|----------|----------|-------|
| Auth, CRUD, not found | **English** | `"Product not found"`, `"Cart is empty"` |
| Checkout UX (Việt Nam) | **Tiếng Việt** | `"Vui lòng chọn Tỉnh/Thành và Phường/Xã"` |
| VNPay controller | **Tiếng Việt** | `"Thiếu orderId hoặc amount"` |
| express-validator | **English** | `"Invalid email"` |

---

## 6. HTTP Status Codes

| Code | Usage trong project | Ví dụ |
|------|---------------------|-------|
| **200** | Success (default) | GET list, PUT update |
| **201** | Resource created | POST register, create order, admin create |
| **400** | Bad input, business rule violation | Out of stock, invalid payment method |
| **401** | Missing/invalid token, bad login | `"Invalid username or password"` |
| **403** | Inactive user, insufficient role | Admin route without admin role |
| **404** | Entity not found | Product, order, user |
| **409** | Duplicate entry | Email/username exists, question already answered |
| **502** | External service failure | ML recommendation down, VNPay config missing |
| **500** | Unhandled server error | errorHandler default |

**Health check:**

```
GET /api/health → 200
{ "status": "OK", "message": "Server is running" }
```

---

## 7. Pagination

### 7.1. Query parameters

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `page` | integer | 1 | — |
| `limit` | integer | 12 (products), 10 (orders), 20 (admin) | 100 (orders) |

### 7.2. Calculation

```javascript
const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.max(1, parseInt(req.query.limit) || 12);
const offset = (page - 1) * limit;
```

**Alias:** Orders list chấp nhận `perPage` thay cho `limit`.

### 7.3. Response pagination object

```json
{
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 12,
    "totalPages": 13
  }
}
```

### 7.4. Offset exception

Product Q&A thread hỗ trợ thêm `offset` query param (ngoài page/limit).

---

## 8. Filtering & Sorting

### 8.1. Product list v2 filters

```
GET /api/products/v2
  ?category_id=1,2
  &brand_id=3
  &min_price=10000000
  &max_price=30000000
  &processor=Intel Core i7,AMD Ryzen 7
  &ram=16GB,32GB
  &storage=512GB SSD,1TB SSD
  &graphics_card=NVIDIA RTX 4060
  &screen_size=15.6 inch
  &min_weight=1.5
  &max_weight=2.5
  &search=laptop gaming
  &sort_by=price_asc
  &page=1
  &limit=12
```

### 8.2. Sort options (v2)

| `sort_by` | Mô tả |
|-----------|-------|
| `price_asc` | Giá tăng dần |
| `price_desc` | Giá giảm dần |
| `newest` | Mới nhất |
| `best_selling` | Bán chạy |

### 8.3. Order list tabs

```
GET /api/orders?tab=awaiting_payment&page=1&limit=10
```

| Tab | Filter status |
|-----|---------------|
| `all` | Tất cả |
| `awaiting_payment` | AWAITING_PAYMENT |
| `to_ship` | processing |
| `shipping` | shipping |
| `completed` | delivered |
| `cancelled` | cancelled |
| `failed` | FAILED |

### 8.4. Search

| Endpoint | Param | Mô tả |
|----------|-------|-------|
| Product list | `search` | Full-text |
| Search suggestions | `q` | Autocomplete |
| Order list | `q` | Search order code |
| Admin users | `q` | Search username/email |

---

## 9. Validation

### 9.1. express-validator (auth routes only)

**File:** `routes/authRoutes.js` — rules định nghĩa inline, check trong controller:

```javascript
const registerValidation = [
  body("username").trim().isLength({ min: 3, max: 50 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("phone_number").optional().matches(/^[+0-9][0-9\s\-()]{6,}$/i),
];
router.post("/register", registerValidation, authController.register);
```

```javascript
const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({ errors: errors.array() });
}
```

### 9.2. Manual validation (phần lớn controllers)

```javascript
// orderController — payment provider map
const VALID = {
  COD: ["COD"],
  VNPAY: ["VNPAYQR", "VNBANK", "INTCARD", "INSTALLMENT"],
};
if (!VALID[payment_provider]) {
  return res.status(400).json({ message: `Unsupported payment_provider: ${payment_provider}` });
}

// Required fields
if (!province_id || !ward_id) {
  return res.status(400).json({ message: "Vui lòng chọn Tỉnh/Thành và Phường/Xã" });
}
```

### 9.3. Sequelize model validators

```javascript
// User model
email: { validate: { isEmail: true } }
phone_number: { validate: { is: /^[+0-9][0-9\s\-()]{6,}$/i } }
```

---

## 10. Error Handling

### 10.1. Global error handler

**File:** `middleware/errorHandler.js` — mounted cuối cùng trong `server.js`.

| Error type | Status | Response |
|------------|--------|----------|
| `SequelizeValidationError` | 400 | `{ message, errors: [{ field, message }] }` |
| `SequelizeUniqueConstraintError` | 409 | `{ message: "Duplicate entry" }` |
| `JsonWebTokenError` | 401 | `{ message: "Invalid token" }` |
| `TokenExpiredError` | 401 | `{ message: "Token expired" }` |
| Default | 500 | `{ message, stack? (dev only) }` |

### 10.2. Controller error pattern

```javascript
exports.someHandler = async (req, res, next) => {
  try {
    // business logic
    return res.json({ ... });
  } catch (error) {
    next(error);  // → errorHandler
  }
};
```

### 10.3. Transaction rollback pattern

```javascript
const t = await sequelize.transaction();
try {
  if (validationFails) {
    await t.rollback();
    return res.status(400).json({ message: "..." });
  }
  // ... writes
  await t.commit();
  return res.status(201).json({ ... });
} catch (err) {
  await t.rollback();
  next(err);
}
```

---

## 11. File Upload

Admin upload dùng **multipart/form-data** + Cloudinary. Chi tiết: [`commerce-object-storage.md`](./commerce-object-storage.md).

| Endpoint | Fields | Max |
|----------|--------|-----|
| POST `/api/admin/products` | `thumbnail`, `product_images` | 1 + 10 |
| POST `/api/admin/categories` | `thumbnail` (icon) | 1 |
| POST `/api/admin/brands` | `thumbnail` (logo) | 1 |

**Response:** URL Cloudinary lưu vào DB (`thumbnail_url`, `image_url`, `icon_url`, `logo_url`).

---

## 12. Endpoint Naming Rules

### 12.1. Path conventions

| Rule | Ví dụ |
|------|-------|
| Plural nouns cho collections | `/products`, `/orders`, `/categories` |
| snake_case cho params | `:product_id`, `:order_id`, `:variation_id` |
| kebab-case cho multi-word | `/search-suggestions`, `/reset-password`, `/shipping-address` |
| Verbs as sub-resource actions | `POST .../cancel`, `.../ship`, `.../deliver` |
| Nested resources | `/products/:product_id/variations` |
| Static routes trước dynamic | `/facets`, `/v2` trước `/:id` |

### 12.2. Không nên

| Anti-pattern | Thay bằng |
|--------------|-----------|
| `/api/getProducts` | `GET /api/products` |
| `/api/product/delete/:id` | `DELETE /api/admin/products/:id` |
| camelCase params `:productId` | `:product_id` |
| Mixed versioning `/api/v1/products` | `/api/products/v2` nếu cần |

---

## 13. Domain-specific Conventions

### 13.1. Orders

**Create order body (required):**

```json
{
  "shipping_address": "string",
  "shipping_phone": "string",
  "shipping_name": "string",
  "payment_provider": "COD | VNPAY",
  "payment_method": "COD | VNPAYQR | VNBANK | INTCARD | INSTALLMENT",
  "province_id": 1,
  "ward_id": 100,
  "geo_lat": 10.776889,
  "geo_lng": 106.700806,
  "note": "optional",
  "items": [{ "variation_id": 42, "quantity": 1 }]
}
```

**Create response (VNPay):**

```json
{
  "message": "Order created successfully",
  "order": { ... },
  "redirect": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
}
```

### 13.2. Cart

Tất cả routes yêu cầu JWT (router-level middleware).

```json
POST /api/cart
{ "variation_id": 42, "quantity": 1 }
```

### 13.3. Recommendations

```
GET /api/products/variations/:variation_id/recommendations
```

Proxy tới ML service, enrich metadata:

```json
{
  "products": [{ "variation_id", "product_id", "product_name", "price", "thumbnail_url", "slug", ... }],
  "basedOn": { "variationId": 42 },
  "source": "knn"
}
```

### 13.4. Geo

```
GET /api/provinces
GET /api/provinces/:id/wards
GET /api/quote?province_id=1&ward_id=100&subtotal=15000000
```

> **Mismatch FE/BE:** `geoAPI.getWards` gọi `/wards?province_id=` nhưng BE thực tế là `/provinces/:id/wards`. Cần đồng bộ.

### 13.5. VNPay

```
POST /api/vnpay/create_payment_url   { orderId, amount }
GET  /api/vnpay/return               ?vnp_* (redirect callback)
```

---

## 14. Chuẩn đề xuất cho endpoint mới

Khi viết endpoint mới, **nên** tuân theo (cải thiện so với code cũ):

### 14.1. Response envelope đề xuất

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "message": "Product not found",
  "errors": null
}
```

### 14.2. Checklist endpoint mới

- [ ] Method RESTful đúng (GET/POST/PUT/DELETE)
- [ ] Path snake_case params, kebab-case segments
- [ ] Auth middleware nếu cần (`authenticateToken`, `authorizeRoles`)
- [ ] Validation trước khi xử lý (express-validator hoặc manual)
- [ ] Transaction cho multi-table writes
- [ ] Row lock (`LOCK.UPDATE`) khi modify stock
- [ ] Status code chính xác (201 cho create, 404 cho not found)
- [ ] Error `{ message }` nhất quán
- [ ] Pagination `{ pagination: { total, page, limit, totalPages } }` cho list
- [ ] `next(error)` trong catch — không nuốt lỗi
- [ ] Document trong `READMEAPI.md`

---

*Phản ánh thực tế API tại `server/` và chuẩn đề xuất cho phát triển tiếp theo.*
