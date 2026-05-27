# Backend Convention — LaptopStore (laptop_NEW)

> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 2026-05-26  
> **Phạm vi:** `server/` — Express + Sequelize backend  
> **Liên quan:** [`api-standard.md`](./api-standard.md) · [`naming-convention.md`](./naming-convention.md) · [`commerce-object-storage.md`](./commerce-object-storage.md)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Entry Point & Startup](#3-entry-point--startup)
4. [Routes](#4-routes)
5. [Controllers](#5-controllers)
6. [Services](#6-services)
7. [Models & ORM](#7-models--orm)
8. [Middleware](#8-middleware)
9. [Background Jobs](#9-background-jobs)
10. [Configuration](#10-configuration)
11. [Error Handling](#11-error-handling)
12. [Transaction & Concurrency](#12-transaction--concurrency)
13. [Testing & Scripts](#13-testing--scripts)
14. [Anti-patterns & Known Issues](#14-anti-patterns--known-issues)

---

## 1. Tổng quan

Backend LaptopStore là **Express.js monolith** dùng **Sequelize ORM** kết nối **PostgreSQL**. Pattern chính: **MVC + thin service layer**.

| Aspect | Choice |
|--------|--------|
| Runtime | Node.js 18+ |
| Module system | CommonJS (`require` / `module.exports`) |
| Framework | Express 4 |
| ORM | Sequelize 6 |
| Auth | JWT + Passport OAuth |
| Style | Async/await, functional exports |

---

## 2. Cấu trúc thư mục

```
server/
├── server.js                 # Entry point
├── seedAdmin.js              # Seed script
├── package.json
├── Dockerfile
├── config/
│   ├── database.js           # Sequelize instance
│   └── passport.js           # OAuth strategies
├── routes/
│   ├── authRoutes.js
│   ├── authSocialRoutes.js
│   ├── productRoutes.js
│   ├── cartRoutes.js
│   ├── orderRoutes.js
│   ├── adminRoutes.js
│   ├── geo.js
│   ├── vnpayRoutes.js
│   └── shippingRoutes.js
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── cartController.js
│   ├── orderController.js
│   ├── adminController.js
│   ├── questionsController.js
│   ├── vnpayController.js
│   └── shippingController.js
├── models/
│   ├── index.js              # Registry + associations
│   ├── User.js, Product.js, Order.js, ...
│   └── (18 model files)
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── upload.js
├── services/
│   ├── vnpayService.js
│   ├── shippingService.js
│   └── emailService.js
├── jobs/
│   └── releaseReservations.js
└── utils/
    └── slugifyVN.js
```

### Quy tắc đặt file

| Loại | Convention | Ví dụ |
|------|------------|-------|
| Route | `{domain}Routes.js` hoặc `{domain}.js` | `productRoutes.js`, `geo.js` |
| Controller | `{domain}Controller.js` | `orderController.js` |
| Model | PascalCase entity name | `ProductVariation.js` |
| Service | `{domain}Service.js` | `shippingService.js` |
| Middleware | descriptive name | `auth.js`, `upload.js` |
| Job | descriptive name | `releaseReservations.js` |
| Config | descriptive name | `database.js`, `passport.js` |

---

## 3. Entry Point & Startup

**File:** `server/server.js`

```javascript
// Thứ tự startup
require("dotenv").config()
const sequelize = require("./config/database")

// 1. Load cron job (side-effect import)
require("./jobs/releaseReservations")

// 2. Middleware global
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

// 3. Mount routes
app.use("/api/auth", authRoutes)
// ...

// 4. Health check
app.get("/api/health", ...)

// 5. Error handler (CUỐI CÙNG)
app.use(errorHandler)

// 6. DB connect + optional sync + listen
await sequelize.authenticate()
if (DB_SYNC_ALTER === "true") await sequelize.sync({ alter: true })
app.listen(PORT)
```

**Scripts (`package.json`):**

| Script | Command | Mục đích |
|--------|---------|----------|
| `start` | `node server.js` | Production |
| `dev` | `nodemon server.js` | Development |
| `seed:admin` | `node seedAdmin.js` | Tạo admin user |
| `debug` | `node --inspect=9229 server.js` | Debug |

---

## 4. Routes

### 4.1. Route file pattern

```javascript
const express = require("express")
const router = express.Router()
const controller = require("../controllers/productController")
const { authenticateToken } = require("../middleware/auth")

// Static/specific routes TRƯỚC dynamic routes
router.get("/facets", controller.getProductFacets)
router.get("/v2", controller.getProductsV2)
router.get("/:id", controller.getProductDetail)

module.exports = router
```

### 4.2. Router-level middleware

```javascript
// cartRoutes.js — toàn bộ router cần auth
router.use(authenticateToken)

// adminRoutes.js — auth + role
router.use(authenticateToken)
router.use(authorizeRoles("admin", "manager"))
```

### 4.3. Inline handlers (geo)

`routes/geo.js` viết handler trực tiếp — không qua controller file. Chấp nhận cho routes đơn giản (< 30 dòng).

### 4.4. Validation on route

```javascript
// authRoutes.js — express-validator rules trên route
router.post("/register", registerValidation, authController.register)
```

---

## 5. Controllers

### 5.1. Export pattern

```javascript
// Named async exports — KHÔNG dùng class
exports.getProducts = async (req, res, next) => {
  try {
    // ...
    return res.json({ products, pagination })
  } catch (error) {
    next(error)
  }
}
```

### 5.2. Handler + multer array

Admin upload kết hợp multer middleware:

```javascript
exports.createProduct = [
  uploadProductFiles,
  async (req, res, next) => {
    try {
      const thumbnail_url = req.files?.thumbnail?.[0]?.path  // Cloudinary URL
      // ...
    } catch (error) {
      next(error)
    }
  }
]
```

### 5.3. Controller responsibilities

| Nên làm | Không nên |
|---------|-----------|
| Parse req params/query/body | Business logic phức tạp → extract service |
| Validate input | Direct SQL queries (dùng Sequelize) |
| Orchestrate models + services | HTTP concerns trong service |
| Return appropriate status codes | Catch và nuốt errors |
| Call `next(error)` on failure | Multiple responsibilities per handler |

### 5.4. Controller map

| Controller | Lines (approx) | Complexity |
|------------|----------------|------------|
| `orderController.js` | ~1360 | High — transactions, VNPay, stock |
| `adminController.js` | ~1350 | High — CRUD, analytics, uploads |
| `productController.js` | ~900 | High — filters, Q&A, recommend proxy |
| `authController.js` | ~500 | Medium — JWT, email, OAuth |
| `cartController.js` | ~200 | Low |
| `vnpayController.js` | ~90 | Low |
| `shippingController.js` | ~30 | Low |
| `questionsController.js` | ~200 | Medium |

### 5.5. Dynamic require pattern

Tránh circular dependency cho email:

```javascript
// Trong orderController, sau commit
const { sendOrderConfirmationEmail } = require("../services/emailService")
sendOrderConfirmationEmail({ ... }).catch(err => console.error("Email failed:", err))
```

---

## 6. Services

### 6.1. Khi nào tạo service

| Tạo service khi | Giữ trong controller khi |
|-----------------|--------------------------|
| Logic tái sử dụng (shipping quote) | CRUD đơn giản |
| Tích hợp bên ngoài (VNPay, email) | One-off validation |
| Pure function, dễ test | Tightly coupled to req/res |

### 6.2. Service export pattern

```javascript
// services/shippingService.js
async function quoteShipping({ province_id, ward_id, subtotal }) {
  // ...
  return { shipping_fee, reason? }
}

module.exports = { quoteShipping }
```

```javascript
// services/vnpayService.js
async function getPaymentUrl({ amount, txnRef, orderDesc, ipAddr }) { ... }
function verifyReturnUrl(queryParams) { ... }
module.exports = { getPaymentUrl, verifyReturnUrl }
```

### 6.3. Services hiện có

| Service | Functions | Used by |
|---------|-----------|---------|
| `shippingService.js` | `quoteShipping` | orderController, shippingController |
| `vnpayService.js` | `getPaymentUrl`, `verifyReturnUrl` | orderController, vnpayController |
| `emailService.js` | `sendOrderConfirmationEmail`, `sendOrderUpdateEmail` | orderController, adminController |

**Không có:** repository layer, DI container, service base class.

---

## 7. Models & ORM

### 7.1. Model file pattern

```javascript
const { DataTypes } = require("sequelize")
const sequelize = require("../config/database")

const Product = sequelize.define("Product", {
  product_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_name: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  // ...
}, {
  tableName: "products",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})

module.exports = Product
```

### 7.2. Registry & associations

**File:** `models/index.js`

- Import tất cả models
- Define associations (`belongsTo`, `hasMany`, `belongsToMany`)
- Export `{ sequelize, User, Product, ... }`

```javascript
Product.hasMany(ProductVariation, { foreignKey: "product_id", as: "variations" })
ProductVariation.belongsTo(Product, { foreignKey: "product_id", as: "product" })
User.belongsToMany(Role, { through: "user_roles", foreignKey: "user_id" })
```

### 7.3. Query patterns

```javascript
// Eager loading
Product.findByPk(id, {
  include: [
    { model: ProductVariation, as: "variations" },
    { model: ProductImage, as: "images" },
    { model: Category, as: "category" },
    { model: Brand, as: "brand" },
  ],
})

// Pagination
const { count, rows } = await Product.findAndCountAll({
  where, limit, offset, order,
})

// Row lock (trong transaction)
const v = await ProductVariation.findOne({
  where: { variation_id },
  transaction: t,
  lock: t.LOCK.UPDATE,
  skipLocked: true,
})
```

### 7.4. Hooks

```javascript
// User.js — password hashing
hooks: {
  beforeCreate: async (user) => {
    if (user.password_hash) {
      user.password_hash = await bcrypt.hash(user.password_hash, 10)
    }
  },
}
```

### 7.5. Instance methods

```javascript
// User.js
User.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash)
}
```

---

## 8. Middleware

### 8.1. Global middleware (server.js)

| Middleware | Purpose |
|------------|---------|
| `cors()` | Cross-origin requests |
| `express.json()` | Parse JSON body |
| `express.urlencoded()` | Parse form body |
| `passport.initialize()` | OAuth |

### 8.2. Auth middleware

```javascript
// authenticateToken → req.user, req.userId, req.userRoles
// authorizeRoles("admin", "manager") → 403 if no matching role
```

### 8.3. Upload middleware

Chi tiết: [`commerce-object-storage.md`](./commerce-object-storage.md).

```javascript
const { uploadProductFiles } = require("../middleware/upload")
// Dùng trong controller array: [uploadProductFiles, async handler]
```

### 8.4. Error handler

4-argument middleware — **phải** đặt sau tất cả routes:

```javascript
const errorHandler = (err, req, res, next) => { ... }
app.use(errorHandler)
```

---

## 9. Background Jobs

### 9.1. Cron job pattern

**File:** `jobs/releaseReservations.js`

```javascript
const cron = require("node-cron")

cron.schedule("*/2 * * * *", async () => {
  await withPgAdvisoryLock(987654321, async () => {
    const t = await sequelize.transaction()
    try {
      // business logic
      await t.commit()
    } catch (e) {
      await t.rollback()
      console.error("[releaseReservations] error:", e.message)
    }
  })
})
```

**Load:** Side-effect import trong `server.js` — không export, không start/stop API.

### 9.2. Quy tắc job mới

- File trong `jobs/`
- Import trong `server.js`
- Dùng advisory lock nếu có thể chạy multi-instance
- Transaction cho DB writes
- Log errors với prefix `[jobName]`

---

## 10. Configuration

### 10.1. Environment variables

| Variable | Required | File |
|----------|----------|------|
| `NEON_DATABASE_URL` | ✅ | `config/database.js` |
| `JWT_SECRET` | ✅ | `middleware/auth.js`, controllers |
| `PORT` | — (default 5000) | `server.js` |
| `DB_SYNC_ALTER` | — | `server.js` |
| `CLOUDINARY_NAME/KEY/SECRET` | Upload | `middleware/upload.js` |
| `VNP_TMN_CODE`, `VNP_HASHSECRET`, `VNP_PAYURL`, `VNP_RETURNURL` | VNPay | `services/vnpayService.js` |
| `FE_APP_URL` | OAuth/VNPay redirect | controllers |
| `GOOGLE_*`, `FACEBOOK_*` | OAuth | `config/passport.js` |
| `EMAIL_*` | SMTP | `services/emailService.js` |
| `RECO_API_BASE`, `RECO_TIMEOUT_MS` | ML proxy | `productController.js` |

### 10.2. Config files

```javascript
// config/database.js — export Sequelize instance
module.exports = sequelize

// config/passport.js — side-effect: register strategies
// Imported in server.js: require("./config/passport")
```

**Không có:** centralized config module, config validation on startup (ngoài DB URL check).

---

## 11. Error Handling

### 11.1. Three layers

```
1. Controller validation → return res.status(4xx).json({ message })
2. Controller catch → next(error)
3. Global errorHandler → Sequelize/JWT mapping → 4xx/5xx
```

### 11.2. Logging

- `console.error(err.stack)` trong errorHandler
- `console.error("[context] error:", err.message)` trong jobs/services
- **Không có** structured logging (Winston/Pino)

---

## 12. Transaction & Concurrency

### 12.1. Khi bắt buộc dùng transaction

| Operation | Lý do |
|-----------|-------|
| Create order | Order + items + payment + stock decrement + cart clear |
| Cancel order | Order status + stock restore + payment update |
| Admin create product | Product + variations + images |
| Cron release | Multi-order batch update |

### 12.2. Locking strategy

```javascript
// Pessimistic row lock
lock: t.LOCK.UPDATE        // SELECT ... FOR UPDATE
skipLocked: true           // Skip if another TX holds lock

// Advisory lock (cron singleton)
SELECT pg_try_advisory_lock(987654321)
```

### 12.3. Idempotency

| Flow | Idempotency mechanism |
|------|----------------------|
| VNPay return | Check `payment.payment_status !== "completed"` |
| Cron release | Set `reserve_expires_at = null` after cancel |
| Order cancel | Guard on status + payment state |

---

## 13. Testing & Scripts

### 13.1. Hiện trạng

| Aspect | Status |
|--------|--------|
| Unit tests | ❌ Không có |
| Integration tests | ❌ Không có |
| CI test script | `npm test` → no-op fallback |
| Seed script | ✅ `seedAdmin.js` |

### 13.2. Khuyến nghị

```
server/
├── __tests__/
│   ├── controllers/
│   ├── services/
│   └── integration/
```

---

## 14. Anti-patterns & Known Issues

| Issue | Location | Khuyến nghị |
|-------|----------|-------------|
| Fat controllers | orderController, adminController | Extract domain services |
| Mixed error languages | orderController | Standardize per context |
| `geo.js` inline handlers | routes/geo.js | Move to geoController |
| Dynamic require email | orderController | Static import + lazy init |
| `socket.io` unused dep | package.json | Remove |
| Health check path mismatch | Dockerfile `/health` vs `/api/health` | Fix Dockerfile |
| No request validation middleware | Most routes | Add shared validators |
| Permission model unused | models/Permission.js | Implement or remove |
| FE geo API path mismatch | geoAPI vs geo.js | Align paths |

---

## Phụ lục — Template controller mới

```javascript
// controllers/exampleController.js
const { sequelize, Example } = require("../models")

exports.listExamples = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, parseInt(req.query.limit) || 20)
    const offset = (page - 1) * limit

    const { count, rows } = await Example.findAndCountAll({
      limit, offset,
      order: [["created_at", "DESC"]],
    })

    return res.json({
      examples: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

exports.createExample = async (req, res, next) => {
  const t = await sequelize.transaction()
  try {
    const { name } = req.body
    if (!name) {
      await t.rollback()
      return res.status(400).json({ message: "name is required" })
    }

    const example = await Example.create({ name }, { transaction: t })
    await t.commit()

    return res.status(201).json({
      message: "Example created successfully",
      example,
    })
  } catch (error) {
    await t.rollback()
    next(error)
  }
}
```

---

*Phản ánh conventions thực tế trong `server/` và hướng dẫn cho code mới.*
