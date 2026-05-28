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
const { quoteShipping } = require("../../services/shippingService")
const { User, Order, Payment } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const USER_ID = 42
const ORDER_ID = 300

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
  total_amount: 20_000_000,
  discount_amount: 2_000_000,
  shipping_fee: 30_000,
  final_amount: 18_030_000,
  shipping_name: "Nguyen Van A",
  shipping_phone: "0901111111",
  shipping_address: "123 Old Street",
  province_id: 79,
  ward_id: 12345,
  geo_lat: 10.776889,
  geo_lng: 106.700806,
  update: jest.fn(async function updateOrder(data) {
    Object.assign(this, data)
    return this
  }),
  ...overrides,
})

const buildPayment = (overrides = {}) => ({
  provider: "COD",
  payment_method: "COD",
  payment_status: "pending",
  amount: 18_030_000,
  update: jest.fn(async function updatePayment(data) {
    Object.assign(this, data)
    return this
  }),
  ...overrides,
})

const putShippingAddress = (
  body = {},
  orderId = ORDER_ID,
  token = signSessionToken()
) => {
  const req = request(app)
    .put(`/api/orders/${orderId}/shipping-address`)
    .send(body)
  if (token) req.set("Authorization", `Bearer ${token}`)
  return req
}

const setupOrderPayment = (orderOverrides = {}, paymentOverrides = {}) => {
  const order = buildOrder(orderOverrides)
  const payment = buildPayment(paymentOverrides)
  Order.findOne.mockResolvedValue(order)
  Payment.findOne.mockResolvedValue(payment)
  return { order, payment }
}

describe("PUT /api/orders/:order_id/shipping-address (updateShippingAddress)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    quoteShipping.mockResolvedValue({ shipping_fee: 50_000, reason: "WARD_FEE" })
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
  })

  // FR: AC §12 — 200 success
  it('returns 200 with message and updated order fields (AC §12)', async () => {
    setupOrderPayment()

    const res = await putShippingAddress({
      shipping_name: "Tran Thi B",
      shipping_phone: "0909999888",
      shipping_address: "456 New Street",
      province_id: 79,
      ward_id: 20001,
      geo_lat: 10.82,
      geo_lng: 106.72,
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Shipping address updated")
    expect(res.body.order).toEqual(
      expect.objectContaining({
        order_id: ORDER_ID,
        shipping_name: "Tran Thi B",
        shipping_phone: "0909999888",
        shipping_address: "456 New Street",
        province_id: 79,
        ward_id: 20001,
        shipping_fee: 50_000,
        final_amount: 18_050_000,
      })
    )
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: §6 — partial merge
  it("merges partial body with existing order fields (§6)", async () => {
    const { order } = setupOrderPayment()

    await putShippingAddress({ shipping_name: "Only Name Changed" })

    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_name: "Only Name Changed",
        shipping_phone: "0901111111",
        shipping_address: "123 Old Street",
        province_id: 79,
        ward_id: 12345,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )
  })

  // FR: BR-01 — quoteShipping + final_amount
  it("calls quoteShipping with subtotal and updates final_amount (BR-01)", async () => {
    setupOrderPayment()

    await putShippingAddress({ ward_id: 99999 })

    expect(quoteShipping).toHaveBeenCalledWith({
      province_id: 79,
      ward_id: 99999,
      subtotal: 18_000_000,
    })
  })

  // FR: BR-03 — payment.amount sync when pending
  it("syncs payment.amount when payment is not completed (BR-03)", async () => {
    const { payment } = setupOrderPayment(
      {},
      { provider: "COD", payment_status: "pending", amount: 18_030_000 }
    )

    await putShippingAddress({ ward_id: 20002 })

    expect(payment.update).toHaveBeenCalledWith(
      { amount: 18_050_000 },
      expect.objectContaining({ transaction: mockTransaction })
    )
  })

  // FR: BR-02 — VNPAY completed, ship fee unchanged
  it("returns 200 for VNPAY completed when shipping fee does not change (BR-02)", async () => {
    quoteShipping.mockResolvedValue({ shipping_fee: 30_000 })
    const { payment } = setupOrderPayment(
      { status: "processing" },
      { provider: "VNPAY", payment_status: "completed", amount: 18_030_000 }
    )

    const res = await putShippingAddress({ shipping_name: "New Name Only" })

    expect(res.status).toBe(200)
    expect(payment.update).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await putShippingAddress({ shipping_name: "X" }, ORDER_ID, null)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(Order.findOne).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
  })

  // FR: §5 — 404
  it("returns 404 when order is not found (§5)", async () => {
    Order.findOne.mockResolvedValue(null)

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Order not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: PRE-02 — blocked statuses
  it("returns 400 when order status is shipping (PRE-02)", async () => {
    setupOrderPayment({ status: "shipping" })

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot change shipping address in current state.")
    expect(quoteShipping).not.toHaveBeenCalled()
  })

  it("returns 400 when order status is delivered (PRE-02)", async () => {
    setupOrderPayment({ status: "delivered" })

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot change shipping address in current state.")
  })

  it("returns 400 when order status is cancelled (PRE-02)", async () => {
    setupOrderPayment({ status: "cancelled" })

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot change shipping address in current state.")
  })

  // FR: PRE-03 — province_id required
  it("returns 400 when province_id is missing after merge (PRE-03)", async () => {
    setupOrderPayment({ province_id: null, ward_id: null })

    const res = await putShippingAddress({ shipping_name: "X" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("province_id is required (current or new)")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: BR-02 — VNPAY completed + ship fee change
  it("returns 400 Vietnamese message when VNPAY completed and shipping fee changes (BR-02)", async () => {
    quoteShipping.mockResolvedValue({ shipping_fee: 80_000 })
    setupOrderPayment(
      { status: "processing", shipping_fee: 30_000 },
      { provider: "VNPAY", payment_status: "completed" }
    )

    const res = await putShippingAddress({ ward_id: 30003 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Đơn hàng đã thanh toán VNPAY/)
    expect(res.body.message).toMatch(/phí ship sẽ thay đổi/)
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})
