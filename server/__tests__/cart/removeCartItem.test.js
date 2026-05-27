const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { destroy: jest.fn(), findAll: jest.fn() },
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

const USER_ID = 42
const CART_ID = 1
const CART_ITEM_ID = 10

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

const buildCartItemRow = (overrides = {}) => ({
  cart_item_id: CART_ITEM_ID,
  variation_id: 42,
  quantity: 2,
  price_at_add: 25_000_000,
  variation: {
    stock_quantity: 8,
    is_available: true,
    processor: "i7-13700H",
    ram: "16GB",
    storage: "512GB SSD",
    price: 25_000_000,
    product: {
      product_id: 3,
      product_name: "Laptop X",
      thumbnail_url: "https://cdn.example/thumb.png",
      discount_percentage: 0,
      images: [{ image_url: "https://cdn.example/primary.png" }],
    },
  },
  ...overrides,
})

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

const setupExistingCart = () => {
  Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })
}

const deleteCartItem = (cartItemId, token = signSessionToken()) =>
  request(app)
    .delete(`/api/cart/${cartItemId}`)
    .set("Authorization", `Bearer ${token}`)

describe("DELETE /api/cart/:cart_item_id", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupExistingCart()
    CartItem.destroy.mockResolvedValue(1)
  })

  // FR: AC1 / BR-03 — xóa dòng thuộc cart user → destroy + full cart
  it("destroys cart item and returns 200 with updated cart", async () => {
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({ cart_item_id: 11, variation_id: 43, quantity: 1 }),
    ])

    const res = await deleteCartItem(CART_ITEM_ID)

    expect(res.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID, cart_item_id: String(CART_ITEM_ID) },
    })
    expect(res.body.cart).toEqual(
      expect.objectContaining({
        cart_id: CART_ID,
        item_count: 1,
        items: expect.arrayContaining([
          expect.objectContaining({ cart_item_id: 11, quantity: 1 }),
        ]),
      })
    )
  })

  // FR: §10 — xóa dòng cuối → giỏ rỗng
  it("returns empty cart when the last item is removed", async () => {
    CartItem.findAll.mockResolvedValue([])

    const res = await deleteCartItem(CART_ITEM_ID)

    expect(res.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID, cart_item_id: String(CART_ITEM_ID) },
    })
    expect(res.body.cart).toEqual({
      cart_id: CART_ID,
      item_count: 0,
      items: [],
      subtotal_snapshot: 0,
      subtotal_after_discount: 0,
    })
  })

  // FR: §4 silent — id không tồn tại vẫn 200 + getCart
  it("returns 200 with cart when destroy matches zero rows", async () => {
    CartItem.destroy.mockResolvedValue(0)
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({ cart_item_id: 11, variation_id: 43 }),
    ])

    const res = await deleteCartItem(999)

    expect(res.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID, cart_item_id: "999" },
    })
    expect(res.body.cart.item_count).toBe(2)
    expect(res.body.cart.items).toHaveLength(1)
  })

  // FR: auth — không Bearer
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).delete(`/api/cart/${CART_ITEM_ID}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(CartItem.destroy).not.toHaveBeenCalled()
  })

  // FR: auth — user inactive
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await deleteCartItem(CART_ITEM_ID)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(CartItem.destroy).not.toHaveBeenCalled()
  })

  // FR: optional — destroy lỗi → 500
  it("returns 500 when CartItem.destroy throws", async () => {
    CartItem.destroy.mockRejectedValue(new Error("DB destroy failed"))

    const res = await deleteCartItem(CART_ITEM_ID)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB destroy failed")
    expect(CartItem.findAll).not.toHaveBeenCalled()
  })
})
