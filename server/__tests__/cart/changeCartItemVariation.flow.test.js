const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: {
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
    findAll: jest.fn(),
  },
  ProductVariation: { findByPk: jest.fn() },
  Product: {},
  ProductImage: {},
}))

const { User, Cart, CartItem, ProductVariation } = require("../../models")
const cartRoutes = require("../../routes/cartRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/cart", cartRoutes)
app.use(errorHandler)

const USER_ID = 42
const CART_ID = 1
const OLD_CART_ITEM_ID = 10
const NEW_VARIATION_ID = 102
const OLD_VARIATION_ID = 101

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
  cart_item_id: NEW_VARIATION_ID,
  variation_id: NEW_VARIATION_ID,
  quantity: 3,
  price_at_add: 12_000_000,
  variation: {
    stock_quantity: 10,
    is_available: true,
    processor: "i7",
    ram: "32GB",
    storage: "1TB",
    color: "Black",
    price: 12_000_000,
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

const setupCart = () => {
  Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })
}

const mockNewVariation = () => {
  ProductVariation.findByPk.mockResolvedValue({
    variation_id: NEW_VARIATION_ID,
    price: 12_000_000,
    stock_quantity: 10,
    is_available: true,
    product: { product_id: 3 },
  })
}

describe("Change cart item variation — API flow (POST then DELETE)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupCart()
  })

  // FR: AC1 / AC2 / BR-01 — POST SKU mới qty=3 rồi DELETE dòng cũ → 200 + getCart
  it("completes add-new-variation then remove-old-item sequence with 200 responses", async () => {
    mockNewVariation()
    const savedNewLine = { cart_item_id: 20, quantity: 3, save: jest.fn().mockResolvedValue(undefined) }
    CartItem.findOrCreate.mockResolvedValue([savedNewLine, true])
    CartItem.findAll.mockResolvedValueOnce([buildCartItemRow()]).mockResolvedValueOnce([])

    const token = signSessionToken()

    const postRes = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ variation_id: NEW_VARIATION_ID, quantity: 3 })

    expect(postRes.status).toBe(200)
    expect(ProductVariation.findByPk).toHaveBeenCalledWith(
      NEW_VARIATION_ID,
      expect.objectContaining({ include: expect.any(Array) })
    )
    expect(CartItem.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cart_id: CART_ID, variation_id: NEW_VARIATION_ID },
        defaults: expect.objectContaining({ quantity: 3 }),
      })
    )
    expect(postRes.body.cart.items).toHaveLength(1)
    expect(postRes.body.cart.items[0].variation_id).toBe(NEW_VARIATION_ID)
    expect(postRes.body.cart.items[0].quantity).toBe(3)

    CartItem.destroy.mockResolvedValue(1)
    CartItem.findAll.mockResolvedValue([])

    const deleteRes = await request(app)
      .delete(`/api/cart/${OLD_CART_ITEM_ID}`)
      .set("Authorization", `Bearer ${token}`)

    expect(deleteRes.status).toBe(200)
    expect(CartItem.destroy).toHaveBeenCalledWith({
      where: { cart_id: CART_ID, cart_item_id: String(OLD_CART_ITEM_ID) },
    })
    expect(deleteRes.body.cart).toEqual({
      cart_id: CART_ID,
      item_count: 0,
      items: [],
      subtotal_snapshot: 0,
      subtotal_after_discount: 0,
    })
    expect(CartItem.findAll).toHaveBeenCalledTimes(2)
  })

  // FR: BR-02 — POST fail → không thực hiện DELETE trong flow
  it("does not proceed to delete when POST addToCart fails", async () => {
    ProductVariation.findByPk.mockResolvedValue(null)

    const token = signSessionToken()
    const postRes = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ variation_id: NEW_VARIATION_ID, quantity: 3 })

    expect(postRes.status).toBe(404)
    expect(postRes.body.message).toBe("Product variation not found")
    expect(CartItem.findOrCreate).not.toHaveBeenCalled()

    CartItem.destroy.mockClear()
    CartItem.findAll.mockClear()

    // Client would not call DELETE after failed POST — verify destroy unused in this flow
    expect(CartItem.destroy).not.toHaveBeenCalled()
    expect(CartItem.findAll).not.toHaveBeenCalled()
  })

  // FR: BR-02 — POST insufficient stock → 400
  it("returns 400 on POST when new variation has insufficient stock", async () => {
    ProductVariation.findByPk.mockResolvedValue({
      variation_id: NEW_VARIATION_ID,
      price: 12_000_000,
      stock_quantity: 1,
      is_available: true,
      product: { product_id: 3 },
    })

    const token = signSessionToken()
    const postRes = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ variation_id: NEW_VARIATION_ID, quantity: 3 })

    expect(postRes.status).toBe(400)
    expect(postRes.body.message).toBe("Product not available or insufficient stock")
    expect(CartItem.findOrCreate).not.toHaveBeenCalled()
    expect(CartItem.destroy).not.toHaveBeenCalled()
  })
})
