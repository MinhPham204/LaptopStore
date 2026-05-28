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

jest.mock("../../services/notificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}))

jest.mock("../../services/emailService", () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), findAll: jest.fn() },
  Role: {},
  Order: { create: jest.fn(), findOne: jest.fn() },
  OrderItem: { create: jest.fn(), findAll: jest.fn() },
  Payment: { create: jest.fn(), findOne: jest.fn() },
  ProductVariation: { findByPk: jest.fn(), findOne: jest.fn() },
  Cart: { findOne: jest.fn() },
  CartItem: { findAll: jest.fn(), destroy: jest.fn() },
  Product: {},
}))

const sequelize = require("../../config/database")
const { quoteShipping } = require("../../services/shippingService")
const { getPaymentUrl } = require("../../services/vnpayService")
const {
  User,
  Order,
  OrderItem,
  Payment,
  ProductVariation,
} = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const USER_ID = 42
const ORDER_ID = 501
const VARIATION_ID = 10

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
  full_name: "Nguyen Van A",
  is_active: true,
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

const setVnpEnv = () => {
  process.env.VNP_TMN_CODE = "TEST_TMN"
  process.env.VNP_HASHSECRET = "test-hash"
  process.env.VNP_RETURNURL = "http://localhost:3000/vnpay-return"
  process.env.VNP_PAYURL = "https://sandbox.vnpayment.vn/pay"
}

const clearVnpEnv = () => {
  VNP_ENV_KEYS.forEach((k) => delete process.env[k])
}

