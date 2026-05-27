const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { findOrCreate: jest.fn(), findAll: jest.fn() },
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
const VARIATION_ID = 42
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

const buildCartItemRow = (overrides = {}) => ({
  cart_item_id: 10,
  variation_id: VARIATION_ID,
  quantity: 2,
  price_at_add: 25_000_000,
  variation: {
    stock_quantity: 10,
    is_available: true,
    processor: "i7",
    ram: "16GB",
    storage: "512GB",
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

const mockVariation = (overrides = {}) => ({
  variation_id: VARIATION_ID,
  price: 25_000_000,
  stock_quantity: 10,
  is_available: true,
  product: { product_id: 3 },
  ...overrides,
})

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

const setupExistingCart = () => {
  Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })
}

const postCart = (body, token = signSessionToken()) =>
  request(app).post(CART_URL).set("Authorization", `Bearer ${token}`).send(body)

describe("POST /api/cart", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupExistingCart()
    ProductVariation.findByPk.mockResolvedValue(mockVariation())
    CartItem.findAll.mockResolvedValue([])
  })

  // FR: AC1 / BR-01 / BR-02 — tạo dòng mới với snapshot price_at_add
  it("creates a new cart line and returns 200 with full cart via getCart", async () => {
    const newLine = { cart_item_id: 10, quantity: 2, price_at_add: 25_000_000 }
    CartItem.findOrCreate.mockResolvedValue([newLine, true])
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({ cart_item_id: 10, quantity: 2, price_at_add: 25_000_000 }),
    ])

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 2 })

    expect(res.status).toBe(200)
    expect(ProductVariation.findByPk).toHaveBeenCalledWith(
      VARIATION_ID,
      expect.objectContaining({ include: expect.any(Array) })
    )
    expect(CartItem.findOrCreate).toHaveBeenCalledWith({
      where: { cart_id: CART_ID, variation_id: VARIATION_ID },
      defaults: {
        quantity: 2,
        price_at_add: 25_000_000,
      },
    })
    expect(CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cart_id: CART_ID } })
    )
    expect(res.body.cart).toEqual(
      expect.objectContaining({
        cart_id: CART_ID,
        item_count: 2,
        items: expect.arrayContaining([
          expect.objectContaining({
            cart_item_id: 10,
            variation_id: VARIATION_ID,
            quantity: 2,
            price_at_add: 25_000_000,
          }),
        ]),
      })
    )
  })

  // FR: AC2 — merge quantity khi đã có dòng cùng variation
  it("merges quantity into existing cart line when variation already exists", async () => {
    const existingLine = {
      cart_item_id: 10,
      quantity: 2,
      price_at_add: 20_000_000,
      save: jest.fn().mockResolvedValue(undefined),
    }
    CartItem.findOrCreate.mockResolvedValue([existingLine, false])
    CartItem.findAll.mockResolvedValue([
      buildCartItemRow({ quantity: 5, price_at_add: 20_000_000 }),
    ])

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 3 })

    expect(res.status).toBe(200)
    expect(existingLine.quantity).toBe(5)
    expect(existingLine.save).toHaveBeenCalledTimes(1)
    expect(CartItem.findAll).toHaveBeenCalled()
    expect(res.body.cart.item_count).toBe(5)
  })

  // FR: §4 — quantity mặc định = 1
  it("defaults quantity to 1 when body omits quantity", async () => {
    CartItem.findOrCreate.mockResolvedValue([
      { cart_item_id: 11, quantity: 1, price_at_add: 25_000_000 },
      true,
    ])
    CartItem.findAll.mockResolvedValue([buildCartItemRow({ cart_item_id: 11, quantity: 1 })])

    const res = await postCart({ variation_id: VARIATION_ID })

    expect(res.status).toBe(200)
    expect(CartItem.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: { quantity: 1, price_at_add: 25_000_000 },
      })
    )
  })

  // FR: BR-03 — variation không tồn tại
  it('returns 404 when variation_id does not exist', async () => {
    ProductVariation.findByPk.mockResolvedValue(null)

    const res = await postCart({ variation_id: 999, quantity: 1 })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product variation not found")
    expect(CartItem.findOrCreate).not.toHaveBeenCalled()
    expect(CartItem.findAll).not.toHaveBeenCalled()
  })

  // FR: BR-03 — không available
  it('returns 400 when variation is not available', async () => {
    ProductVariation.findByPk.mockResolvedValue(
      mockVariation({ is_available: false, stock_quantity: 10 })
    )

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 2 })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Product not available or insufficient stock")
    expect(CartItem.findOrCreate).not.toHaveBeenCalled()
  })

  // FR: BR-03 — stock < quantity lần add đầu
  it('returns 400 when initial quantity exceeds stock', async () => {
    ProductVariation.findByPk.mockResolvedValue(
      mockVariation({ stock_quantity: 1, is_available: true })
    )

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 3 })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Product not available or insufficient stock")
    expect(CartItem.findOrCreate).not.toHaveBeenCalled()
  })

  // FR: AC3 — merge vượt stock
  it('returns 400 Insufficient stock when merged quantity exceeds stock', async () => {
    const existingLine = {
      cart_item_id: 10,
      quantity: 8,
      price_at_add: 25_000_000,
      save: jest.fn(),
    }
    CartItem.findOrCreate.mockResolvedValue([existingLine, false])
    ProductVariation.findByPk.mockResolvedValue(
      mockVariation({ stock_quantity: 10, is_available: true })
    )

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 3 })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Insufficient stock")
    expect(existingLine.save).not.toHaveBeenCalled()
    expect(CartItem.findAll).not.toHaveBeenCalled()
  })

  // FR: auth — không Bearer
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).post(CART_URL).send({ variation_id: VARIATION_ID })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  // FR: auth — user inactive
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await postCart({ variation_id: VARIATION_ID, quantity: 1 })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })
})
