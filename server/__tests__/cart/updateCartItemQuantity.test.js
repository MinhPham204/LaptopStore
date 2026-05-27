const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { findOne: jest.fn(), findAll: jest.fn() },
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

const makeMutableCartItem = ({ stock_quantity = 8, quantity = 1, ...rest } = {}) => {
  const row = buildCartItemRow({ quantity, ...rest })
  return {
    ...row,
    cart_id: CART_ID,
    variation: { ...row.variation, stock_quantity },
    save: jest.fn().mockImplementation(async function save() {
      return this
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  }
}

const setupAuth = () => {
  User.findByPk.mockResolvedValue(activeUserRecord())
}

const setupExistingCart = () => {
  Cart.findOne.mockResolvedValue({ cart_id: CART_ID, user_id: USER_ID })
  Cart.create.mockReset()
}

const setupGetCartAfterMutation = (items = []) => {
  CartItem.findAll.mockResolvedValue(items)
}

const putCartItem = (cartItemId, body, token = signSessionToken()) =>
  request(app)
    .put(`/api/cart/${cartItemId}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("PUT /api/cart/:cart_item_id", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuth()
    setupExistingCart()
  })

  // FR: AC1 / BR-01 / BR-02 — qty hợp lệ, stock đủ → save + full cart
  it("updates quantity and returns 200 with full cart when stock is sufficient", async () => {
    const cartItem = makeMutableCartItem({ stock_quantity: 10, quantity: 1 })
    CartItem.findOne.mockResolvedValue(cartItem)
    setupGetCartAfterMutation([
      buildCartItemRow({ cart_item_id: CART_ITEM_ID, quantity: 3, price_at_add: 25_000_000 }),
    ])

    const res = await putCartItem(CART_ITEM_ID, { quantity: 3 })

    expect(res.status).toBe(200)
    expect(cartItem.quantity).toBe(3)
    expect(cartItem.save).toHaveBeenCalledTimes(1)
    expect(cartItem.destroy).not.toHaveBeenCalled()
    expect(res.body.cart).toEqual(
      expect.objectContaining({
        cart_id: CART_ID,
        item_count: 3,
        items: expect.arrayContaining([
          expect.objectContaining({ cart_item_id: CART_ITEM_ID, quantity: 3 }),
        ]),
      })
    )
    expect(CartItem.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cart_item_id: String(CART_ITEM_ID), cart_id: CART_ID },
      })
    )
  })

  // FR: AC2 — quantity <= 0 → destroy + getCart
  it("removes cart item via destroy when quantity is zero", async () => {
    const cartItem = makeMutableCartItem({ stock_quantity: 10 })
    CartItem.findOne.mockResolvedValue(cartItem)
    setupGetCartAfterMutation([])

    const res = await putCartItem(CART_ITEM_ID, { quantity: 0 })

    expect(res.status).toBe(200)
    expect(cartItem.destroy).toHaveBeenCalledTimes(1)
    expect(cartItem.save).not.toHaveBeenCalled()
    expect(res.body.cart).toEqual({
      cart_id: CART_ID,
      item_count: 0,
      items: [],
      subtotal_snapshot: 0,
      subtotal_after_discount: 0,
    })
  })

  it("removes cart item when quantity is negative", async () => {
    const cartItem = makeMutableCartItem({ stock_quantity: 10 })
    CartItem.findOne.mockResolvedValue(cartItem)
    setupGetCartAfterMutation([])

    const res = await putCartItem(CART_ITEM_ID, { quantity: -1 })

    expect(res.status).toBe(200)
    expect(cartItem.destroy).toHaveBeenCalledTimes(1)
    expect(cartItem.save).not.toHaveBeenCalled()
  })

  // FR: BR-02 — quantity đúng bằng stock → 200
  it("allows quantity equal to stock_quantity", async () => {
    const cartItem = makeMutableCartItem({ stock_quantity: 5, quantity: 2 })
    CartItem.findOne.mockResolvedValue(cartItem)
    setupGetCartAfterMutation([
      buildCartItemRow({ cart_item_id: CART_ITEM_ID, quantity: 5, price_at_add: 25_000_000 }),
    ])

    const res = await putCartItem(CART_ITEM_ID, { quantity: 5 })

    expect(res.status).toBe(200)
    expect(cartItem.quantity).toBe(5)
    expect(cartItem.save).toHaveBeenCalledTimes(1)
    expect(res.body.cart.item_count).toBe(5)
  })

  // FR: AC3 — thiếu quantity
  it('returns 400 when quantity is missing in body', async () => {
    const res = await putCartItem(CART_ITEM_ID, {})

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("quantity is required")
    expect(CartItem.findOne).not.toHaveBeenCalled()
  })

  // FR: BR-03 — cart_item_id không thuộc cart user
  it("returns 404 when cart item is not found", async () => {
    CartItem.findOne.mockResolvedValue(null)

    const res = await putCartItem(999, { quantity: 2 })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Cart item not found")
  })

  // FR: AC3 / BR-02 — vượt stock
  it('returns 400 Insufficient stock when quantity exceeds stock_quantity', async () => {
    const cartItem = makeMutableCartItem({ stock_quantity: 4, quantity: 2 })
    CartItem.findOne.mockResolvedValue(cartItem)

    const res = await putCartItem(CART_ITEM_ID, { quantity: 5 })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Insufficient stock")
    expect(cartItem.save).not.toHaveBeenCalled()
    expect(cartItem.destroy).not.toHaveBeenCalled()
    expect(CartItem.findAll).not.toHaveBeenCalled()
  })

  // FR: AC6 — không Bearer
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).put(`/api/cart/${CART_ITEM_ID}`).send({ quantity: 2 })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(CartItem.findOne).not.toHaveBeenCalled()
  })

  // FR: AC6 — user inactive
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))

    const res = await putCartItem(CART_ITEM_ID, { quantity: 2 })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(CartItem.findOne).not.toHaveBeenCalled()
  })
})
