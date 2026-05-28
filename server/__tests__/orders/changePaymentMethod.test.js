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

jest.mock("../../services/emailService", () => ({
  sendOrderUpdateEmail: jest.fn().mockResolvedValue(undefined),
}))

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
const OTHER_USER_ID = 99

const VNP_ENV_KEYS = [
  "VNP_TMN_CODE",
  "VNP_HASHSECRET",
  "VNP_RETURNURL",
  "VNP_PAYURL",
]

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
  order_code: "ORD-TEST-200",
  status: "processing",
  final_amount: 15_000_000,
  update: jest.fn(async function updateOrder(data) {
    Object.assign(this, data)
    return this
  }),
  ...overrides,
})

const buildPayment = (overrides = {}) => {
  const payment = {
    provider: "COD",
    payment_method: "COD",
    payment_status: "pending",
    amount: 15_000_000,
    _previousDataValues: {
      provider: "COD",
      payment_method: "COD",
    },
    update: jest.fn(async function updatePayment(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return payment
}

const setVnpEnv = () => {
  process.env.VNP_TMN_CODE = "TEST_TMN"
  process.env.VNP_HASHSECRET = "test-hash"
  process.env.VNP_RETURNURL = "http://localhost:3000/vnpay-return"
  process.env.VNP_PAYURL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
}

const clearVnpEnv = () => {
  VNP_ENV_KEYS.forEach((k) => delete process.env[k])
}

const postChangePayment = (body, orderId = ORDER_ID, token = signSessionToken()) =>
  request(app)
    .post(`/api/orders/${orderId}/payment-method`)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/orders/:order_id/payment-method (changePaymentMethod)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setVnpEnv()
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    getPaymentUrl.mockResolvedValue("https://sandbox.vnpayment.vn/pay?v=1")
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
  })

  // FR: AC1 — COD processing → VNPAY
  it("changes COD to VNPAY with AWAITING_PAYMENT and redirect (AC1)", async () => {
    const order = buildOrder({ status: "processing" })
    const payment = buildPayment()
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postChangePayment({
      provider: "VNPAY",
      method: "VNPAYQR",
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Payment method updated")
    expect(res.body.order).toEqual({
      order_id: ORDER_ID,
      status: "AWAITING_PAYMENT",
    })
    expect(res.body.payment).toEqual({
      provider: "VNPAY",
      method: "VNPAYQR",
      status: "pending",
    })
    expect(res.body.redirect).toBe("https://sandbox.vnpayment.vn/pay?v=1")

    expect(order.update).toHaveBeenCalledWith(
      { status: "AWAITING_PAYMENT" },
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "VNPAY",
        payment_method: "VNPAYQR",
        payment_status: "pending",
        txn_ref: expect.stringMatching(/^200-\d+$/),
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "VNPAYQR",
        amount: 15_000_000,
        txnRef: expect.stringMatching(/^200-\d+$/),
        orderDesc: "Thanh toan don hang ORD-TEST-200",
      })
    )
    expect(mockTransaction.commit).toHaveBeenCalled()
    expect(mockTransaction.rollback).not.toHaveBeenCalled()
  })

  // FR: §6 — VNPAY → COD
  it("changes VNPAY to COD with processing status and null redirect (§6)", async () => {
    const order = buildOrder({ status: "AWAITING_PAYMENT" })
    const payment = buildPayment({
      provider: "VNPAY",
      payment_method: "VNPAYQR",
      txn_ref: "200-old",
      _previousDataValues: {
        provider: "VNPAY",
        payment_method: "VNPAYQR",
      },
    })
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postChangePayment({ provider: "COD", method: "COD" })

    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe("processing")
    expect(res.body.payment).toEqual({
      provider: "COD",
      method: "COD",
      status: "pending",
    })
    expect(res.body.redirect).toBeNull()
    expect(getPaymentUrl).not.toHaveBeenCalled()
    expect(payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "COD",
        payment_method: "COD",
        payment_status: "pending",
        transaction_id: null,
        txn_ref: null,
        paid_at: null,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(order.update).toHaveBeenCalledWith(
      { status: "processing" },
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: §5 — 404
  it("returns 404 when order is not found (§5)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await postChangePayment(
      { provider: "COD", method: "COD" },
      ORDER_ID,
      signSessionToken(OTHER_USER_ID)
    )

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(Payment.findOne).not.toHaveBeenCalled()
  })

  // FR: §6 — blocked order states
  it.each([
    ["shipping", "shipping"],
    ["delivered", "delivered"],
    ["cancelled", "cancelled"],
  ])("returns 400 when order status is %s (§6)", async (_label, status) => {
    Order.findOne.mockResolvedValue(buildOrder({ status }))
    Payment.findOne.mockResolvedValue(buildPayment())

    const res = await postChangePayment({ provider: "COD", method: "COD" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot change payment in current state.")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §5 — payment completed
  it("returns 400 when payment is already completed (§5)", async () => {
    Order.findOne.mockResolvedValue(buildOrder())
    Payment.findOne.mockResolvedValue(
      buildPayment({ payment_status: "completed" })
    )

    const res = await postChangePayment({ provider: "VNPAY", method: "VNPAYQR" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(
      "Payment already completed; cannot change method."
    )
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §5 — payment not found
  it("returns 400 when payment record is missing (§5)", async () => {
    Order.findOne.mockResolvedValue(buildOrder())
    Payment.findOne.mockResolvedValue(null)

    const res = await postChangePayment({ provider: "COD", method: "COD" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Payment record not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §5 — unsupported provider
  it("returns 400 for unsupported provider (§5)", async () => {
    const res = await postChangePayment({ provider: "PAYPAL", method: "X" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Unsupported provider: PAYPAL")
    expect(Order.findOne).not.toHaveBeenCalled()
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §5 — invalid method
  it("returns 400 for invalid VNPAY method (§5)", async () => {
    const res = await postChangePayment({
      provider: "VNPAY",
      method: "NOT_A_METHOD",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid method for provider VNPAY")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: §5 — 502 VNPAY config
  it("returns 502 and rolls back when VNPAY env is missing (§5)", async () => {
    clearVnpEnv()
    const order = buildOrder()
    const payment = buildPayment()
    Order.findOne.mockResolvedValue(order)
    Payment.findOne.mockResolvedValue(payment)

    const res = await postChangePayment({
      provider: "VNPAY",
      method: "VNPAYQR",
    })

    expect(res.status).toBe(502)
    expect(res.body.message).toBe("VNPAY configuration error")
    expect(getPaymentUrl).not.toHaveBeenCalled()
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app)
      .post(`/api/orders/${ORDER_ID}/payment-method`)
      .send({ provider: "COD", method: "COD" })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403 inactive
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(
      activeUserRecord({ is_active: false })
    )

    const res = await postChangePayment({ provider: "COD", method: "COD" })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: Error — 500
  it("returns 500 when Order.findOne throws", async () => {
    Order.findOne.mockRejectedValue(new Error("DB error"))

    const res = await postChangePayment({ provider: "COD", method: "COD" })

    expect(res.status).toBe(500)
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})
