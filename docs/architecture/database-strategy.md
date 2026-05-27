# Database Strategy — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Liên quan:** [`system-architecture.md`](./system-architecture.md) · [`event-driven-architecture.md`](./event-driven-architecture.md) · [`../master_specification.md`](../master_specification.md)

---

## Mục lục

1. [Tổng quan chiến lược](#1-tổng-quan-chiến-lược)
2. [Công nghệ lưu trữ](#2-công-nghệ-lưu-trữ)
3. [Mô hình truy cập dữ liệu](#3-mô-hình-truy-cập-dữ-liệu)
4. [Phân vùng dữ liệu theo domain](#4-phân-vùng-dữ-liệu-theo-domain)
5. [Schema chi tiết](#5-schema-chi-tiết)
6. [Quan hệ & ràng buộc toàn vẹn](#6-quan-hệ--ràng-buộc-toàn-vẹn)
7. [Chiến lược giao dịch (Transactions)](#7-chiến-lược-giao-dịch-transactions)
8. [Quản lý tồn kho (Inventory)](#8-quản-lý-tồn-kho-inventory)
9. [Migration & Schema Evolution](#9-migration--schema-evolution)
10. [Indexing & Performance](#10-indexing--performance)
11. [Backup, HA & Môi trường](#11-backup-ha--môi-trường)
12. [Dữ liệu bên ngoài DB](#12-dữ-liệu-bên-ngoài-db)
13. [Hạn chế hiện tại & Lộ trình cải tiến](#13-hạn-chế-hiện-tại--lộ-trình-cải-tiến)

---

## 1. Tổng quan chiến lược

### 1.1. Nguyên tắc cốt lõi

LaptopStore áp dụng mô hình **Single Shared Database** — toàn bộ ứng dụng backend (`server/`) và dịch vụ ML (`recommendation_service/`) **cùng truy cập một PostgreSQL database**.

| Nguyên tắc | Mô tả |
|------------|-------|
| **ACID-first** | Mọi nghiệp vụ quan trọng (đặt hàng, trừ kho, thanh toán) chạy trong transaction PostgreSQL |
| **ORM-centric** | Backend dùng Sequelize; schema được định nghĩa qua model JS |
| **SKU-level inventory** | Tồn kho quản lý ở `product_variations`, không phải `products` |
| **Snapshot pricing** | Giá tại thời điểm đặt hàng được lưu vào `order_items` và `cart_items.price_at_add` |
| **No cross-DB reads** | Không có MongoDB, Redis hay DB phụ — mọi thứ trong một PostgreSQL |

### 1.2. So sánh với kiến trúc Database-per-Service

| Tiêu chí | LaptopStore (hiện tại) | Database-per-Service (microservices) |
|----------|------------------------|--------------------------------------|
| Số database | **1** PostgreSQL | N database, mỗi service một DB |
| Giao dịch phân tán | **Không cần** — local transaction đủ | Cần Saga / Outbox / 2PC |
| Độ phức tạp | Thấp, phù hợp MVP | Cao, phù hợp scale lớn |
| Coupling | Server + ML service share DB | Service độc lập hoàn toàn |
| Phù hợp | Monolith API + 1 ML worker | Hệ thống multi-team, multi-domain |

> **Lưu ý thiết kế:** Đây là quyết định **cố ý cho MVP**. Khi scale, có thể tách recommendation sang read-replica hoặc materialized view riêng trước khi tách DB hoàn toàn.

### 1.3. Sơ đồ truy cập dữ liệu

```mermaid
flowchart LR
  subgraph apps [Applications]
    Server[server/<br/>Express + Sequelize]
    Rec[recommendation_service/<br/>Flask + SQLAlchemy/psycopg2]
  end

  subgraph pg [PostgreSQL]
    Tables[(18+ tables<br/>users, products, orders, ...)]
  end

  subgraph external [External Storage]
    Cloudinary[Cloudinary<br/>Images]
    Artifacts[ML Artifacts<br/>.pkl .npy .joblib]
    BenchJSON[Benchmark JSON<br/>cpu/gpu]
  end

  Server -->|NEON_DATABASE_URL<br/>ORM read/write| Tables
  Rec -->|DATABASE_URL<br/>SQL read-only*| Tables
  Server --> Cloudinary
  Rec --> Artifacts
  Rec --> BenchJSON
```

`*` Recommendation service chỉ **SELECT** tại runtime; training script đọc toàn bộ catalog.

---

## 2. Công nghệ lưu trữ

### 2.1. PostgreSQL — Primary Database

| Thuộc tính | Giá trị |
|------------|---------|
| Engine | PostgreSQL 15 |
| Production | **Neon Serverless** (cloud, SSL) |
| Local/Docker | `postgres:15-alpine`, DB `laptop_store` |
| ORM (server) | Sequelize 6 |
| Driver (server) | `pg` 8.x |
| Access (recommendation) | SQLAlchemy Engine + psycopg2 (training) |
| Connection pool (Sequelize) | max: 5, min: 0, acquire: 30s, idle: 10s |
| SSL | `rejectUnauthorized: false` (Neon) |

**File cấu hình:** `server/config/database.js`

```javascript
// Biến bắt buộc
NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

### 2.2. JSONB — Semi-structured Data

PostgreSQL JSONB được dùng cho dữ liệu linh hoạt:

| Bảng | Cột JSONB | Mục đích |
|------|-----------|----------|
| `products` | `specs` | Thông số kỹ thuật bổ sung (màn hình, pin, trọng lượng, ...) |
| `payments` | `raw_return`, `raw_ipn` | Lưu payload VNPay để audit/trace |

### 2.3. Không sử dụng (MVP)

| Công nghệ | Lý do không dùng | Thay thế hiện tại |
|-----------|------------------|-------------------|
| **Redis** | Chưa cần cache/lock phân tán | PostgreSQL row lock + advisory lock |
| **MongoDB** | Catalog có cấu trúc rõ ràng | PostgreSQL + JSONB cho specs |
| **Elasticsearch** | Quy mô MVP chưa cần full-text engine riêng | SQL `ILIKE` + search suggestions |
| **Read Replica** | Single Neon instance đủ | — |

---

## 3. Mô hình truy cập dữ liệu

### 3.1. Backend (`server/`) — Sequelize ORM

**Registry:** `server/models/index.js` — đăng ký 18 model và toàn bộ association.

**Pattern truy cập:**

| Pattern | Ví dụ | File |
|---------|-------|------|
| Simple CRUD | `Product.findAll({ where, include })` | `productController.js` |
| Transaction + row lock | `findOne({ lock: t.LOCK.UPDATE })` | `orderController.js` |
| Advisory lock | `pg_try_advisory_lock(987654321)` | `releaseReservations.js` |
| Eager loading | `include: [{ model: ProductVariation, as: 'variations' }]` | Nhiều controller |
| Increment (fire-and-forget) | `product.increment('view_count').catch(() => {})` | `productController.js` |

### 3.2. Recommendation Service — Raw SQL

**Runtime queries** (`recommendation_service/core/db.py`):

```sql
-- Lấy 1 variation (sản phẩm mới chưa index)
SELECT pv.variation_id, pv.product_id, p.product_name,
       pv.processor, pv.ram, pv.storage, pv.graphics_card, pv.price
FROM product_variations pv
JOIN products p ON p.product_id = pv.product_id
WHERE pv.is_available = true AND pv.variation_id = %(vid)s

-- Fresh pool (60 ngày gần nhất)
SELECT ... FROM product_variations pv
JOIN products p ON p.product_id = pv.product_id
WHERE pv.is_available = true
  AND GREATEST(pv.updated_at, pv.created_at) >= NOW() - INTERVAL '60 days'
ORDER BY ts DESC LIMIT 200
```

**Training query** (`train_recommend.py`):

```sql
SELECT pv.variation_id, pv.product_id, p.product_name,
       pv.processor, pv.ram, pv.storage, pv.graphics_card, pv.price
FROM product_variations pv
LEFT JOIN products p ON pv.product_id = p.product_id
WHERE pv.is_available = true
```

### 3.3. Ma trận quyền truy cập

| Consumer | Read | Write | Tables chính |
|----------|------|-------|--------------|
| `server/` (Express) | ✅ Full | ✅ Full | Tất cả |
| `recommendation_service/` (runtime) | ✅ SELECT | ❌ | `products`, `product_variations` |
| `train_recommend.py` (offline) | ✅ SELECT | ❌ | `products`, `product_variations` |
| Frontend | ❌ | ❌ | Qua REST API only |

---

## 4. Phân vùng dữ liệu theo domain

Mặc dù dùng chung một database, dữ liệu được **phân nhóm logic** theo bounded context:

```mermaid
erDiagram
  subgraph identity [Identity & Access]
    users
    roles
    permissions
    user_roles
    role_permissions
  end

  subgraph catalog [Product Catalog]
    products
    product_variations
    product_images
    categories
    brands
    tags
    product_tags
  end

  subgraph commerce [Commerce]
    carts
    cart_items
    orders
    order_items
    payments
  end

  subgraph geo [Geography & Shipping]
    provinces
    wards
  end

  subgraph community [Community / Q&A]
    questions
    answers
  end

  subgraph notification [Notification - chưa active]
    notifications
  end
```

### 4.1. Identity & Access

| Bảng | Mục đích | Ghi chú |
|------|----------|---------|
| `users` | Tài khoản người dùng | Hỗ trợ OAuth (nullable password) |
| `roles` | Vai trò: `admin`, `customer`, `manager` | |
| `permissions` | Quyền chi tiết | **Model tồn tại, chưa enforce** |
| `user_roles` | M2M user ↔ role | Junction table |
| `role_permissions` | M2M role ↔ permission | Junction table |

### 4.2. Product Catalog

| Bảng | Mục đích | Ghi chú |
|------|----------|---------|
| `products` | Model laptop (tên, mô tả, slug, discount) | `specs` JSONB |
| `product_variations` | SKU — cấu hình cụ thể + giá + stock | **Đơn vị tồn kho** |
| `product_images` | Gallery ảnh | URL Cloudinary |
| `categories` | Danh mục (hỗ trợ parent_id) | Self-referencing |
| `brands` | Thương hiệu laptop | |
| `tags` | Tag sản phẩm | **Chưa expose UI** |
| `product_tags` | M2M product ↔ tag | Junction table |

### 4.3. Commerce

| Bảng | Mục đích | Ghi chú |
|------|----------|---------|
| `carts` | Giỏ hàng (1:1 user) | Persist DB, không Redis |
| `cart_items` | Item trong giỏ | `price_at_add` snapshot |
| `orders` | Đơn hàng | Status ENUM phức tạp |
| `order_items` | Chi tiết đơn | Snapshot price/discount/subtotal |
| `payments` | Thanh toán (1:1 order) | VNPay raw JSONB |

### 4.4. Geography & Shipping

| Bảng | Mục đích |
|------|----------|
| `provinces` | Tỉnh/thành + quy tắc phí ship |
| `wards` | Phường/xã + phụ phí |

### 4.5. Community

| Bảng | Mục đích |
|------|----------|
| `questions` | Q&A global (`product_id` NULL) hoặc theo SP |
| `answers` | Câu trả lời |

### 4.6. Notification (dự phòng)

| Bảng | Mục đích | Trạng thái |
|------|----------|------------|
| `notifications` | In-app notification | **Chưa có API/UI** |

---

## 5. Schema chi tiết

### 5.1. Bảng `users`

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| user_id | INTEGER PK | NO | Auto increment |
| username | VARCHAR(50) UNIQUE | NO | |
| email | VARCHAR(100) UNIQUE | NO | Validate email |
| password_hash | VARCHAR(255) | YES | Null cho OAuth user |
| full_name | VARCHAR(100) | YES | |
| phone_number | VARCHAR(20) UNIQUE | YES | Regex phone |
| address | TEXT | YES | |
| avatar_url | VARCHAR(255) | YES | |
| is_active | BOOLEAN | NO | Default true |
| last_login | TIMESTAMP | YES | |
| oauth_provider | VARCHAR(20) | YES | `google` / `facebook` |
| oauth_id | VARCHAR(191) | YES | Provider subject ID |
| created_at | TIMESTAMP | NO | |
| updated_at | TIMESTAMP | NO | |

**Hooks:** `beforeCreate` / `beforeUpdate` — bcrypt hash password (rounds: 10).

### 5.2. Bảng `products`

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| product_id | INTEGER PK | NO | |
| product_name | VARCHAR(255) | NO | |
| slug | VARCHAR(255) UNIQUE | NO | Vietnamese slugify |
| description | TEXT | YES | Long text |
| category_id | INTEGER FK | YES | → categories |
| brand_id | INTEGER FK | YES | → brands |
| discount_percentage | DECIMAL(5,2) | NO | Default 0 — % giảm toàn SP |
| thumbnail_url | VARCHAR(255) | YES | Cloudinary URL |
| is_active | BOOLEAN | NO | Default true |
| view_count | INTEGER | NO | Default 0 |
| rating_average | DECIMAL(3,2) | NO | **Chưa có review flow** |
| review_count | INTEGER | NO | **Chưa có review flow** |
| specs | JSONB | YES | Default `{}` — weight, battery, ... |

### 5.3. Bảng `product_variations`

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| variation_id | INTEGER PK | NO | |
| product_id | INTEGER FK | NO | → products |
| sku | VARCHAR(100) UNIQUE | YES | |
| processor | VARCHAR(100) | YES | Input cho KNN |
| ram | VARCHAR(50) | YES | Input cho KNN |
| storage | VARCHAR(50) | YES | Input cho KNN |
| graphics_card | VARCHAR(100) | YES | Input cho KNN |
| screen_size | VARCHAR(50) | YES | Filter catalog |
| color | VARCHAR(50) | YES | |
| price | DECIMAL(10,2) | NO | Giá bán VND |
| stock_quantity | INTEGER | NO | Default 0 — **tồn kho thực** |
| is_available | BOOLEAN | NO | Default true |
| is_primary | BOOLEAN | NO | Biến thể mặc định hiển thị |

### 5.4. Bảng `orders`

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| order_id | INTEGER PK | NO | |
| user_id | INTEGER FK | NO | → users |
| order_code | VARCHAR(50) UNIQUE | NO | Mã hiển thị (generate) |
| total_amount | DECIMAL(16,2) | NO | Tổng trước giảm |
| shipping_fee | DECIMAL(16,2) | NO | |
| discount_amount | DECIMAL(16,2) | NO | Default 0 |
| final_amount | DECIMAL(16,2) | NO | = subtotal - discount + ship |
| status | ENUM | NO | Xem §5.5 |
| shipping_address | TEXT | NO | |
| shipping_phone | VARCHAR(20) | NO | |
| shipping_name | VARCHAR(100) | NO | |
| note | TEXT | YES | |
| reserve_expires_at | TIMESTAMP | YES | VNPay: now + 24h |
| province_id | INTEGER FK | YES | → provinces |
| ward_id | INTEGER FK | YES | → wards |
| geo_lat | DECIMAL(10,6) | YES | Bắt buộc khi checkout |
| geo_lng | DECIMAL(10,6) | YES | Bắt buộc khi checkout |

### 5.5. Order Status ENUM

```
pending | confirmed | processing | shipping | delivered | cancelled
AWAITING_PAYMENT | PAID | FAILED
```

| Status | Ngữ cảnh sử dụng |
|--------|------------------|
| `AWAITING_PAYMENT` | VNPay — chờ user thanh toán |
| `processing` | COD mới tạo / VNPay đã thanh toán |
| `shipping` | Admin đã ship |
| `delivered` | Admin xác nhận giao |
| `cancelled` | User hủy / cron hết hạn VNPay |
| `PAID` | Trạng thái trung gian (ít dùng, ưu tiên `processing`) |
| `FAILED` | Thanh toán thất bại |

### 5.6. Bảng `payments`

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| payment_id | INTEGER PK | NO | |
| order_id | INTEGER FK UNIQUE | NO | 1:1 với order |
| payment_method | ENUM | NO | COD, VNPAYQR, VNBANK, INTCARD, INSTALLMENT, ... |
| payment_status | ENUM | NO | pending, completed, failed, refunded |
| amount | DECIMAL(16,2) | NO | |
| provider | VARCHAR(32) | YES | `COD` / `VNPAY` |
| txn_ref | VARCHAR(128) | YES | `{orderId}-{timestamp}` |
| transaction_id | VARCHAR(100) | YES | VNPay transaction no |
| raw_return | JSONB | YES | Payload return URL |
| raw_ipn | JSONB | YES | Payload IPN (chưa dùng) |
| paid_at | TIMESTAMP | YES | |

**Index:** Unique partial trên `(provider, txn_ref)` — `payments_provider_txnref_uk`.

### 5.7. Bảng `order_items`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| order_item_id | INTEGER PK | |
| order_id | INTEGER FK | |
| variation_id | INTEGER FK | |
| quantity | INTEGER | |
| price | DECIMAL(16,2) | **Giá gốc/unit tại thời điểm đặt** |
| discount_amount | DECIMAL(16,2) | Tổng giảm cho dòng |
| subtotal | DECIMAL(16,2) | = price × qty - discount |

> **Snapshot principle:** Không join lại `product_variations.price` khi hiển thị đơn cũ — luôn đọc từ `order_items`.

### 5.8. Bảng `cart_items`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| cart_item_id | INTEGER PK | |
| cart_id | INTEGER FK | |
| variation_id | INTEGER FK | |
| quantity | INTEGER | Default 1 |
| price_at_add | DECIMAL(10,2) | Giá tại thời điểm thêm giỏ |
| added_at | TIMESTAMP | createdAt (no updatedAt) |

### 5.9. Bảng `provinces`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| province_id | INTEGER PK | |
| name | VARCHAR(150) UNIQUE | |
| slug | VARCHAR(180) UNIQUE | |
| region | ENUM | south, central, north, highland, island |
| base_shipping_fee | INTEGER | VND |
| is_free_shipping | BOOLEAN | Freeship toàn tỉnh |
| max_shipping_fee | INTEGER | Trần phí ship (default 150,000) |
| is_hcm | BOOLEAN | Freeship nếu subtotal ≥ 1M |

### 5.10. Bảng `wards`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| ward_id | INTEGER PK | |
| province_id | INTEGER FK | ON DELETE CASCADE |
| name | VARCHAR(150) | |
| slug | VARCHAR(180) | |
| extra_fee | INTEGER | Phụ phí VND |

### 5.11. Bảng `questions` & `answers`

**questions:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| question_id | INTEGER PK | |
| product_id | INTEGER FK | **NULL = global Q&A** |
| user_id | INTEGER FK | |
| question_text | TEXT | |
| is_answered | BOOLEAN | |
| parent_question_id | INTEGER FK | Self-reference (thread) |

**answers:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| answer_id | INTEGER PK | |
| question_id | INTEGER FK | |
| user_id | INTEGER FK | |
| answer_text | TEXT | |

### 5.12. Junction Tables

| Bảng | FK 1 | FK 2 |
|------|------|------|
| `user_roles` | user_id | role_id |
| `role_permissions` | role_id | permission_id |
| `product_tags` | product_id | tag_id |

---

## 6. Quan hệ & ràng buộc toàn vẹn

### 6.1. Sơ đồ ERD đầy đủ

```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : assigned
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : granted

  users ||--o| carts : owns
  carts ||--o{ cart_items : contains
  product_variations ||--o{ cart_items : in

  users ||--o{ orders : places
  orders ||--o{ order_items : contains
  orders ||--o| payments : has
  product_variations ||--o{ order_items : sold_as

  categories ||--o{ products : groups
  brands ||--o{ products : brands
  products ||--o{ product_variations : has
  products ||--o{ product_images : has
  products ||--o{ questions : has
  products }o--o{ tags : tagged

  users ||--o{ questions : asks
  questions ||--o{ answers : has
  questions ||--o{ questions : replies

  provinces ||--o{ wards : contains
  orders }o--|| provinces : to
  orders }o--|| wards : to

  users ||--o{ notifications : receives
```

### 6.2. Cardinality quan trọng

| Quan hệ | Cardinality | Ghi chú |
|---------|-------------|---------|
| User ↔ Cart | 1:1 | Tự tạo khi register/OAuth |
| Order ↔ Payment | 1:1 | Unique constraint trên order_id |
| Product ↔ Variation | 1:N | Một laptop nhiều cấu hình |
| Product ↔ Image | 1:N | Gallery |
| Category ↔ Category | 1:N (self) | parent_id cho danh mục con |

### 6.3. Referential Integrity

- Sequelize `references.model` trên hầu hết FK
- `wards.province_id`: `ON DELETE CASCADE`, `ON UPDATE CASCADE`
- Junction tables không có FK cascade explicit — phụ thuộc Sequelize sync

---

## 7. Chiến lược giao dịch (Transactions)

### 7.1. Nguyên tắc

| Nguyên tắc | Mô tả |
|------------|-------|
| **Single DB transaction** | Mọi side-effect trong cùng nghiệp vụ nằm trong 1 `sequelize.transaction()` |
| **Pessimistic locking** | `lock: t.LOCK.UPDATE` (SELECT FOR UPDATE) trên rows quan trọng |
| **skipLocked** | Tránh deadlock khi nhiều request cùng variation |
| **Rollback on error** | Mọi validation fail → `t.rollback()` trước return |
| **No distributed TX** | Không cần 2PC vì single database |

### 7.2. Các điểm dùng transaction

| Nghiệp vụ | File | Lock target |
|-----------|------|-------------|
| Tạo đơn hàng | `orderController.createOrder` | `product_variations` (stock) |
| Hủy đơn (user) | `orderController.cancelOrder` | `orders`, `product_variations` |
| Đổi payment method | `orderController.changePaymentMethod` | `orders`, `payments` |
| Cập nhật địa chỉ | `orderController.updateShippingAddress` | `orders` |
| Retry VNPay | `orderController.retryVnpayPayment` | `orders`, `payments` |
| Cron release | `releaseReservations.js` | `orders`, `product_variations`, `payments` |
| Admin create product | `adminController.createProduct` | Multi-table |
| Admin update product | `adminController.updateProduct` | Multi-table |

### 7.3. Advisory Lock (Cron)

```sql
SELECT pg_try_advisory_lock(987654321);  -- acquire
-- ... business logic ...
SELECT pg_advisory_unlock(987654321);    -- release
```

**Mục đích:** Ngăn 2 instance server chạy cron `releaseReservations` đồng thời (khi scale horizontal).

### 7.4. Fire-and-forget (ngoài transaction)

Các tác vụ **không nằm trong transaction** — chạy async sau commit:

| Tác vụ | Pattern | Rủi ro |
|--------|---------|--------|
| Gửi email xác nhận đơn | `.catch(err => console.error(...))` | Email có thể fail silently |
| Tăng view_count | `.catch(() => {})` | Counter có thể thiếu chính xác |
| Gửi email cập nhật đơn | `.catch(...)` | Tương tự |

> Xem thêm: [`event-driven-architecture.md`](./event-driven-architecture.md) — mục "Side-effect ngoài transaction".

---

## 8. Quản lý tồn kho (Inventory)

### 8.1. Mô hình tồn kho

LaptopStore dùng **Immediate Deduction** (trừ kho ngay khi tạo đơn), không dùng reserved/available split columns.

```
stock_quantity = số lượng thực tế có thể bán
```

| Sự kiện | Hành động trên stock_quantity |
|---------|-------------------------------|
| Tạo đơn (COD/VNPay) | `decrement(by: quantity)` |
| Hủy đơn (user) | `increment(by: quantity)` |
| Cron VNPay hết hạn | `increment(by: quantity)` |
| Admin refund | **Không hoàn kho** (chỉ đổi payment_status) |

### 8.2. Luồng giữ kho VNPay

```
Tạo đơn VNPay
  → status = AWAITING_PAYMENT
  → reserve_expires_at = now + 24 hours
  → stock_quantity -= qty (ngay lập tức)

Cron (mỗi 2 phút):
  WHERE status = 'AWAITING_PAYMENT'
    AND reserve_expires_at < now()
  → stock_quantity += qty
  → payment.status = 'failed'
  → order.status = 'cancelled'
  → reserve_expires_at = null
```

### 8.3. Chống overselling

| Cơ chế | Mô tả |
|--------|-------|
| Pre-check stock | Validate `stock_quantity >= quantity` trước khi reserve |
| Row-level lock | `SELECT FOR UPDATE` trên `product_variations` |
| Transaction atomicity | Trừ kho + tạo order + tạo payment trong 1 TX |
| skipLocked | Request thứ 2 vào cùng SKU bị skip thay vì block |

### 8.4. So sánh với Redis-based hold

| | LaptopStore | Redis hold pattern |
|--|-------------|-------------------|
| Hold mechanism | Trừ trực tiếp DB | Reserve key TTL 15 phút |
| Expiry | Cron scan `reserve_expires_at` | Redis TTL auto-expire |
| Complexity | Thấp | Trung bình |
| Multi-instance | Advisory lock cho cron | Redis atomic |

---

## 9. Migration & Schema Evolution

### 9.1. Cơ chế hiện tại

| Cơ chế | Mô tả | Khi nào dùng |
|--------|-------|--------------|
| **Sequelize sync alter** | `sequelize.sync({ alter: true })` | Chỉ khi `DB_SYNC_ALTER=true` |
| **Model-driven** | Schema định nghĩa trong `server/models/*.js` | Development |
| **init.sql** | Docker mount `./server/init.sql` | **File không tồn tại** |
| **Sequelize CLI migrations** | `@sequelize/cli` trong devDependencies | **Chưa có migration files** |

### 9.2. Startup behavior

```javascript
// server/server.js
await sequelize.authenticate()

if (DB_SYNC_ALTER === 'true') {
  await sequelize.sync({ alter: true })  // CHẬM trên Neon remote
} else {
  // Skip sync — schema assumed stable
}
```

### 9.3. Khuyến nghị cải tiến

| Ưu tiên | Hành động |
|---------|-----------|
| Cao | Tạo Sequelize migrations versioned thay vì `sync({ alter: true })` |
| Cao | Tạo `server/init.sql` hoặc seed script cho Docker local |
| Trung bình | Seed data: provinces, wards, roles, admin user (`seedAdmin.js`) |
| Thấp | Flyway/Liquibase nếu team lớn hơn |

### 9.4. Seed scripts hiện có

| Script | Mục đích | Command |
|--------|----------|---------|
| `seedAdmin.js` | Tạo admin mặc định | `npm run seed:admin` |

**Admin mặc định:** `super_admin` / `admin@laptopstore.com` — role `admin`.

---

## 10. Indexing & Performance

### 10.1. Index đã định nghĩa trong model

| Bảng | Index | Loại |
|------|-------|------|
| `payments` | `(provider, txn_ref)` | Unique |

### 10.2. Index khuyến nghị (chưa verify trong code)

| Bảng | Cột | Lý do |
|------|-----|-------|
| `products` | `slug` | Lookup by slug (đã UNIQUE) |
| `products` | `category_id`, `brand_id` | Filter catalog |
| `product_variations` | `product_id` | Join variations |
| `product_variations` | `(is_available, price)` | Catalog filter + sort |
| `orders` | `(user_id, status)` | Order list tabs |
| `orders` | `(status, reserve_expires_at)` | Cron release query |
| `order_items` | `order_id` | Order detail |
| `cart_items` | `cart_id` | Cart lookup |
| `questions` | `product_id` | Q&A by product |

### 10.3. Query patterns nặng

| Query | Controller | Optimization |
|-------|------------|--------------|
| Product list v2 + filters | `productController.getProductsV2` | Pagination + indexed WHERE |
| Facets aggregation | `getProductFacets` | COUNT GROUP BY — có thể cache |
| Admin analytics | `adminController.getDashboardAnalytics` | Aggregate queries — Recharts data |
| KNN training | `train_recommend.py` | Full table scan — chạy offline |

### 10.4. Connection pool

```javascript
// server/config/database.js
pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
```

**Lưu ý Neon Serverless:** Pool nhỏ phù hợp; tránh mở quá nhiều connection khi scale.

---

## 11. Backup, HA & Môi trường

### 11.1. Môi trường database

| Môi trường | Provider | Connection var | Database name |
|-------------|----------|----------------|---------------|
| Production | Neon Serverless | `NEON_DATABASE_URL` | `neondb` (typical) |
| Docker local | postgres:15-alpine | `DATABASE_URL` | `laptop_store` |
| CI (GitHub Actions) | postgres:15 service | `DATABASE_URL` | `test_db` |

### 11.2. Env var inconsistency

| Component | Biến thực tế | Biến trong docker-compose |
|-----------|--------------|---------------------------|
| server | `NEON_DATABASE_URL` | `DATABASE_URL` |
| recommendation | `DATABASE_URL` | `DATABASE_URL` |

> **Action item:** Chuẩn hóa một tên biến hoặc hỗ trợ cả hai trong `database.js`.

### 11.3. Backup strategy (khuyến nghị)

| Môi trường | Strategy |
|------------|----------|
| Neon production | Point-in-time recovery (Neon built-in) |
| Docker local | Volume `postgres_data` — backup manual `pg_dump` |
| ML artifacts | Backup `artifacts/` riêng — không nằm trong DB |

### 11.4. High Availability

| Aspect | Hiện tại | Khuyến nghị |
|--------|----------|-------------|
| DB HA | Neon managed | — |
| App HA | Single instance + Docker restart | Multiple server instances + load balancer |
| Cron singleton | Advisory lock | ✅ Đã có |
| Read scaling | Chưa có replica | Neon read replica khi traffic cao |

---

## 12. Dữ liệu bên ngoài DB

Không phải mọi dữ liệu đều nằm trong PostgreSQL:

| Storage | Dữ liệu | Owner | Lifecycle |
|---------|---------|-------|-----------|
| **Cloudinary** | Product images, category icons, brand logos | server | URL lưu trong DB |
| **ML Artifacts** | `products_df_from_db.pkl`, `scaler.joblib`, `knn_*.npy` | recommendation_service | Regenerate bằng `train_recommend.py` |
| **Benchmark JSON** | `cpu_benchmark.json`, `gpu_benchmark.json` | recommendation_service | Static, commit trong repo |
| **localStorage (FE)** | JWT token, user, compare list, pendingCheckout | client | Browser-side |
| **VNPay** | Transaction records | External | Chỉ mirror qua `payments` table |

### 12.1. Cloudinary — Image Storage Strategy

```
Upload flow:
  Admin upload → multer → Cloudinary → URL returned → save URL in DB

Tables storing URLs:
  products.thumbnail_url
  product_images.image_url
  categories.icon_url
  brands.logo_url
  users.avatar_url
```

**Không lưu binary trong PostgreSQL** — chỉ lưu URL string.

### 12.2. ML Artifacts Strategy

```
Training (offline):
  PostgreSQL → train_recommend.py → artifacts/

Runtime (online):
  artifacts/ loaded at import-time in core/recommend.py
  Fresh items: runtime SQL query (not in index)
```

**Re-train trigger:** Khi catalog thay đổi đáng kể (new products, price updates). Không auto-trigger hiện tại.

---

## 13. Hạn chế hiện tại & Lộ trình cải tiến

### 13.1. Hạn chế

| # | Hạn chế | Impact |
|---|---------|--------|
| 1 | Shared DB giữa server và ML service | Coupling, ML query có thể ảnh hưởng DB chính |
| 2 | Không có migration files | Schema drift risk giữa environments |
| 3 | `init.sql` missing | Docker fresh start không seed data |
| 4 | Không có Redis cache | Facets/catalog query lặp lại |
| 5 | Notification table orphan | Dead schema |
| 6 | Review fields unused | `rating_average`, `review_count` misleading |
| 7 | Tags không expose | Dead junction `product_tags` |
| 8 | Permission model unused | RBAC incomplete |

### 13.2. Lộ trình đề xuất

```mermaid
timeline
  title Database Evolution Roadmap
  section MVP (hiện tại)
    Single PostgreSQL : Sequelize models
    Immediate stock deduction : Cron release
  section Phase 2
    Sequelize migrations : Seed provinces/wards
    Redis cache : Catalog facets
  section Phase 3
    Read replica : ML training offload
    Notification table active : In-app notifs
  section Phase 4
    DB split (optional) : Recommendation read model
    Event sourcing orders : Audit trail
```

---

## Phụ lục A — Danh sách bảng đầy đủ

| # | Bảng | Domain | Rows ước tính (prod) |
|---|------|--------|----------------------|
| 1 | users | Identity | 1K–100K |
| 2 | roles | Identity | ~3 |
| 3 | permissions | Identity | ~10 |
| 4 | user_roles | Identity | = users |
| 5 | role_permissions | Identity | ~20 |
| 6 | products | Catalog | 100–10K |
| 7 | product_variations | Catalog | 500–50K |
| 8 | product_images | Catalog | 500–100K |
| 9 | categories | Catalog | ~20 |
| 10 | brands | Catalog | ~30 |
| 11 | tags | Catalog | 0 (unused) |
| 12 | product_tags | Catalog | 0 (unused) |
| 13 | carts | Commerce | = active users |
| 14 | cart_items | Commerce | Variable |
| 15 | orders | Commerce | Growing |
| 16 | order_items | Commerce | Growing |
| 17 | payments | Commerce | = orders |
| 18 | provinces | Geo | ~63 |
| 19 | wards | Geo | ~10K |
| 20 | questions | Community | Growing |
| 21 | answers | Community | Growing |
| 22 | notifications | Notification | 0 (unused) |

---

## Phụ lục B — Công thức tính tiền (DB perspective)

```
-- Per order item at creation time:
itemTotal       = price × quantity
itemDiscount    = round((price × discount_percentage / 100)) × quantity
itemSubtotal    = itemTotal - itemDiscount

-- Order level:
total_amount    = Σ itemTotal
discount_amount = Σ itemDiscount
subtotal        = total_amount - discount_amount
shipping_fee    = quoteShipping(province_id, ward_id, subtotal)
final_amount    = subtotal + shipping_fee
```

Tất cả giá trị lưu dạng `DECIMAL(16,2)` hoặc `DECIMAL(10,2)`, làm tròn VND (số nguyên) tại application layer.

---

*Tài liệu phản ánh schema và chiến lược database thực tế của dự án `laptop_NEW` tại thời điểm 2026-05-26.*
