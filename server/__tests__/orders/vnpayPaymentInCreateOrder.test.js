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
  Order: { create: jest.fn() },
  OrderItem: { create: jest.fn() },
  Payment: { create: jest.fn() },
  ProductVariation: { findByPk: jest.fn(), findOne: jest.fn() },
  Cart: { findOne: jest.fn() },
  CartItem: { destroy: jest.fn() },
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
  Cart,
  CartItem,
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
const REDIRECT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=501-1"

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

const setVnpEnv = () => {
  process.env.VNP_TMN_CODE = "TEST_TMN"
  process.env.VNP_HASHSECRET = "test-hash-secret"
  process.env.VNP_RETURNURL = "http://localhost:5000/api/vnpay/return"
  process.env.VNP_PAYURL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
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
    product: { product_name: "Laptop Pro", discount_percentage: 0 },
    decrement: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return variation
}

const validVnpayBody = () => ({
  payment_provider: "VNPAY",
  payment_method: "VNPAYQR",
  shipping_address: "109 Test Street, Ward 1, HCM",
  shipping_phone: "0901234567",
  shipping_name: "Nguyen Van A",
  province_id: 79,
  ward_id: 12345,
  geo_lat: 10.77,
  geo_lng: 106.7,
  items: [{ variation_id: VARIATION_ID, quantity: 1 }],
})

const postOrders = (body, token = signSessionToken()) =>
  request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/orders — VNPAY branch (createOrder)", () => {
  let mockVariation

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setVnpEnv()
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()

    User.findByPk.mockImplementation((id) =>
      Promise.resolve({ ...activeUserRecord(), user_id: id })
    )
    User.findAll.mockResolvedValue([])

    mockVariation = buildVariation()
    ProductVariation.findByPk.mockResolvedValue(mockVariation)
    ProductVariation.findOne.mockResolvedValue(mockVariation)

    quoteShipping.mockResolvedValue({ shipping_fee: 30_000 })

    Order.create.mockImplementation(async (data) => ({
      order_id: ORDER_ID,
      order_code: "ORD-VNP-501",
      ...data,
    }))

    OrderItem.create.mockResolvedValue({})
    Payment.create.mockImplementation(async (data) => ({ payment_id: 1, ...data }))
    Cart.findOne.mockResolvedValue(null)
    CartItem.destroy.mockResolvedValue(0)

    getPaymentUrl.mockResolvedValue(REDIRECT_URL)
  })

  afterEach(() => {
    clearVnpEnv()
  })

  // FR: AC §13 — 201 + AWAITING_PAYMENT + reserve 24h + Payment pending + redirect + stock decrement + commit
  it("returns 201 with redirect, AWAITING_PAYMENT, reserve_expires_at, VNPAY pending payment and commits (AC §13)", async () => {
    const before = Date.now()

    const res = await postOrders(validVnpayBody())

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Order created successfully")
    expect(res.body.redirect).toBe(REDIRECT_URL)
    expect(res.body.order).toEqual(
      expect.objectContaining({
        order_id: ORDER_ID,
        status: "AWAITING_PAYMENT",
        final_amount: 10_030_000,
        shipping_fee: 30_000,
        total_amount: 10_000_000,
        items_breakdown: expect.arrayContaining([
          expect.objectContaining({ variation_id: VARIATION_ID, quantity: 1 }),
        ]),
      })
    )
    expect(res.body.order.order_code).toMatch(/^ORD-/)

    const orderCreateData = Order.create.mock.calls[0][0]
    expect(orderCreateData.status).toBe("AWAITING_PAYMENT")
    expect(orderCreateData.reserve_expires_at).toBeInstanceOf(Date)
    const holdMs =
      orderCreateData.reserve_expires_at.getTime() - before
    expect(holdMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(holdMs).toBeLessThan(25 * 60 * 60 * 1000)

    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        provider: "VNPAY",
        payment_method: "VNPAYQR",
        payment_status: "pending",
        amount: 10_030_000,
        txn_ref: expect.stringMatching(/^501-\d+$/),
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )

    expect(mockVariation.decrement).toHaveBeenCalledWith("stock_quantity", {
      by: 1,
      transaction: mockTransaction,
    })

    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "VNPAYQR",
        amount: 10_030_000,
        txnRef: expect.stringMatching(/^501-\d+$/),
        orderDesc: `Thanh toan don hang ${res.body.order.order_code}`,
      })
    )

    expect(mockTransaction.commit).toHaveBeenCalled()
    expect(mockTransaction.rollback).not.toHaveBeenCalled()
  })

  describe("VNPAY configuration — 502", () => {
    // FR: AC §13 — thiếu ENV → rollback, không commit
    it("returns 502 VNPAY configuration error and rolls back when VNP env is missing", async () => {
      delete process.env.VNP_TMN_CODE

      const res = await postOrders(validVnpayBody())

      expect(res.status).toBe(502)
      expect(res.body.message).toBe("VNPAY configuration error")
      expect(res.body.detail).toMatch(/Missing ENV/)
      expect(mockTransaction.rollback).toHaveBeenCalled()
      expect(mockTransaction.commit).not.toHaveBeenCalled()
      expect(getPaymentUrl).not.toHaveBeenCalled()
    })

    it("returns 502 and rolls back when getPaymentUrl throws", async () => {
      getPaymentUrl.mockRejectedValue(new Error("sign error"))

      const res = await postOrders(validVnpayBody())

      expect(res.status).toBe(502)
      expect(res.body.message).toBe("VNPAY configuration error")
      expect(res.body.detail).toBe("sign error")
      expect(mockTransaction.rollback).toHaveBeenCalled()
      expect(mockTransaction.commit).not.toHaveBeenCalled()
    })
  })

  // FR: §4 VALID map — invalid payment_method for VNPAY
  it("returns 400 for invalid payment_method on VNPAY provider", async () => {
    const res = await postOrders({
      ...validVnpayBody(),
      payment_method: "COD",
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid payment_method for provider VNPAY")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(Order.create).not.toHaveBeenCalled()
    expect(getPaymentUrl).not.toHaveBeenCalled()
  })
})
