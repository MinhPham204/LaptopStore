const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")
const { Op } = require("sequelize")

jest.mock("../../config/database", () => ({
  transaction: jest.fn(),
}))

jest.mock("../../services/shippingService", () => ({
  quoteShipping: jest.fn(),
}))

jest.mock("../../services/vnpayService", () => ({
  getPaymentUrl: jest.fn(),
}))

jest.mock("../../config/socket", () => ({
  getIO: jest.fn(),
}))

jest.mock("../../services/notificationService", () => ({}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Order: { findAndCountAll: jest.fn() },
  OrderItem: { name: "OrderItem" },
  ProductVariation: { name: "ProductVariation" },
  Product: { name: "Product" },
  Payment: { name: "Payment" },
  Cart: {},
  CartItem: {},
}))

const { User, Order, OrderItem, ProductVariation, Product, Payment } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const LIST_URL = "/api/orders"
const USER_ID = 42

const signSessionToken = (userId = USER_ID) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const activeUserRecord = (overrides = {}) => ({
  user_id: USER_ID,
  username: "buyer",
  email: "buyer@example.com",
  is_active: true,
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

const buildOrderRow = (overrides = {}) => ({
  toJSON: () => ({
    order_id: 100,
    order_code: "ORD-LIST-100",
    status: "processing",
    final_amount: "1500000.00",
    shipping_fee: "30000.00",
    created_at: "2026-05-28T12:00:00.000Z",
    reserve_expires_at: "2026-05-29T12:00:00.000Z",
    payment: {
      provider: "COD",
      payment_method: "COD",
      payment_status: "pending",
      txn_ref: null,
    },
    items: [
      {
        variation_id: 10,
        quantity: 1,
        variation: {
          product: {
            product_name: "Laptop Alpha",
            images: [{ image_url: "https://cdn.example/primary.png" }],
            thumbnail_url: "https://cdn.example/fallback.png",
          },
        },
      },
      {
        variation_id: 11,
        quantity: 2,
        variation: {
          product: {
            product_name: "Laptop Beta",
            thumbnail_url: "https://cdn.example/thumb-b.png",
          },
        },
      },
      {
        variation_id: 12,
        quantity: 1,
        variation: {
          product: { product_name: "Laptop Gamma" },
        },
      },
    ],
    ...overrides,
  }),
})

const mockListResult = (rows = [buildOrderRow()], count = rows.length) => {
  Order.findAndCountAll.mockResolvedValue({ count, rows })
}

const getFindOptions = () => Order.findAndCountAll.mock.calls.at(-1)[0]
const getPaymentInclude = (options) => options.include.find((inc) => inc.as === "payment")
const getItemsInclude = (options) => options.include.find((inc) => inc.as === "items")

describe("GET /api/orders (getUserOrdersV2)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    mockListResult()
  })

  // FR: §5 — default list + pagination
  it("returns 200 with orders and pagination for default tab all (§5)", async () => {
    mockListResult([buildOrderRow()], 25)

    const res = await request(app)
      .get(LIST_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
    expect(res.body.orders[0]).toEqual(
      expect.objectContaining({
        order_id: 100,
        order_code: "ORD-LIST-100",
        status: "processing",
        final_amount: 1_500_000,
        shipping_fee: 30_000,
      })
    )
    expect(res.body.pagination).toEqual({
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
    })
  })

  // FR: §6 — items_preview max 2, items_count full
  it("maps items_preview to at most two lines and items_count from all items (§6)", async () => {
    const res = await request(app)
      .get(LIST_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.orders[0].items_preview).toHaveLength(2)
    expect(res.body.orders[0].items_preview[0].product_name).toBe("Laptop Alpha")
    expect(res.body.orders[0].items_count).toBe(3)
  })

  // FR: §6 — thumbnail priority
  it("prefers product.images[0].image_url for items_preview thumbnail (§6)", async () => {
    const res = await request(app)
      .get(LIST_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.orders[0].items_preview[0].thumbnail_url).toBe(
      "https://cdn.example/primary.png"
    )
    expect(res.body.orders[0].items_preview[1].thumbnail_url).toBe(
      "https://cdn.example/thumb-b.png"
    )
  })

  // FR: §5 — reserve_expires_at
  it("includes reserve_expires_at on each order in the list (§5)", async () => {
    const res = await request(app)
      .get(LIST_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.orders[0].reserve_expires_at).toBe("2026-05-29T12:00:00.000Z")
    expect(res.body.orders[0].payment).toEqual(
      expect.objectContaining({
        provider: "COD",
        payment_status: "pending",
      })
    )
  })

  // FR: AC §11 — user_id filter (req.userId)
  it("scopes findAndCountAll to authenticated user_id (AC §11)", async () => {
    await request(app).get(LIST_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.user_id).toBe(USER_ID)
  })

  // FR: §6 — tab all
  it("uses optional payment include for tab all (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=all`).set("Authorization", `Bearer ${signSessionToken()}`)

    const payInc = getPaymentInclude(getFindOptions())
    expect(payInc.required).toBe(false)
    expect(getFindOptions().where.status).toBeUndefined()
  })

  // FR: §6 — awaiting_payment
  it("filters awaiting_payment with VNPAY pending payment (§6)", async () => {
    await request(app)
      .get(`${LIST_URL}?tab=awaiting_payment`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toBe("AWAITING_PAYMENT")
    expect(getPaymentInclude(getFindOptions())).toEqual(
      expect.objectContaining({
        required: true,
        where: { provider: "VNPAY", payment_status: "pending" },
      })
    )
  })

  // FR: §6 — to_ship
  it("filters to_ship as processing with COD pending or VNPAY completed (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=to_ship`).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toBe("processing")
    expect(getPaymentInclude(getFindOptions()).where).toEqual({
      [Op.or]: [
        { provider: "COD", payment_status: "pending" },
        { provider: "VNPAY", payment_status: "completed" },
      ],
    })
  })

  // FR: §6 — shipping
  it("filters shipping tab with same payment rules as to_ship (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=shipping`).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toBe("shipping")
    expect(getPaymentInclude(getFindOptions()).required).toBe(true)
  })

  // FR: §6 — completed
  it("filters completed as delivered with payment completed (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=completed`).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toBe("delivered")
    expect(getPaymentInclude(getFindOptions()).where).toEqual({
      payment_status: "completed",
    })
  })

  // FR: §6 — cancelled
  it("filters cancelled tab with status in cancelled or FAILED (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=cancelled`).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toEqual({
      [Op.in]: ["cancelled", "FAILED"],
    })
  })

  // FR: §6 — failed
  it("filters failed tab with status FAILED (§6)", async () => {
    await request(app).get(`${LIST_URL}?tab=failed`).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where.status).toBe("FAILED")
  })

  // FR: §6 — search q
  it("adds Op.or search on order_code and product_name when q is set (§6)", async () => {
    await request(app)
      .get(`${LIST_URL}?q=ORD-LAPTOP`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().where[Op.or]).toEqual([
      { order_code: { [Op.iLike]: "%ORD-LAPTOP%" } },
      {
        "$items.variation.product.product_name$": {
          [Op.iLike]: "%ORD-LAPTOP%",
        },
      },
    ])
  })

  // FR: §4 — pagination
  it("applies page and limit to findAndCountAll offset and limit (§4)", async () => {
    await request(app)
      .get(`${LIST_URL}?page=2&limit=5`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().limit).toBe(5)
    expect(getFindOptions().offset).toBe(5)
  })

  // FR: §4 — sort
  it("orders by created_at ASC when sort=created_at:asc (§4)", async () => {
    await request(app)
      .get(`${LIST_URL}?sort=created_at:asc`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().order).toEqual([["created_at", "ASC"]])
  })

  // FR: §6 — query shape
  it("uses distinct true, subQuery false and required items include (§6)", async () => {
    await request(app).get(LIST_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    const options = getFindOptions()
    expect(options.distinct).toBe(true)
    expect(options.subQuery).toBe(false)
    expect(getItemsInclude(options)).toEqual(
      expect.objectContaining({
        model: OrderItem,
        as: "items",
        required: true,
        include: [
          expect.objectContaining({
            model: ProductVariation,
            as: "variation",
            include: [{ model: Product, as: "product" }],
          }),
        ],
      })
    )
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findAndCountAll).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await request(app)
      .get(LIST_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(Order.findAndCountAll).not.toHaveBeenCalled()
  })
})
