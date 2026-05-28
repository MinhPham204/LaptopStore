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
  Payment: { findOne: jest.fn() },
  OrderItem: {},
  ProductVariation: {},
  Cart: {},
  CartItem: {},
  Product: {},
}))

const sequelize = require("../../config/database")
const { getPaymentUrl } = require("../../services/vnpayService")
const { User, Order, Payment } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const USER_ID = 42
const ORDER_ID = 200

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
  order_code: "ORD-RETRY-200",
  status: "AWAITING_PAYMENT",
  final_amount: 15_000_000,
  update: jest.fn(async function updateOrder(data) {
    Object.assign(this, data)
    return this
  }),
  ...overrides,
})

const buildVnpayPayment = (overrides = {}) => ({
  provider: "VNPAY",
  payment_method: "VNPAYQR",
  payment_status: "pending",
  amount: 15_000_000,
  txn_ref: "200-old-ref",
  update: jest.fn(async function updatePayment(data) {
    Object.assign(this, data)
    return this
  }),
  ...overrides,
})

const postRetry = (body = { method: "VNPAYQR" }, orderId = ORDER_ID, token = signSessionToken()) => {
  const req = request(app)
    .post(`/api/orders/${orderId}/payments/retry`)
    .send(body)
  if (token) req.set("Authorization", `Bearer ${token}`)
  return req
}

const setupEligibleOrder = (orderOverrides = {}, paymentOverrides = {}) => {
  const order = buildOrder(orderOverrides)
  const payment = buildVnpayPayment(paymentOverrides)
  Order.findOne.mockResolvedValue(order)
  Payment.findOne.mockResolvedValue(payment)
  return { order, payment }
}

describe("POST /api/orders/:order_id/payments/retry (retryVnpayPayment)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    getPaymentUrl.mockResolvedValue("https://sandbox.vnpayment.vn/pay?retry=1")
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
  })

  // FR: AC §12 — AWAITING_PAYMENT + pending
  it("returns 200 with redirect, order_id, txn_ref and expires_at for AWAITING_PAYMENT (AC §12)", async () => {
    setupEligibleOrder({ status: "AWAITING_PAYMENT" })
    const before = Date.now()

    const res = await postRetry({ method: "VNPAYQR" })

    expect(res.status).toBe(200)
    expect(res.body.redirect).toBe("https://sandbox.vnpayment.vn/pay?retry=1")
    expect(res.body.order_id).toBe(ORDER_ID)
    expect(res.body.txn_ref).toMatch(/^200-\d+$/)
    const expiresMs = new Date(res.body.expires_at).getTime()
    expect(expiresMs - before).toBeGreaterThan(14 * 60 * 1000)
    expect(expiresMs - before).toBeLessThan(16 * 60 * 1000)
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: AC §12 — FAILED + pending
  it("returns 200 for FAILED order with VNPAY pending payment (AC §12)", async () => {
    setupEligibleOrder({ status: "FAILED" })

    const res = await postRetry({ method: "VNBANK" })

    expect(res.status).toBe(200)
    expect(res.body.redirect).toBeTruthy()
    expect(res.body.txn_ref).toMatch(/^200-\d+$/)
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: BR-02 — payment.update txn_ref
  it("updates payment txn_ref with new order_id-timestamp ref (BR-02)", async () => {
    const { payment } = setupEligibleOrder()

    await postRetry({ method: "VNPAYQR" })

    expect(payment.update).toHaveBeenCalledWith(
      { txn_ref: expect.stringMatching(/^200-\d+$/) },
      expect.objectContaining({ transaction: mockTransaction })
    )
    const newRef = payment.update.mock.calls[0][0].txn_ref
    expect(newRef).not.toBe("200-old-ref")
  })

  // FR: §5 — getPaymentUrl args
  it("calls getPaymentUrl with method, amount, txnRef and orderDesc (§5)", async () => {
    const { payment } = setupEligibleOrder({
      status: "AWAITING_PAYMENT",
      final_amount: 12_000_000,
    })
    payment.amount = 12_000_000

    const res = await postRetry({ method: "INTCARD" })

    expect(res.status).toBe(200)
    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "INTCARD",
        amount: 12_000_000,
        txnRef: res.body.txn_ref,
        orderDesc: "Thanh toan don hang ORD-RETRY-200",
      })
    )
  })

  // FR: §4 — default method VNPAYQR
  it("defaults payment method to VNPAYQR when body omits method (§4)", async () => {
    setupEligibleOrder()

    await postRetry({})

    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ method: "VNPAYQR" })
    )
  })

  // FR: BR-01 — order status unchanged
  it("does not call order.update during retry (BR-01)", async () => {
    const { order } = setupEligibleOrder({ status: "AWAITING_PAYMENT" })

    await postRetry()

    expect(order.update).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await postRetry({ method: "VNPAYQR" }, ORDER_ID, null)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await postRetry()

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: §5 — 404
  it("returns 404 when order is not found for user (§5)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await postRetry()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(getPaymentUrl).not.toHaveBeenCalled()
  })

  // FR: §5 — not VNPAY
  it('returns 400 when payment is not VNPAY (§5)', async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "processing" }))
    Payment.findOne.mockResolvedValue(null)

    const res = await postRetry()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Payment record not found or not VNPAY")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §5 — wrong order status
  it("returns 400 Order not eligible when order status is processing (§5)", async () => {
    setupEligibleOrder({ status: "processing" })

    const res = await postRetry()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order not eligible for retry payment")
    expect(getPaymentUrl).not.toHaveBeenCalled()
  })

  // FR: §5 — completed payment
  it("returns 400 Order not eligible when payment is completed (§5)", async () => {
    setupEligibleOrder(
      { status: "AWAITING_PAYMENT" },
      { payment_status: "completed" }
    )

    const res = await postRetry()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Order not eligible for retry payment")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})
