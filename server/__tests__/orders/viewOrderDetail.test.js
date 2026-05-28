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
const DETAIL_URL = `/api/orders/${ORDER_ID}`

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

const buildFullOrder = (overrides = {}) => ({
  order_id: ORDER_ID,
  order_code: "ORD-FULL-100",
  user_id: USER_ID,
  status: "processing",
  total_amount: "20000000.00",
  discount_amount: "2000000.00",
  shipping_fee: "30000.00",
  final_amount: "18030000.00",
  shipping_name: "Nguyen Van A",
  shipping_phone: "0901234567",
  shipping_address: "123 Street",
  note: "Giao trong giờ hành chính",
  reserve_expires_at: "2026-05-29T12:00:00.000Z",
  province_id: 79,
  ward_id: 12345,
  items: [
    {
      order_item_id: 1,
      variation_id: 10,
      quantity: 2,
      price: "10000000.00",
      discount_amount: "1000000.00",
      subtotal: "18000000.00",
      variation: {
        variation_id: 10,
        price: 10000000,
        product: {
          product_id: 3,
          product_name: "Laptop Pro",
          slug: "laptop-pro",
        },
      },
    },
  ],
  payment: {
    payment_id: 5,
    provider: "VNPAY",
    payment_method: "VNPAYQR",
    payment_status: "pending",
    amount: "18030000.00",
    txn_ref: "100-1710000000000",
  },
  ...overrides,
})

const getFindOptions = () => Order.findOne.mock.calls.at(-1)[0]

describe("GET /api/orders/:order_id (getOrderDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
  })

  // FR: AC §10 / BR-01 — 200 full order
  it("returns 200 with full order payload (AC §10)", async () => {
    const orderRow = buildFullOrder()
    Order.findOne.mockResolvedValue(orderRow)

    const res = await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.order).toEqual(orderRow)
    expect(res.body.order.order_id).toBe(ORDER_ID)
  })

  // FR: BR-01 — ownership filter
  it("queries Order.findOne with order_id and user_id (BR-01)", async () => {
    Order.findOne.mockResolvedValue(buildFullOrder())

    await request(app)
      .get(DETAIL_URL)
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

  // FR: BR-03 / BR-04 — includes
  it("includes items with variation and product plus payment (BR-03, BR-04)", async () => {
    Order.findOne.mockResolvedValue(buildFullOrder())

    await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    const options = getFindOptions()
    expect(options.include).toEqual(
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
        expect.objectContaining({
          model: Payment,
          as: "payment",
        }),
      ])
    )
  })

  // FR: §4 — nested items in response
  it("returns nested items with variation and product in response (§4)", async () => {
    Order.findOne.mockResolvedValue(buildFullOrder())

    const res = await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.order.items).toHaveLength(1)
    expect(res.body.order.items[0].variation.product.product_name).toBe("Laptop Pro")
    expect(res.body.order.payment.provider).toBe("VNPAY")
  })

  // FR: §4 — reserve_expires_at and note on full API
  it("returns reserve_expires_at and note when present on order (§4)", async () => {
    Order.findOne.mockResolvedValue(buildFullOrder())

    const res = await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.order.note).toBe("Giao trong giờ hành chính")
    expect(res.body.order.reserve_expires_at).toBe("2026-05-29T12:00:00.000Z")
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app).get(DETAIL_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: AC §10 / BR-02 — 404
  it("returns 404 when order is not found for user (AC §10)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await request(app)
      .get(DETAIL_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
  })
})
