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
const ORDER_ID = 301
const VARIATION_ID = 10
const CART_ID = 5

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
  shipping_address: "109 Test Street, Phuong 1, HCM",
  shipping_phone: "0901234567",
  shipping_name: "Nguyen Van A",
  note: "Giao gio hanh chinh",
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

describe("POST /api/orders (createOrder)", () => {
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
      ...data,
      order_id: ORDER_ID,
    }))
    OrderItem.create.mockResolvedValue({})
    Payment.create.mockImplementation(async (data) => ({ payment_id: 1, ...data }))

    Cart.findOne.mockResolvedValue(null)
    CartItem.destroy.mockResolvedValue(1)

    getPaymentUrl.mockResolvedValue("https://sandbox.vnpayment.vn/pay?v=1")
  })

  afterEach(() => {
    clearVnpEnv()
  })

  // FR: AC §13 — COD 201 processing, redirect null, breakdown, DB writes
  it("creates COD order with 201, processing status, items_breakdown and stock decrement (AC §13)", async () => {
    const res = await postOrders(validCodBody())

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Order created successfully")
    expect(res.body.redirect).toBeNull()
    expect(res.body.order).toMatchObject({
      order_id: ORDER_ID,
      status: "processing",
      shipping_fee: 30_000,
      final_amount: 18_030_000,
      total_amount: 20_000_000,
      discount_amount: 2_000_000,
    })
    expect(res.body.order.order_code).toMatch(/^ORD-/)
    expect(res.body.order.items_breakdown).toHaveLength(1)
    expect(res.body.order.items_breakdown[0]).toEqual(
      expect.objectContaining({
        variation_id: VARIATION_ID,
        quantity: 2,
        product_name: "Laptop Pro",
      })
    )

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        status: "processing",
        reserve_expires_at: null,
        province_id: 79,
        ward_id: 12345,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )

    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        provider: "COD",
        payment_method: "COD",
        payment_status: "pending",
        txn_ref: null,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )

    expect(OrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        variation_id: VARIATION_ID,
        quantity: 2,
      }),
      expect.objectContaining({ transaction: mockTransaction })
    )

    expect(mockVariation.decrement).toHaveBeenCalledWith("stock_quantity", {
      by: 2,
      transaction: mockTransaction,
    })

    expect(quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({
        province_id: 79,
        ward_id: 12345,
        subtotal: 18_000_000,
      })
    )

    expect(mockTransaction.commit).toHaveBeenCalled()
    expect(mockTransaction.rollback).not.toHaveBeenCalled()
  })

  // FR: AC §13 — VNPAY branch
  it("creates VNPAY order with AWAITING_PAYMENT, reserve_expires_at and redirect (AC §13)", async () => {
    const before = Date.now()
    const res = await postOrders(validVnpayBody())

    expect(res.status).toBe(201)
    expect(res.body.redirect).toBe("https://sandbox.vnpayment.vn/pay?v=1")
    expect(res.body.order.status).toBe("AWAITING_PAYMENT")

    const orderData = Order.create.mock.calls[0][0]
    expect(orderData.reserve_expires_at).toBeInstanceOf(Date)
    expect(orderData.reserve_expires_at.getTime() - before).toBeGreaterThan(
      23 * 60 * 60 * 1000
    )

    expect(getPaymentUrl).toHaveBeenCalled()
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  // FR: BR-CART — partial items destroys matching cart lines
  it("destroys selected cart items when items array is provided (BR-CART)", async () => {
    Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })

    await postOrders(validCodBody())

    expect(CartItem.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cart_id: CART_ID,
          variation_id: [VARIATION_ID],
        },
        transaction: mockTransaction,
      })
    )
  })

  // FR: BR-ITEMS — full cart when no items in body
  it("returns 400 when cart is empty and no items in body (BR-ITEMS)", async () => {
    const body = validCodBody()
    delete body.items

    Cart.findOne.mockResolvedValue(null)

    const res = await postOrders(body)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cart is empty")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  it("returns 400 when cart has no cart items (BR-ITEMS)", async () => {
    const body = validCodBody()
    delete body.items

    Cart.findOne.mockResolvedValue({ cart_id: CART_ID })
    CartItem.findAll.mockResolvedValue([])

    const res = await postOrders(body)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cart is empty")
  })

  // FR: §5 — validation errors
  it("returns 400 for unsupported payment_provider (§5)", async () => {
    const res = await postOrders(validCodBody({ payment_provider: "PAYPAL" }))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Unsupported payment_provider: PAYPAL")
    expect(Order.create).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid payment_method (§5)", async () => {
    const res = await postOrders(
      validCodBody({ payment_provider: "VNPAY", payment_method: "COD" })
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid payment_method for provider VNPAY")
  })

  it("returns 400 when province or ward is missing (§5)", async () => {
    const res = await postOrders(validCodBody({ province_id: null, ward_id: null }))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Vui lòng chọn Tỉnh/Thành và Phường/Xã")
  })

  it("returns 400 when geo coordinates are missing (§5)", async () => {
    const res = await postOrders(
      validCodBody({ geo_lat: undefined, geo_lng: undefined })
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Vui lòng xác nhận vị trí trên bản đồ")
  })

  it("returns 400 when variation is not found (§5)", async () => {
    ProductVariation.findByPk.mockResolvedValue(null)

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(`Variation ${VARIATION_ID} not found`)
  })

  it("returns 400 for insufficient stock before reserve (§5)", async () => {
    ProductVariation.findByPk.mockResolvedValue(
      buildVariation({ stock_quantity: 1, is_available: true })
    )

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Insufficient stock/)
  })

  it("returns 400 when variation not found during reserve (EC-01)", async () => {
    ProductVariation.findOne.mockResolvedValue(null)

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(
      `Variation ${VARIATION_ID} not found during reserve`
    )
  })

  it("returns 400 for out of stock during reserve (EC-06)", async () => {
    ProductVariation.findOne.mockResolvedValue(
      buildVariation({ stock_quantity: 0 })
    )

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Out of stock during reserve/)
  })

  // FR: EC-02 — VNPAY config
  it("returns 502 and rolls back when VNPAY env is missing (EC-02)", async () => {
    clearVnpEnv()

    const res = await postOrders(validVnpayBody())

    expect(res.status).toBe(502)
    expect(res.body.message).toBe("VNPAY configuration error")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — auth
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await request(app).post("/api/orders").send(validCodBody())

    expect(res.status).toBe(401)
    expect(Order.create).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(
      activeUserRecord({ is_active: false })
    )

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(403)
    expect(Order.create).not.toHaveBeenCalled()
  })

  // FR: Error — 500
  it("returns 500 when Order.create throws", async () => {
    Order.create.mockRejectedValue(new Error("DB error"))

    const res = await postOrders(validCodBody())

    expect(res.status).toBe(500)
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })
})
