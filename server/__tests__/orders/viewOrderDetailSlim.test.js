const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

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
  Order: { findOne: jest.fn() },
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

const USER_ID = 42
const ORDER_ID = 100
const SLIM_URL = `/api/orders/${ORDER_ID}/slim`

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

const reserveExpiresAt = new Date("2026-05-29T12:00:00.000Z")

const buildSlimOrderRow = (overrides = {}) => ({
  toJSON: () => ({
    order_id: ORDER_ID,
    order_code: "ORD-SLIM-100",
    status: "AWAITING_PAYMENT",
    total_amount: "20000000.00",
    discount_amount: "2000000.00",
    final_amount: "18030000.00",
    shipping_fee: "30000.00",
    shipping_name: "Nguyen Van A",
    shipping_phone: "0901234567",
    shipping_address: "123 Street",
    province_id: 79,
    ward_id: 12345,
    geo_lat: "10.776889",
    geo_lng: "106.700806",
    created_at: "2026-05-28T12:00:00.000Z",
    note: "Ghi chú khách",
    reserve_expires_at: reserveExpiresAt,
    payment: {
      provider: "VNPAY",
      payment_method: "VNPAYQR",
      payment_status: "pending",
      amount: "18030000.00",
      txn_ref: "100-1710000000000",
      paid_at: null,
    },
    items: [
      {
        order_item_id: 2,
        variation_id: 11,
        quantity: "1",
        price: "10000000.00",
        discount_amount: "1000000.00",
        subtotal: "9000000.00",
        variation: {
          product: {
            product_id: 5,
            product_name: "Laptop Alpha",
            slug: "laptop-alpha",
            images: [{ image_url: "https://cdn.example/primary.png" }],
            thumbnail_url: "https://cdn.example/fallback.png",
          },
        },
      },
      {
        order_item_id: 1,
        variation_id: 10,
        quantity: "2",
        price: "5000000.00",
        discount_amount: "500000.00",
        subtotal: "9000000.00",
        variation: {
          product: {
            product_id: 4,
            product_name: "Laptop Beta",
            slug: "laptop-beta",
            images: [],
            thumbnail_url: "https://cdn.example/thumb-only.png",
          },
        },
      },
    ],
    ...overrides,
  }),
})

const getFindOptions = () => Order.findOne.mock.calls.at(-1)[0]

describe("GET /api/orders/:order_id/slim (getOrderDetailSlim)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
  })

  // FR: AC §10 / §4 — normalized payload
  it("returns 200 with normalized order, items and payment (AC §10, §4)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.order).toEqual(
      expect.objectContaining({
        order_id: ORDER_ID,
        order_code: "ORD-SLIM-100",
        status: "AWAITING_PAYMENT",
        total_amount: 20_000_000,
        discount_amount: 2_000_000,
        final_amount: 18_030_000,
        shipping_fee: 30_000,
        province_id: 79,
        ward_id: 12345,
      })
    )
    expect(res.body.order.items).toHaveLength(2)
    expect(res.body.order.items[0]).toEqual(
      expect.objectContaining({
        order_item_id: 2,
        variation_id: 11,
        quantity: 1,
        price: 10_000_000,
        product: expect.objectContaining({
          product_name: "Laptop Alpha",
          slug: "laptop-alpha",
        }),
      })
    )
    expect(res.body.order.payment).toEqual({
      provider: "VNPAY",
      payment_method: "VNPAYQR",
      payment_status: "pending",
      amount: 18_030_000,
      txn_ref: "100-1710000000000",
      paid_at: null,
    })
  })

  // FR: §5 — Number() for amounts and geo
  it("coerces decimal strings and geo coordinates to numbers (§5)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.order.geo_lat).toBe(10.776889)
    expect(res.body.order.geo_lng).toBe(106.700806)
    expect(typeof res.body.order.final_amount).toBe("number")
    expect(typeof res.body.order.payment.amount).toBe("number")
  })

  it("returns null geo when geo_lat and geo_lng are missing (§5)", async () => {
    Order.findOne.mockResolvedValue(
      buildSlimOrderRow({ geo_lat: null, geo_lng: null })
    )

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.order.geo_lat).toBeNull()
    expect(res.body.order.geo_lng).toBeNull()
  })

  // FR: §5 — thumbnail priority
  it("prefers product.images[0].image_url over thumbnail_url (§5)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    const withImages = res.body.order.items.find((it) => it.order_item_id === 2)
    const thumbOnly = res.body.order.items.find((it) => it.order_item_id === 1)

    expect(withImages.product.thumbnail_url).toBe("https://cdn.example/primary.png")
    expect(thumbOnly.product.thumbnail_url).toBe("https://cdn.example/thumb-only.png")
  })

  // FR: BR-01 — ownership
  it("queries Order.findOne with order_id and user_id (BR-01)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          order_id: String(ORDER_ID),
          user_id: USER_ID,
        },
      })
    )
  })

  // FR: §3 — items sorted ASC
  it("requests items ordered by order_item_id ASC (§3)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(getFindOptions().order).toEqual([
      [{ model: OrderItem, as: "items" }, "order_item_id", "ASC"],
    ])
    expect(getFindOptions().include).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: OrderItem,
          as: "items",
          include: [
            expect.objectContaining({
              model: ProductVariation,
              as: "variation",
              include: [{ model: Product, as: "product" }],
            }),
          ],
        }),
        expect.objectContaining({ model: Payment, as: "payment" }),
      ])
    )
  })

  // FR: GAP-01 — reserve_expires_at omitted from slim payload
  it("does not include reserve_expires_at in slim order payload (GAP-01)", async () => {
    Order.findOne.mockResolvedValue(buildSlimOrderRow())

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.order.reserve_expires_at).toBeUndefined()
    expect(res.body.order.note).toBeUndefined()
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app).get(SLIM_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: §4 — 404
  it("returns 404 when order is not found (§4)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await request(app)
      .get(SLIM_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
  })
})
