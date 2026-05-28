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
  Order: { findAll: jest.fn() },
  Payment: { name: "Payment" },
  OrderItem: {},
  ProductVariation: {},
  Cart: {},
  CartItem: {},
  Product: {},
}))

const { User, Order, Payment } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const COUNTERS_URL = "/api/orders/counters"
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

const pay = (provider, payment_status) => ({ provider, payment_status })

/** Fixture covering V2 §5 counter rules */
const buildCounterFixtureRows = () => [
  { order_id: 1, status: "AWAITING_PAYMENT", payment: pay("VNPAY", "pending") },
  { order_id: 2, status: "AWAITING_PAYMENT", payment: pay("COD", "pending") },
  { order_id: 3, status: "processing", payment: pay("COD", "pending") },
  { order_id: 4, status: "processing", payment: pay("VNPAY", "completed") },
  { order_id: 5, status: "processing", payment: pay("VNPAY", "pending") },
  { order_id: 6, status: "shipping", payment: pay("COD", "pending") },
  { order_id: 7, status: "shipping", payment: pay("VNPAY", "completed") },
  { order_id: 8, status: "shipping", payment: pay("VNPAY", "pending") },
  { order_id: 9, status: "delivered", payment: pay("VNPAY", "completed") },
  { order_id: 10, status: "delivered", payment: pay("COD", "pending") },
  { order_id: 11, status: "cancelled", payment: pay("COD", "failed") },
  { order_id: 12, status: "FAILED", payment: pay("VNPAY", "failed") },
]

const expectedV2Counters = {
  all: 12,
  awaiting_payment: 1,
  processing: 3,
  to_ship: 2,
  shipping: 2,
  delivered: 1,
  cancelled: 2,
  failed: 1,
}

describe("GET /api/orders/counters (getOrderCountersV2)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
  })

  // FR: §5 / AC §12 — full V2 aggregation
  it("aggregates all tab counters per getOrderCountersV2 rules (§5)", async () => {
    Order.findAll.mockResolvedValue(buildCounterFixtureRows())

    const res = await request(app)
      .get(COUNTERS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(expectedV2Counters)
  })

  // FR: AC §12 — to_ship <= processing
  it("ensures to_ship count is less than or equal to processing (AC §12)", async () => {
    Order.findAll.mockResolvedValue(buildCounterFixtureRows())

    const res = await request(app)
      .get(COUNTERS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.to_ship).toBeLessThanOrEqual(res.body.processing)
  })

  // FR: §5 — awaiting_payment only VNPAY pending
  it("counts awaiting_payment only for AWAITING_PAYMENT with VNPAY pending (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 1, status: "AWAITING_PAYMENT", payment: pay("VNPAY", "pending") },
      { order_id: 2, status: "AWAITING_PAYMENT", payment: pay("COD", "pending") },
    ])

    const res = await request(app)
      .get(COUNTERS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.awaiting_payment).toBe(1)
    expect(res.body.all).toBe(2)
  })

  // FR: §5 — processing + to_ship COD pending
  it("increments processing and to_ship for COD processing with pending payment (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 3, status: "processing", payment: pay("COD", "pending") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.processing).toBe(1)
    expect(res.body.to_ship).toBe(1)
  })

  // FR: §5 — processing + to_ship VNPAY completed
  it("increments processing and to_ship for VNPAY processing with completed payment (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 4, status: "processing", payment: pay("VNPAY", "completed") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.processing).toBe(1)
    expect(res.body.to_ship).toBe(1)
  })

  // FR: §5 V2 — processing VNPAY pending does not add to_ship
  it("increments processing but not to_ship for VNPAY processing with pending payment (§5 V2)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 5, status: "processing", payment: pay("VNPAY", "pending") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.processing).toBe(1)
    expect(res.body.to_ship).toBe(0)
  })

  // FR: §5 — shipping with eligible payment
  it("counts shipping only when payment matches COD pending or VNPAY completed (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 6, status: "shipping", payment: pay("COD", "pending") },
      { order_id: 7, status: "shipping", payment: pay("VNPAY", "completed") },
      { order_id: 8, status: "shipping", payment: pay("VNPAY", "pending") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.shipping).toBe(2)
  })

  // FR: §5 — delivered
  it("counts delivered only when payment_status is completed (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 9, status: "delivered", payment: pay("VNPAY", "completed") },
      { order_id: 10, status: "delivered", payment: pay("COD", "pending") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.delivered).toBe(1)
  })

  // FR: §5 — cancelled and failed
  it("counts cancelled for cancelled and FAILED, and failed only for FAILED (§5)", async () => {
    Order.findAll.mockResolvedValue([
      { order_id: 11, status: "cancelled", payment: pay("COD", "failed") },
      { order_id: 12, status: "FAILED", payment: pay("VNPAY", "failed") },
    ])

    const res = await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.body.cancelled).toBe(2)
    expect(res.body.failed).toBe(1)
  })

  // FR: §3 — findAll query
  it("loads orders with user_id filter, minimal attributes and payment include (§3)", async () => {
    Order.findAll.mockResolvedValue([])

    await request(app).get(COUNTERS_URL).set("Authorization", `Bearer ${signSessionToken()}`)

    expect(Order.findAll).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      include: [{ model: Payment, as: "payment", required: false }],
      attributes: ["order_id", "status"],
    })
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app).get(COUNTERS_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findAll).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await request(app)
      .get(COUNTERS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(Order.findAll).not.toHaveBeenCalled()
  })
})
