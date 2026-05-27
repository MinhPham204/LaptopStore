const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() },
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
const CART_URL = "/api/cart"

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

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

const setupExistingCart = () => {
  Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })
  Cart.create.mockReset()
}

const clearCart = (token = signSessionToken()) =>
  request(app).delete(CART_URL).set("Authorization", `Bearer ${token}`)

describe("DELETE /api/cart", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupExistingCart()
    CartItem.destroy.mockResolvedValue(2)
    CartItem.findAll.mockResolvedValue([])
    Cart.destroy.mockResolvedValue(1)
  })

  // FR: AC1 / BR-01 — xóa tất cả cart_items; giữ cart header; cart rỗng
  it("destroys all cart items and returns 200 with empty cart", async () => {
    const res = await clearCart()

    expect(res.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledTimes(1)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID },
    })
    expect(Cart.destroy).not.toHaveBeenCalled()
    expect(res.body.cart).toEqual({
      cart_id: CART_ID,
      item_count: 0,
      items: [],
      subtotal_snapshot: 0,
      subtotal_after_discount: 0,
    })
    expect(CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cart_id: CART_ID },
      })
    )
  })

  // FR: AC2 / BR-01 — không xóa bản ghi carts
  it("does not call Cart.destroy when clearing cart items", async () => {
    await clearCart()

    expect(CartItem.destroy).toHaveBeenCalled()
    expect(Cart.destroy).not.toHaveBeenCalled()
    expect(Cart.findOne).toHaveBeenCalled()
  })

  // FR: §10 — giỏ đã trống vẫn 200
  it("returns 200 with empty cart when cart already has no items", async () => {
    CartItem.destroy.mockResolvedValue(0)
    CartItem.findAll.mockResolvedValue([])

    const res = await clearCart()

    expect(res.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID },
    })
    expect(res.body.cart.items).toEqual([])
    expect(res.body.cart.item_count).toBe(0)
  })

  // FR: auth — không Bearer
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).delete(CART_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(CartItem.destroy).not.toHaveBeenCalled()
    expect(Cart.destroy).not.toHaveBeenCalled()
  })

  // FR: auth — user inactive
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await clearCart()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(CartItem.destroy).not.toHaveBeenCalled()
    expect(Cart.destroy).not.toHaveBeenCalled()
  })

  // FR: optional — destroy lỗi → 500
  it("returns 500 when CartItem.destroy throws", async () => {
    CartItem.destroy.mockRejectedValue(new Error("DB clear failed"))

    const res = await clearCart()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB clear failed")
    expect(CartItem.findAll).not.toHaveBeenCalled()
    expect(Cart.destroy).not.toHaveBeenCalled()
  })
})
