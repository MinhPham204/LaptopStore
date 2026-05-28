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

jest.mock("../../services/emailService", () => ({}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Order: { create: jest.fn() },
  OrderItem: { create: jest.fn() },
  ProductVariation: { findByPk: jest.fn() },
  Product: {},
  Payment: {},
  Cart: {},
  CartItem: {},
}))

const { quoteShipping } = require("../../services/shippingService")
const { User, Order, OrderItem, ProductVariation } = require("../../models")
const orderRoutes = require("../../routes/orderRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/orders", orderRoutes)
app.use(errorHandler)

const PREVIEW_URL = "/api/orders/preview"
const USER_ID = 42
const VARIATION_ID = 10

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

const buildVariation = (overrides = {}) => ({
  variation_id: VARIATION_ID,
  price: 25_000_000,
  stock_quantity: 5,
  is_available: true,
  decrement: jest.fn(),
  product: {
    product_name: "Laptop X",
    discount_percentage: 10,
    thumbnail_url: "https://cdn.example/thumb.png",
    slug: "laptop-x",
  },
  ...overrides,
})

const validPreviewBody = (overrides = {}) => ({
  province_id: 79,
  ward_id: 12345,
  items: [{ variation_id: VARIATION_ID, quantity: 1 }],
  ...overrides,
})

const postPreview = (body = validPreviewBody(), token = signSessionToken()) => {
  const req = request(app).post(PREVIEW_URL).send(body)
  if (token) req.set("Authorization", `Bearer ${token}`)
  return req
}

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

const setupVariation = (variation = buildVariation()) => {
  ProductVariation.findByPk.mockResolvedValue(variation)
}

const setupShipping = (overrides = {}) => {
  quoteShipping.mockResolvedValue({
    shipping_fee: 30_000,
    reason: "HCM_SUBTOTAL_FREE",
    ...overrides,
  })
}

