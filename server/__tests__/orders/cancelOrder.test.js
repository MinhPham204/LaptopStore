const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  LOCK: { UPDATE: "UPDATE" },
}

jest.mock("../../config/database", () => ({
  transaction: jest.fn(() => Promise.resolve(mockTransaction)),
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
  OrderItem: { findAll: jest.fn() },
  Payment: { findOne: jest.fn() },
  ProductVariation: { findOne: jest.fn() },
  Cart: {},
  CartItem: {},
  Product: {},
}))

const sequelize = require("../../config/database")
const { User, Order, OrderItem, Payment, ProductVariation } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const USER_ID = 42
const ORDER_ID = 100
const OTHER_USER_ID = 99

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

const buildOrder = (overrides = {}) => ({
  order_id: ORDER_ID,
  user_id: USER_ID,
  status: "processing",
  note: "Ghi chú cũ",
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const buildPayment = (overrides = {}) => {
  const payment = {
    provider: "COD",
    payment_status: "pending",
    update: jest.fn(async function updatePayment(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return payment
}

const orderItems = [
  { variation_id: 501, quantity: 2 },
  { variation_id: 502, quantity: 1 },
]

const incrementCalls = []

const setupVariationIncrement = () => {
  incrementCalls.length = 0
  ProductVariation.findOne.mockImplementation(async ({ where }) => {
    const increment = jest.fn().mockResolvedValue(undefined)
    incrementCalls.push({ variation_id: where.variation_id, increment })
    return { variation_id: where.variation_id, increment }
  })
}

const expectStockRestored = () => {
  expect(ProductVariation.findOne).toHaveBeenCalledTimes(2)
  expect(incrementCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ variation_id: 501 }),
      expect.objectContaining({ variation_id: 502 }),
    ])
  )
  const by501 = incrementCalls.find((x) => x.variation_id === 501)
  const by502 = incrementCalls.find((x) => x.variation_id === 502)
  expect(by501.increment).toHaveBeenCalledWith("stock_quantity", {
    by: 2,
    transaction: mockTransaction,
  })
  expect(by502.increment).toHaveBeenCalledWith("stock_quantity", {
    by: 1,
    transaction: mockTransaction,
  })
}

const postCancel = (orderId = ORDER_ID, body = {}, token = signSessionToken()) =>
  request(app)
    .post(`/api/orders/${orderId}/cancel`)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/orders/:order_id/cancel (cancelOrder)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    OrderItem.findAll.mockResolvedValue(orderItems)
    setupVariationIncrement()
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
  })

  // FR: §4 / AC1 — awaiting VNPAY → failed + stock
  it("cancels VNPAY AWAITING_PAYMENT with payment failed and restores stock (AC1, §4)", async () => {
    const order = buildOrder({ status: "AWAITING_PAYMENT" })
    const payment = buildPayment({
      provider: "VNPAY",
      payment_status: "pending",
    })
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postCancel(ORDER_ID, { reason: "Khách tự hủy" })

    expect(res.status).toBe(200)
    expect(res.body.order.payment_status).toBe("failed")
    expect(payment.update).toHaveBeenCalledWith(
      { payment_status: "failed", paid_at: null },
      expect.objectContaining({ transaction: mockTransaction })
    )
    expectStockRestored()
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: §4 / AC2 — COD processing → failed + stock
  it("cancels COD processing order with payment failed and restores stock (AC2, §4)", async () => {
    const order = buildOrder({ status: "processing" })
    const payment = buildPayment({ provider: "COD", payment_status: "pending" })
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Order cancelled successfully")
    expect(res.body.order).toEqual({
      order_id: ORDER_ID,
      status: "cancelled",
      payment_status: "failed",
    })
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
      expect.objectContaining({ transaction: mockTransaction })
    )
    expectStockRestored()
  })

  // FR: §4 / AC3 — VNPAY processing + completed → payment pending + stock
  it("cancels VNPAY processing+completed with payment pending and restores stock (AC3, §4)", async () => {
    const order = buildOrder({ status: "processing" })
    const payment = buildPayment({
      provider: "VNPAY",
      payment_status: "completed",
    })
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(200)
    expect(res.body.order.payment_status).toBe("pending")
    expect(payment.update).toHaveBeenCalledWith(
      { payment_status: "pending" },
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(payment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: "failed" }),
      expect.anything()
    )
    expectStockRestored()
  })

  // FR: §6 — appendNote
  it("appends cancel reason to order note via appendNote (§6)", async () => {
    const order = buildOrder({ status: "processing", note: "Line A" })
    const payment = buildPayment()
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    await postCancel(ORDER_ID, { reason: "Đổi ý" })

    const updateArg = order.update.mock.calls[0][0]
    expect(updateArg.note).toContain("Line A")
    expect(updateArg.note).toContain("[Cancel @")
    expect(updateArg.note).toContain("Đổi ý")
  })

  // FR: §5 — reason trimmed to 500 chars
  it("slices cancel reason to 500 characters (§5)", async () => {
    const order = buildOrder({ status: "processing" })
    const payment = buildPayment()
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const longReason = "R".repeat(600)
    await postCancel(ORDER_ID, { reason: longReason })

    const updateArg = order.update.mock.calls[0][0]
    expect(updateArg.note).toContain("R".repeat(500))
    expect(updateArg.note).not.toContain("R".repeat(501))
  })

  // FR: AC5 — 404
  it("returns 404 when order is not found for user (AC5)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await postCancel(ORDER_ID, {}, signSessionToken(OTHER_USER_ID))

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(ProductVariation.findOne).not.toHaveBeenCalled()
  })

  // FR: AC4 — shipping
  it("returns 400 when order is shipping (AC4)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "shipping" }))
    Payment.findOne.mockResolvedValue(buildPayment())

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order cannot be cancelled in current state.")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: AC4 — delivered
  it("returns 400 when order is delivered (AC4)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "delivered" }))
    Payment.findOne.mockResolvedValue(
      buildPayment({ provider: "VNPAY", payment_status: "completed" })
    )

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order cannot be cancelled in current state.")
  })

  // FR: AC4 — already cancelled
  it("returns 400 when order is already cancelled (AC4)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "cancelled" }))
    Payment.findOne.mockResolvedValue(buildPayment())

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order cannot be cancelled in current state.")
  })

  // FR: §4 — invalid combo VNPAY processing + pending
  it("returns 400 for VNPAY processing with pending payment (§4)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "processing" }))
    Payment.findOne.mockResolvedValue(
      buildPayment({ provider: "VNPAY", payment_status: "pending" })
    )

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order cannot be cancelled in current state.")
  })

  // FR: BR-04 — 401 no token
  it("returns 401 without bearer token (BR-04)", async () => {
    const res = await request(app)
      .post(`/api/orders/${ORDER_ID}/cancel`)
      .send({ reason: "test" })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: BR-04 — 403 inactive user
  it("returns 403 when user is inactive (BR-04)", async () => {
    User.findByPk.mockResolvedValue(
      activeUserRecord({ is_active: false })
    )

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: Error — 500 + rollback
  it("returns 500 when Order.findOne throws", async () => {
    Order.findOne.mockRejectedValue(new Error("DB error"))

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(500)
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})