const buildVariation = (overrides = {}) => {
  const variation = {
    variation_id: VARIATION_ID,
    price: 10_000_000,
    stock_quantity: 5,
    is_available: true,
    product: { product_name: "Laptop Pro", discount_percentage: 10 },
    decrement: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return variation
}

const validCodBody = (overrides = {}) => ({
  payment_provider: "COD",
  payment_method: "COD",
  shipping_address: "109 Test Street",
  shipping_phone: "0901234567",
  shipping_name: "Nguyen Van A",
  province_id: 79,
  ward_id: 12345,
  geo_lat: 10.776889,
  geo_lng: 106.700806,
  items: [{ variation_id: VARIATION_ID, quantity: 2 }],
  ...overrides,
})

const validVnpayBody = () => ({
  ...validCodBody(),
  payment_provider: "VNPAY",
  payment_method: "VNPAYQR",
  items: [{ variation_id: VARIATION_ID, quantity: 1 }],
})

const postOrders = (body, token = signSessionToken()) =>
  request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send(body)

const postCancel = (orderId = ORDER_ID, body = {}, token = signSessionToken()) =>
  request(app)
    .post(`/api/orders/${orderId}/cancel`)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

const setupCreateMocks = () => {
  User.findByPk.mockImplementation((id) =>
    Promise.resolve({ ...activeUserRecord(), user_id: id })
  )
  User.findAll.mockResolvedValue([])
  quoteShipping.mockResolvedValue({ shipping_fee: 30_000 })
  Order.create.mockImplementation(async (data) => ({
    ...data,
    order_id: ORDER_ID,
  }))
  OrderItem.create.mockResolvedValue({})
  Payment.create.mockImplementation(async (data) => ({ payment_id: 1, ...data }))
  getPaymentUrl.mockResolvedValue("https://sandbox.vnpayment.vn/pay?v=1")
}

describe("FR_ReserveInventoryOnOrder — createOrder reserve", () => {
  let mockVariation

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setVnpEnv()
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
    setupCreateMocks()
    mockVariation = buildVariation()
    ProductVariation.findByPk.mockResolvedValue(mockVariation)
    ProductVariation.findOne.mockResolvedValue(mockVariation)
  })

  afterEach(() => {
    clearVnpEnv()
  })

  // FR: BR-01 / §4 — COD decrement + pessimistic lock
  it("decrements stock with LOCK UPDATE and skipLocked on reserve for COD (BR-01, BR-03)", async () => {
    const res = await postOrders(validCodBody())

    expect(res.status).toBe(201)
    expect(ProductVariation.findOne).toHaveBeenCalledWith({
      where: { variation_id: VARIATION_ID },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
      skipLocked: true,
    })
    expect(mockVariation.decrement).toHaveBeenCalledWith("stock_quantity", {
      by: 2,
      transaction: mockTransaction,
    })
    expect(OrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        variation_id: VARIATION_ID,
        quantity: 2,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: §4 soft check — không reserve khi insufficient trước lock
  it("does not decrement or reserve when soft stock check fails (§4)", async () => {
    ProductVariation.findByPk.mockResolvedValue(
      buildVariation({ stock_quantity: 1, is_available: true })
    )

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Insufficient stock/)
    expect(ProductVariation.findOne).not.toHaveBeenCalled()
    expect(mockVariation.decrement).not.toHaveBeenCalled()
    expect(Order.create).not.toHaveBeenCalled()
    expect(OrderItem.create).not.toHaveBeenCalled()
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §4 VNPay TTL
  it("sets reserve_expires_at ~24h for VNPAY and decrements stock (§4)", async () => {
    const before = Date.now()
    const res = await postOrders(validVnpayBody())

    expect(res.status).toBe(201)
    const orderData = Order.create.mock.calls[0][0]
    expect(orderData.status).toBe("AWAITING_PAYMENT")
    expect(orderData.reserve_expires_at).toBeInstanceOf(Date)
    expect(orderData.reserve_expires_at.getTime() - before).toBeGreaterThan(
      23 * 60 * 60 * 1000
    )
    expect(mockVariation.decrement).toHaveBeenCalledWith("stock_quantity", {
      by: 1,
      transaction: mockTransaction,
    })
  })

  // FR: §4 COD — no reserve_expires_at
  it("sets reserve_expires_at null for COD (§4)", async () => {
    await postOrders(validCodBody())

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reserve_expires_at: null,
        status: "processing",
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )
  })

  // FR: EC-01 / GAP-05 — not found during reserve
  it('returns 400 "not found during reserve" when findOne returns null (EC-01)', async () => {
    ProductVariation.findOne.mockResolvedValue(null)

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(
      `Variation ${VARIATION_ID} not found during reserve`
    )
    expect(mockVariation.decrement).not.toHaveBeenCalled()
    expect(OrderItem.create).not.toHaveBeenCalled()
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  // FR: §4 — out of stock at reserve (hard check)
  it("returns 400 Out of stock during reserve when locked row has low stock (§4)", async () => {
    ProductVariation.findOne.mockResolvedValue(
      buildVariation({ stock_quantity: 0 })
    )

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Out of stock during reserve/)
    expect(mockVariation.decrement).not.toHaveBeenCalled()
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})

describe("FR_ReserveInventoryOnOrder — cancelOrder restore", () => {
  const incrementCalls = []

  const buildOrder = (overrides = {}) => ({
    order_id: ORDER_ID,
    user_id: USER_ID,
    status: "processing",
    note: "",
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  const buildPayment = (overrides = {}) => ({
    provider: "COD",
    payment_status: "pending",
    update: jest.fn(async function updatePayment(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  })

  const orderItems = [{ variation_id: 501, quantity: 2 }]

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    incrementCalls.length = 0
    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    OrderItem.findAll.mockResolvedValue(orderItems)
    ProductVariation.findOne.mockImplementation(async ({ where }) => {
      const increment = jest.fn().mockResolvedValue(undefined)
      incrementCalls.push({ variation_id: where.variation_id, increment })
      return { variation_id: where.variation_id, increment }
    })
  })

  // FR: §5.1 — increment on cancel
  it("increments stock by OrderItem quantity when cancelling eligible COD order (§5.1)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "processing" }))
    Payment.findOne.mockResolvedValue(
      buildPayment({ provider: "COD", payment_status: "pending" })
    )

    const res = await postCancel(ORDER_ID, { reason: "Khách tự hủy" })

    expect(res.status).toBe(200)
    expect(ProductVariation.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variation_id: 501 },
        transaction: mockTransaction,
        lock: mockTransaction.LOCK.UPDATE,
        skipLocked: true,
      })
    )
    expect(incrementCalls[0].increment).toHaveBeenCalledWith("stock_quantity", {
      by: 2,
      transaction: mockTransaction,
    })
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: §5.1 — VNPAY awaiting restore
  it("restores stock when cancelling VNPAY AWAITING_PAYMENT order (§5.1)", async () => {
    Order.findOne.mockResolvedValue(buildOrder({ status: "AWAITING_PAYMENT" }))
    Payment.findOne.mockResolvedValue(
      buildPayment({ provider: "VNPAY", payment_status: "pending" })
    )

    const res = await postCancel(ORDER_ID)

    expect(res.status).toBe(200)
    expect(incrementCalls[0].increment).toHaveBeenCalledWith("stock_quantity", {
      by: 2,
      transaction: mockTransaction,
    })
  })
})