describe("POST /api/orders/preview — previewOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupVariation()
    setupShipping()
  })

  // FR: AC §12 / BR-01 — totals + breakdown
  it("returns 200 with totals, items_breakdown and empty stock_warnings (AC §12, BR-01)", async () => {
    const res = await postPreview()

    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        total_amount: 25_000_000,
        discount_amount: 2_500_000,
        subtotal_after_discount: 22_500_000,
        shipping_fee: 30_000,
        shipping_reason: "HCM_SUBTOTAL_FREE",
        final_amount: 22_530_000,
        stock_warnings: [],
      })
    )
    expect(res.body.items_breakdown).toHaveLength(1)
    expect(res.body.items_breakdown[0]).toEqual(
      expect.objectContaining({
        variation_id: VARIATION_ID,
        product_name: "Laptop X",
        quantity: 1,
        unit_price: 25_000_000,
        unit_discount_amount: 2_500_000,
        unit_final_price: 22_500_000,
        item_total: 25_000_000,
        item_discount: 2_500_000,
        item_subtotal_after_discount: 22_500_000,
        thumbnail_url: "https://cdn.example/thumb.png",
        slug: "laptop-x",
      })
    )
    expect(Order.create).not.toHaveBeenCalled()
    expect(OrderItem.create).not.toHaveBeenCalled()
  })

  // FR: BR-01 — formula matches createOrder
  it("calculates unit discount and line totals from DB price and discount_percentage (BR-01)", async () => {
    setupVariation(
      buildVariation({
        price: 10_000_000,
        product: {
          product_name: "Laptop Pro",
          discount_percentage: 15,
          thumbnail_url: null,
          slug: "laptop-pro",
        },
      })
    )

    const res = await postPreview(
      validPreviewBody({ items: [{ variation_id: VARIATION_ID, quantity: 2 }] })
    )

    expect(res.status).toBe(200)
    const line = res.body.items_breakdown[0]
    expect(line.unit_discount_amount).toBe(1_500_000)
    expect(line.unit_final_price).toBe(8_500_000)
    expect(line.item_total).toBe(20_000_000)
    expect(line.item_discount).toBe(3_000_000)
    expect(line.item_subtotal_after_discount).toBe(17_000_000)
    expect(res.body.subtotal_after_discount).toBe(17_000_000)
    expect(res.body.final_amount).toBe(17_030_000)
  })

  // FR: §6 / BR-04 — quoteShipping args
  it("calls quoteShipping with province_id, ward_id and subtotal_after_discount (BR-04)", async () => {
    await postPreview()

    expect(quoteShipping).toHaveBeenCalledWith({
      province_id: 79,
      ward_id: 12345,
      subtotal: 22_500_000,
    })
    expect(Order.create).not.toHaveBeenCalled()
  })

  // FR: BR-02 — low stock still 200
  it("returns 200 with stock_warnings when stock is insufficient (BR-02)", async () => {
    setupVariation(
      buildVariation({ stock_quantity: 0, is_available: false })
    )

    const res = await postPreview(
      validPreviewBody({ items: [{ variation_id: VARIATION_ID, quantity: 2 }] })
    )

    expect(res.status).toBe(200)
    expect(res.body.stock_warnings).toEqual([
      {
        variation_id: VARIATION_ID,
        message: "Only 0 left in stock",
      },
    ])
    expect(res.body.items_breakdown[0].quantity).toBe(2)
    expect(Order.create).not.toHaveBeenCalled()
  })

  // FR: §5 — quantity defaults to 1
  it("defaults quantity to 1 when omitted (§5)", async () => {
    const res = await postPreview(
      validPreviewBody({ items: [{ variation_id: VARIATION_ID }] })
    )

    expect(res.status).toBe(200)
    expect(res.body.items_breakdown[0].quantity).toBe(1)
    expect(ProductVariation.findByPk).toHaveBeenCalledWith(
      VARIATION_ID,
      expect.objectContaining({
        include: [expect.objectContaining({ as: "product" })],
      })
    )
  })

  // FR: BR-03 — ward_id optional
  it("returns 200 when ward_id is omitted and passes null to quoteShipping (BR-03)", async () => {
    const res = await postPreview(
      validPreviewBody({ ward_id: undefined })
    )

    expect(res.status).toBe(200)
    expect(quoteShipping).toHaveBeenCalledWith({
      province_id: 79,
      ward_id: null,
      subtotal: 22_500_000,
    })
  })

  // FR: PRE-01 — 401
  it("returns 401 without bearer token (PRE-01)", async () => {
    const res = await postPreview(validPreviewBody(), null)

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/access token required/i)
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
    expect(quoteShipping).not.toHaveBeenCalled()
  })

  // FR: PRE-01 — 403 inactive
  it("returns 403 when user is inactive (PRE-01)", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await postPreview()

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  // FR: PRE-02 — No items
  it('returns 400 with message "No items" when items array is empty (PRE-02)', async () => {
    const res = await postPreview(validPreviewBody({ items: [] }))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("No items")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  // FR: PRE-03 — Missing province_id
  it('returns 400 with message "Missing province_id" when province_id is absent (PRE-03)', async () => {
    const res = await postPreview(
      validPreviewBody({ province_id: undefined })
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Missing province_id")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  // FR: §5 errors — variation not found
  it("returns 400 when variation is not found (§5)", async () => {
    ProductVariation.findByPk.mockResolvedValue(null)

    const res = await postPreview()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(`Variation ${VARIATION_ID} not found`)
    expect(quoteShipping).not.toHaveBeenCalled()
    expect(Order.create).not.toHaveBeenCalled()
  })

  // FR: read-only — no writes
  it("does not call Order.create, OrderItem.create or variation decrement (read-only)", async () => {
    const variation = buildVariation()
    ProductVariation.findByPk.mockResolvedValue(variation)

    await postPreview()

    expect(Order.create).not.toHaveBeenCalled()
    expect(OrderItem.create).not.toHaveBeenCalled()
    expect(variation.decrement).not.toHaveBeenCalled()
  })
})
