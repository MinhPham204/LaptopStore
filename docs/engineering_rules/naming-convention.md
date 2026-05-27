# Naming Convention — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** Toàn bộ monorepo — database, backend, frontend, DevOps  
> **Liên quan:** [`api-standard.md`](./api-standard.md) · [`backend-convention.md`](./backend-convention.md) · [`frontend-convention.md`](./frontend-convention.md)

---

## Mục lục

1. [Nguyên tắc chung](#1-nguyên-tắc-chung)
2. [Database Naming](#2-database-naming)
3. [Backend Naming](#3-backend-naming)
4. [API Naming](#4-api-naming)
5. [Frontend Naming](#5-frontend-naming)
6. [Environment Variables](#6-environment-variables)
7. [Docker & DevOps](#7-docker--devops)
8. [Git & Branch Naming](#8-git--branch-naming)
9. [ML Service Naming](#9-ml-service-naming)
10. [Bảng tra cứu nhanh](#10-bảng-tra-c cứu-nhanh)

---

## 1. Nguyên tắc chung

| Layer | Case style | Ví dụ |
|-------|------------|-------|
| Database tables & columns | **snake_case** | `product_variations`, `order_id` |
| API paths & query params | **snake_case** | `/products/:product_id`, `?sort_by=` |
| API path segments (multi-word) | **kebab-case** | `/search-suggestions`, `/reset-password` |
| JSON body fields | **snake_case** | `{ variation_id, payment_provider }` |
| Backend files (routes, controllers) | **camelCase** | `productController.js`, `authRoutes.js` |
| Sequelize models | **PascalCase** | `ProductVariation`, `OrderItem` |
| Frontend files | **PascalCase** `.jsx` | `ProductCard.jsx`, `HomePage.jsx` |
| Frontend hooks | **camelCase** `use*` | `useProducts.js`, `useLogin()` |
| Frontend utils | **camelCase** | `formatters.js`, `orderCanCancel.js` |
| Env variables | **SCREAMING_SNAKE_CASE** | `JWT_SECRET`, `NEON_DATABASE_URL` |
| Cloudinary folders | **kebab-case** | `laptop-store/products` |

**Quy tắc vàng:** Database snake_case là source of truth → API JSON snake_case → Frontend map sang camelCase chỉ ở local state nếu cần.

---

## 2. Database Naming

### 2.1. Tables

| Rule | Ví dụ |
|------|-------|
| Plural nouns | `users`, `products`, `orders` |
| snake_case | `product_variations`, `cart_items`, `order_items` |
| Junction tables | `{entity1}_{entity2}` → `user_roles`, `product_tags`, `role_permissions` |

**Danh sách tables:**

```
users, roles, permissions, user_roles, role_permissions
products, product_variations, product_images, product_tags
categories, brands, tags
carts, cart_items
orders, order_items, payments
provinces, wards
questions, answers
notifications
```

### 2.2. Columns

| Rule | Pattern | Ví dụ |
|------|---------|-------|
| Primary key | `{entity}_id` | `product_id`, `user_id`, `order_id` |
| Foreign key | `{referenced_entity}_id` | `category_id`, `variation_id` |
| Boolean | `is_{adjective}` | `is_active`, `is_available`, `is_primary`, `is_answered`, `is_read`, `is_hcm`, `is_free_shipping` |
| Count | `{noun}_count` | `view_count`, `review_count` |
| Timestamp | `{event}_at` | `created_at`, `updated_at`, `paid_at`, `added_at`, `last_login`, `reserve_expires_at` |
| URL fields | `{purpose}_url` | `thumbnail_url`, `avatar_url`, `image_url`, `icon_url`, `logo_url` |
| Amount | `{purpose}_amount` | `total_amount`, `discount_amount`, `final_amount` |
| Hash/secret | `{field}_hash` | `password_hash` |
| Text | `{purpose}_text` | `question_text`, `answer_text` |
| Code | `{entity}_code` | `order_code` |
| JSON | descriptive noun | `specs`, `raw_return`, `raw_ipn` |

### 2.3. ENUM values

| Column | Values | Case |
|--------|--------|------|
| `orders.status` | pending, confirmed, processing, shipping, delivered, cancelled, AWAITING_PAYMENT, PAID, FAILED | mixed* |
| `payments.payment_method` | COD, VNPAYQR, VNBANK, INTCARD, INSTALLMENT, bank_transfer, ... | UPPER/mixed |
| `payments.payment_status` | pending, completed, failed, refunded | lowercase |
| `provinces.region` | south, central, north, highland, island | lowercase |
| `notifications.type` | order, promotion, system, other | lowercase |

`*` Order status có cả lowercase và UPPER_CASE — legacy inconsistency.

### 2.4. Indexes

```
payments_provider_txnref_uk    → unique index on (provider, txn_ref)
```

Pattern: `{table}_{columns}_{type}`

### 2.5. Sequelize model ↔ table mapping

| Model (PascalCase) | Table (snake_case plural) | File |
|------------------|---------------------------|------|
| `User` | `users` | `User.js` |
| `Product` | `products` | `Product.js` |
| `ProductVariation` | `product_variations` | `ProductVariation.js` |
| `OrderItem` | `order_items` | `OrderItem.js` |
| `CartItem` | `cart_items` | `CartItem.js` |

### 2.6. Association aliases

```javascript
as: "category"      // singular
as: "variations"    // plural
as: "items"         // plural
as: "payment"       // singular
as: "user"          // singular
as: "product"       // singular
as: "questions"     // plural
as: "answers"       // plural
as: "orders"        // plural
as: "notifications" // plural
as: "wards"         // plural
as: "parent"        // self-ref singular
as: "children"      // self-ref plural
```

---

## 3. Backend Naming

### 3.1. Files

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Route | `{domain}Routes.js` | `productRoutes.js`, `orderRoutes.js` |
| Route (short) | `{domain}.js` | `geo.js` |
| Controller | `{domain}Controller.js` | `adminController.js` |
| Model | `{Entity}.js` PascalCase | `ProductVariation.js` |
| Service | `{domain}Service.js` | `vnpayService.js` |
| Middleware | `{purpose}.js` | `auth.js`, `upload.js`, `errorHandler.js` |
| Job | `{action}.js` descriptive | `releaseReservations.js` |
| Config | `{purpose}.js` | `database.js`, `passport.js` |
| Utility | `{purpose}.js` | `slugifyVN.js` |
| Seed | `seed{Entity}.js` | `seedAdmin.js` |

### 3.2. Functions & exports

```javascript
// Controller handlers — camelCase verb+noun
exports.getProducts = async (req, res, next) => {}
exports.createOrder = async (req, res, next) => {}
exports.cancelOrder = async (req, res, next) => {}
exports.getRecommendedByVariation = async (req, res, next) => {}

// Service functions — camelCase
function quoteShipping({ province_id, ward_id, subtotal }) {}
function getPaymentUrl({ amount, txnRef, orderDesc, ipAddr }) {}
function sendOrderConfirmationEmail(data) {}

// Middleware — camelCase
const authenticateToken = async (req, res, next) => {}
const authorizeRoles = (...roles) => (req, res, next) => {}
```

### 3.3. Variables

```javascript
// Request data — match DB snake_case
const { variation_id, payment_provider, province_id } = req.body
const { product_id } = req.params
const { page, limit, sort_by } = req.query

// JS local variables — camelCase
const itemsForOrder = []
const finalAmount = 0
const isVnpay = payment_provider === "VNPAY"

// Transaction variable
const t = await sequelize.transaction()       // orderController
const transaction = await sequelize.transaction()  // adminController
```

### 3.4. Constants

```javascript
// UPPER_SNAKE for true constants
const VALID = { COD: ["COD"], VNPAY: ["VNPAYQR", ...] }

// JWT
const generateToken = (userId) => jwt.sign({ userId }, ...)
```

---

## 4. API Naming

### 4.1. URL paths

```
/api/{resource}                          → collection
/api/{resource}/v2                       → versioned collection
/api/{resource}/:id                        → single item
/api/{resource}/:id/{sub-resource}         → nested
/api/{resource}/:id/{action}               → verb action
/api/admin/{resource}                      → admin collection
```

**Ví dụ:**

```
GET    /api/products/v2
GET    /api/products/:id
GET    /api/products/variations/:variation_id/recommendations
POST   /api/products/:id/questions
POST   /api/orders/:order_id/cancel
POST   /api/orders/:order_id/payments/retry
PUT    /api/orders/:order_id/shipping-address
POST   /api/admin/orders/:order_id/ship
GET    /api/provinces/:id/wards
```

### 4.2. Route parameters

| Param | Entity |
|-------|--------|
| `:id` | Generic (product slug or id) |
| `:product_id` | Product |
| `:order_id` | Order |
| `:variation_id` | Product variation |
| `:cart_item_id` | Cart item |
| `:question_id` | Question |
| `:category_id` | Category |
| `:brand_id` | Brand |
| `:role_id` | Role |
| `:user_id` | User |

### 4.3. Query parameters

| Category | Params |
|----------|--------|
| Pagination | `page`, `limit`, `offset`, `perPage` |
| Sort | `sort_by`, `sort`, `order` |
| Filter | `category_id`, `brand_id`, `min_price`, `max_price`, `processor`, `ram`, `storage`, `graphics_card`, `screen_size` |
| Search | `search`, `q` |
| Geo | `province_id`, `ward_id`, `subtotal` |
| Order tabs | `tab` |
| Boolean filter | `answered`, `has_product` |

### 4.4. JSON request/response fields

**Luôn snake_case:**

```json
{
  "user_id": 1,
  "product_name": "MacBook Pro M3",
  "variation_id": 42,
  "payment_provider": "VNPAY",
  "payment_method": "VNPAYQR",
  "shipping_address": "...",
  "shipping_fee": 30000,
  "final_amount": 25000000,
  "order_code": "ORD-20260526-001",
  "thumbnail_url": "https://res.cloudinary.com/...",
  "created_at": "2026-05-26T10:00:00.000Z"
}
```

---

## 5. Frontend Naming

### 5.1. Files

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Page | `{Name}Page.jsx` | `HomePage.jsx`, `CheckoutPage.jsx` |
| Admin page | `Admin{Name}.jsx` | `AdminProducts.jsx`, `AdminOrders.jsx` |
| Admin form page | `Admin{Entity}NewPage.jsx` / `Admin{Entity}EditPage.jsx` | `AdminProductNewPage.jsx` |
| Component | `{Name}.jsx` | `ProductCard.jsx`, `MapPicker.jsx` |
| Hook file | `use{Name}.js` | `useProducts.js`, `useOrders.js` |
| Slice | `{name}Slice.js` | `authSlice.js`, `cartSlice.js` |
| Utility | `{name}.js` camelCase | `formatters.js`, `orderTabs.js`, `cn.js` |
| Service | `{name}.js` | `api.js` |

### 5.2. React components & hooks

```javascript
// Components — PascalCase
function ProductCard() {}
function ProtectedRoute() {}
function EditShippingAddressDialog() {}

// Hooks — camelCase with use prefix
function useProducts() {}
function useProductsV2() {}
function useLogin() {}
function customerUseBrands() {}
function useAdminOrders() {}

// Event handlers — handle + Event
const handleSubmit = () => {}
const handleChange = (e) => {}
const handleAddToCart = (variation) => {}
```

### 5.3. State variables

```javascript
// Local state — camelCase
const [formData, setFormData] = useState({})
const [isLoading, setIsLoading] = useState(false)
const [selectedVariation, setSelectedVariation] = useState(null)

// Filter state — camelCase keys (mapped to snake_case API params in hooks)
const [filters, setFilters] = useState({
  search: "",
  category_id: [],
  minPrice: "",       // → min_price in API
  maxPrice: "",       // → max_price in API
  sortBy: "newest",   // → sort_by in API
  page: 1,
  limit: 12,
})
```

### 5.4. Redux

```javascript
// Slice name — camelCase
name: "auth"     // state.auth
name: "cart"     // state.cart
name: "compare"  // state.compare
name: "ui"       // state.ui

// Actions — camelCase verb
setCredentials, logout, setCart, clearCart, addToCompare, removeFromCompare
toggleSidebar, setTheme

// Selectors — inline in useSelector
const { isAuthenticated, user } = useSelector(state => state.auth)
const { items } = useSelector(state => state.compare)
```

### 5.5. React Query keys

```javascript
// Pattern: [domain, ...scopes/filters]
["products", filters]
["products-v2", filters]
["product", id]
["cart", user?.user_id]
["orders", user?.user_id, params]
["order", orderId]
["order-counters", user?.user_id]
["admin-orders", params]
["admin-analytics"]
["categories"]
["brands"]
["facets", filters]
["recommendations", variationId]
["search-suggestions", query]
["admin-users", params]
["admin-questions", params]
```

### 5.6. CSS / Tailwind

Không đặt tên custom CSS classes mới ngoài `index.css` component layer. Dùng Tailwind utilities trực tiếp.

Component classes đã định nghĩa: `.btn-primary`, `.input-field`, `.card`, `.badge-*`, `.product-desc`.

---

## 6. Environment Variables

### 6.1. Backend (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `NEON_DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | JWT signing |
| `PORT` | Server port (default 5000) |
| `DB_SYNC_ALTER` | Enable sequelize.sync alter |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `CLOUDINARY_KEY` | Cloudinary API key |
| `CLOUDINARY_SECRET` | Cloudinary API secret |
| `VNP_TMN_CODE` | VNPay terminal code |
| `VNP_HASHSECRET` | VNPay hash secret |
| `VNP_PAYURL` | VNPay payment URL |
| `VNP_RETURNURL` | VNPay return URL |
| `FE_APP_URL` | Frontend URL for redirects |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth |
| `FACEBOOK_CALLBACK_URL` | Facebook OAuth callback |
| `EMAIL_HOST/PORT/SECURE/USER/PASS/FROM` | SMTP config |
| `RECO_API_BASE` | ML service URL |
| `RECO_TIMEOUT_MS` | ML proxy timeout |

### 6.2. Frontend (`client/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Axios base URL |
| `VITE_BACKEND_URL` | OAuth redirect base |

### 6.3. Recommendation service

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL for training/runtime |
| `PORT` | Flask port |
| `RECS_TOPK` | Number of recommendations |
| `RECS_ALPHA_PRICE` | Price weight in KNN |
| `RECS_BETA_PERF` | Performance weight |
| `ARTIFACTS_DIR` | ML artifacts path |
| `DATA_DIR` | Benchmark JSON path |

### 6.4. Naming inconsistencies (cần chuẩn hóa)

| Code uses | Docker/env-example uses |
|-----------|------------------------|
| `NEON_DATABASE_URL` | `DATABASE_URL` |
| `CLOUDINARY_NAME` | `CLOUDINARY_CLOUD_NAME` |
| `VNP_TMN_CODE` | `VNPAY_TMN_CODE` |
| `RECO_API_BASE` | `RECOMMENDATION_SERVICE_URL` |
| `VITE_API_URL` | `VITE_API_BASE_URL` |

---

## 7. Docker & DevOps

### 7.1. Container names

```
laptop_store_postgres
laptop_store_server
laptop_store_recommendation
laptop_store_client
laptop_store_nginx
```

Pattern: `{project}_{service}` snake_case.

### 7.2. Docker images (CI/CD)

```
{DOCKER_USERNAME}/laptop-store-server
{DOCKER_USERNAME}/laptop-store-client
{DOCKER_USERNAME}/laptop-store-recommendation
```

Pattern: `{namespace}/laptop-store-{service}` kebab-case.

### 7.3. Docker network & volumes

```
laptop_network          → bridge network
postgres_data           → named volume
nginx_logs              → named volume
```

### 7.4. Nginx upstream names

```
backend         → server:5000
recommendation  → recommendation:5001
client          → (static proxy)
```

---

## 8. Git & Branch Naming

| Pattern | Ví dụ | Usage |
|---------|-------|-------|
| `main` | — | Production branch |
| `develop` | — | Development branch |
| `feature/{description}` | `feature/vnpay-ipn` | New features |
| `fix/{description}` | `fix/cart-quantity-bug` | Bug fixes |
| `docs/{description}` | `docs/api-standard` | Documentation |

**Commit messages:** English or Vietnamese, imperative mood — `"Add order cancel flow"`, `"Fix stock reservation cron"`.

---

## 9. ML Service Naming

### 9.1. Python files

| File | Purpose |
|------|---------|
| `app.py` | Flask entry |
| `train_recommend.py` | Offline training |
| `core/recommend.py` | KNN core logic |
| `core/features.py` | Performance score |
| `core/knn_numpy.py` | Distance calculation |
| `core/bench.py` | Benchmark lookup |
| `core/rules.py` | Rule-based fallback |
| `core/recency.py` | Fresh item scoring |
| `core/db.py` | Database queries |
| `core/config.py` | Hyperparameters |

### 9.2. Python functions

```python
# snake_case (Python convention)
def recommend_core(var_id: int): ...
def calculate_perf_from_mapping_or_rule(row): ...
def fetch_one_variation_from_db(variation_id): ...
def quote_shipping(...): ...  # (in Node, but same pattern)
```

### 9.3. Artifacts

```
artifacts/products_df_from_db.pkl
artifacts/scaler.joblib
artifacts/knn_X_all.npy
artifacts/knn_variation_ids.npy
```

Pattern: `{purpose}_{description}.{ext}` snake_case.

### 9.4. Benchmark data

```
data/cpu_benchmark.json
data/gpu_benchmark.json
```

---

## 10. Bảng tra cứu nhanh

| Entity | DB table | DB PK | API path param | Model | FE hook key |
|--------|----------|-------|----------------|-------|-------------|
| User | `users` | `user_id` | — | `User` | `["cart", user_id]` |
| Product | `products` | `product_id` | `:id` | `Product` | `["product", id]` |
| Variation | `product_variations` | `variation_id` | `:variation_id` | `ProductVariation` | — |
| Order | `orders` | `order_id` | `:order_id` | `Order` | `["order", orderId]` |
| Cart item | `cart_items` | `cart_item_id` | `:cart_item_id` | `CartItem` | — |
| Category | `categories` | `category_id` | `:category_id` | `Category` | `["categories"]` |
| Brand | `brands` | `brand_id` | `:brand_id` | `Brand` | `["brands"]` |
| Payment | `payments` | `payment_id` | — | `Payment` | — |
| Question | `questions` | `question_id` | `:question_id` | `Question` | — |
| Province | `provinces` | `province_id` | `:id` | `Province` | — |
| Ward | `wards` | `ward_id` | — | `Ward` | — |
| Role | `roles` | `role_id` | `:role_id` | `Role` | — |

---

## Phụ lục — VNPay naming

| Concept | Field name | Ví dụ |
|---------|------------|-------|
| Transaction reference | `txn_ref` | `"42-1716700000000"` |
| VNPay transaction no | `transaction_id` / `vnp_TransactionNo` | |
| Provider | `provider` | `"VNPAY"` |
| Payment method | `payment_method` | `"VNPAYQR"` |
| Return payload | `raw_return` | JSONB |
| IPN payload | `raw_ipn` | JSONB (unused) |

---

*Phản ánh naming conventions thực tế across toàn bộ monorepo `laptop_NEW`.*
