const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Product: { findByPk: jest.fn() },
  ProductVariation: { create: jest.fn() },
}))

const { User, Product, ProductVariation } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const PRODUCT_ID = 101
const VARIATION_ID = 205
const createUrl = (productId = PRODUCT_ID) =>
  `/api/admin/products/${productId}/variations`

const ADMIN_USER_ID = 1
const MANAGER_USER_ID = 2
const CUSTOMER_USER_ID = 10
const STAFF_USER_ID = 11

const signSessionToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const userRecord = (overrides = {}) => ({
  user_id: ADMIN_USER_ID,
  username: "admin",
  full_name: "Quản trị viên",
  email: "admin@example.com",
  is_active: true,
  Roles: [{ role_name: "admin" }],
  ...overrides,
})

const validVariationBody = () => ({
  processor: "Intel Core i7-13700H",
  ram: "32GB",
  storage: "1TB SSD",
  graphics_card: "RTX 4060",
  screen_size: "16 inch",
  color: "Bac",
  price: 32000000,
  stock_quantity: 5,
  is_primary: false,
  sku: "LAP-INT-32GB-1TB-BAC",
  is_available: true,
})

const existingProduct = () => ({
  product_id: PRODUCT_ID,
  product_name: "Laptop X",
  is_active: true,
})

const createdVariation = (overrides = {}) => ({
  variation_id: VARIATION_ID,
  product_id: PRODUCT_ID,
  sku: "LAP-INT-32GB-1TB-BAC",
  price: "32000000.00",
  ...overrides,
})

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === MANAGER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: MANAGER_USER_ID,
          username: "manager1",
          Roles: [{ role_name: "manager" }],
        })
      )
    }
    if (id === CUSTOMER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: CUSTOMER_USER_ID,
          username: "buyer",
          Roles: [{ role_name: "customer" }],
        })
      )
    }
    if (id === STAFF_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: STAFF_USER_ID,
          username: "staff1",
          Roles: [{ role_name: "staff" }],
        })
      )
    }
    return Promise.resolve(userRecord({ user_id: id }))
  })
}

const postVariation = (body = validVariationBody(), token = signSessionToken(ADMIN_USER_ID)) =>
  request(app)
    .post(createUrl())
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/admin/products/:product_id/variations (createVariation)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Product.findByPk.mockResolvedValue(existingProduct())
    ProductVariation.create.mockResolvedValue(createdVariation())
  })

  it("returns 201 Variation created successfully for admin", async () => {
    const res = await postVariation()

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Variation created successfully")
    expect(res.body.variation).toMatchObject({
      variation_id: VARIATION_ID,
      product_id: PRODUCT_ID,
      sku: "LAP-INT-32GB-1TB-BAC",
    })
    expect(Product.findByPk).toHaveBeenCalledWith(String(PRODUCT_ID))
  })

  it("returns 201 Variation created successfully for manager", async () => {
    const res = await postVariation(validVariationBody(), signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Variation created successfully")
  })

  it("calls ProductVariation.create with spread body and product_id from params (BR-01)", async () => {
    const body = validVariationBody()

    await postVariation(body)

    expect(ProductVariation.create).toHaveBeenCalledWith({
      ...body,
      product_id: String(PRODUCT_ID),
    })
  })

  it("returns 404 when product is not found", async () => {
    Product.findByPk.mockResolvedValue(null)

    const res = await postVariation()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
    expect(ProductVariation.create).not.toHaveBeenCalled()
  })

  it("returns 409 when ProductVariation.create throws SequelizeUniqueConstraintError (duplicate sku)", async () => {
    const uniqueErr = new Error("unique violation")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    uniqueErr.errors = [{ path: "sku", message: "sku must be unique" }]
    ProductVariation.create.mockRejectedValue(uniqueErr)

    const res = await postVariation()

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("Duplicate entry")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).post(createUrl()).send(validVariationBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await postVariation(validVariationBody(), signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await postVariation(validVariationBody(), signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when ProductVariation.create throws", async () => {
    ProductVariation.create.mockRejectedValue(new Error("DB insert failed"))

    const res = await postVariation()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB insert failed")
  })
})
