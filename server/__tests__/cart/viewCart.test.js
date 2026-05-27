const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { findAll: jest.fn() },
  ProductVariation: {},
  Product: {},
  ProductImage: {},
}))

const { User, Cart, CartItem } = require("../../models")
const cartRoutes = require("../../routes/cartRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/cart", cartRoutes)
app.use(errorHandler)

const CART_URL = "/api/cart"
const USER_ID = 42

const signSessionToken = (userId = USER_ID) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const activeUserRecord = (overrides = {}) => ({
  user_id: USER_ID,
  username: "kiet_shop",
  email: "kiet@example.com",
  is_active: true,
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

const buildCartItemRow = ({
  cart_item_id,
  variation_id,
  quantity,
  price_at_add,
  variationPrice,
  discountPct = 0,
  productName = "Laptop X",
}) => ({
  cart_item_id,
  variation_id,
  quantity,
  price_at_add,
  variation: {
    stock_quantity: 8,
    is_available: true,
    processor: "i7-13700H",
    ram: "16GB",
    storage: "512GB SSD",
    price: variationPrice,
    product: {
      product_id: 3,
      product_name: productName,
      thumbnail_url: "https://cdn.example/thumb.png",
      discount_percentage: discountPct,
      images: [{ image_url: "https://cdn.example/primary.png" }],
    },
  },
})

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

describe("GET /api/cart", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
  })

  // FR: AC1 / AC3 — cart có 2 dòng; item_count = tổng quantity
  it("returns 200 with cart items and item_count equal to sum of quantities", async () => {
    setupAuth()
    Cart.findOne.mockResolvedValue({ cart_id: 1, user_id: USER_ID })
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({
        cart_item_id: 10,
        variation_id: 42,
        quantity: 2,
        price_at_add: 25_000_000,
        variationPrice: 25_000_000,
        discountPct: 10,
        productName: "Laptop Alpha",
      }),
      buildCartItemRow({
        cart_item_id: 11,
        variation_id: 43,
        quantity: 3,
        price_at_add: 9_500_000,
        variationPrice: 10_000_000,
        discountPct: 0,
        productName: "Laptop Beta",
      }),
    ])

    const res = await request(app)
      .get(CART_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.cart.cart_id).toBe(1)
    expect(res.body.cart.items).toHaveLength(2)
    expect(res.body.cart.item_count).toBe(5)
    expect(CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cart_id: 1 },
        order: [["added_at", "DESC"]],
      })
    )
  })

  // FR: BR-04 — subtotal_snapshot và subtotal_after_discount
  it("calculates subtotal_snapshot and subtotal_after_discount from line items", async () => {
    setupAuth()
    Cart.findOne.mockResolvedValue({ cart_id: 1, user_id: USER_ID })
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({
        cart_item_id: 10,
        variation_id: 42,
        quantity: 2,
        price_at_add: 25_000_000,
        variationPrice: 25_000_000,
        discountPct: 10,
      }),
      buildCartItemRow({
        cart_item_id: 11,
        variation_id: 43,
        quantity: 3,
        price_at_add: 9_500_000,
        variationPrice: 10_000_000,
        discountPct: 0,
      }),
    ])

    const res = await request(app)
      .get(CART_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.cart.subtotal_snapshot).toBe(25_000_000 * 2 + 9_500_000 * 3)
    expect(res.body.cart.subtotal_after_discount).toBe(22_500_000 * 2 + 10_000_000 * 3)

    const first = res.body.cart.items[0]
    expect(first.unit_price_before_discount).toBe(25_000_000)
    expect(first.unit_price_after_discount).toBe(22_500_000)
    expect(first.line_total_after_discount).toBe(45_000_000)
  })

  // FR: §5 / AC2 (API) — cấu trúc item chuẩn hóa
  it("returns normalized item fields for frontend rendering", async () => {
    setupAuth()
    Cart.findOne.mockResolvedValue({ cart_id: 1, user_id: USER_ID })
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({
        cart_item_id: 10,
        variation_id: 42,
        quantity: 2,
        price_at_add: 25_000_000,
        variationPrice: 25_000_000,
        discountPct: 10,
      }),
    ])

    const res = await request(app)
      .get(CART_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    const item = res.body.cart.items[0]
    expect(item).toEqual(
      expect.objectContaining({
        cart_item_id: 10,
        variation_id: 42,
        quantity: 2,
        price_at_add: 25_000_000,
        unit_price_after_discount: 22_500_000,
        discount_percentage: 10,
        variation: expect.objectContaining({
          processor: "i7-13700H",
          ram: "16GB",
          storage: "512GB SSD",
          is_available: true,
        }),
        product: expect.objectContaining({
          product_id: 3,
          product_name: "Laptop X",
          thumbnail_url: "https://cdn.example/thumb.png",
        }),
      })
    )
  })

  // FR: AC4 / BR-02 — chưa có cart → create; items rỗng
  it("creates cart when missing and returns empty items with item_count 0", async () => {
    setupAuth()
    Cart.findOne.mockResolvedValue(null)
    Cart.create.mockResolvedValue({ cart_id: 7, user_id: USER_ID })
    CartItem.findAll.mockResolvedValue([])

    const res = await request(app)
      .get(CART_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(200)
    expect(Cart.create).toHaveBeenCalledWith({ user_id: USER_ID })
    expect(res.body.cart).toEqual({
      cart_id: 7,
      item_count: 0,
      items: [],
      subtotal_snapshot: 0,
      subtotal_after_discount: 0,
    })
  })

  // FR: AC6 — không Bearer → 401
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get(CART_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Cart.findOne).not.toHaveBeenCalled()
  })

  // FR: AC6 — user inactive → 403
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await request(app)
      .get(CART_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Cart.findOne).not.toHaveBeenCalled()
  })
})
