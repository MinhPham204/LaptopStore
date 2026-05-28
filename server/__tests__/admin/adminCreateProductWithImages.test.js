const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
}

const uploadState = { body: {}, files: null }

jest.mock("../../config/database", () => ({
  transaction: jest.fn(() => Promise.resolve(mockTransaction)),
}))

jest.mock("../../middleware/upload", () => ({
  uploadProductFiles: (req, res, next) => {
    req.body = { ...(uploadState.body || {}) }
    req.files = uploadState.files || {}
    next()
  },
}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Product: { create: jest.fn() },
  ProductVariation: { bulkCreate: jest.fn() },
  ProductImage: { bulkCreate: jest.fn() },
}))

const sequelize = require("../../config/database")
const { User, Product, ProductVariation, ProductImage } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const CREATE_URL = "/api/admin/products"
const PRODUCT_ID = 101

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

const primaryVariation = (overrides = {}) => ({
  processor: "Intel Core i5-12450H",
  ram: "16GB",
  storage: "512GB SSD",
  graphics_card: "RTX 4050",
  screen_size: "15.6 inch",
  color: "Den",
  price: 25000000,
  stock_quantity: 10,
  is_primary: true,
  sku: "LAP-INT-16GB-512GB-DEN",
  ...overrides,
})

const variationsJson = (variations) => JSON.stringify(variations)

const validCreateBody = (overrides = {}) => ({
  product_name: "Laptop X",
  slug: "laptop-x",
  description: "Great laptop",
  category_id: "1",
  brand_id: "2",
  discount_percentage: "0",
  variations: variationsJson([primaryVariation()]),
  ...overrides,
})

const createdProduct = (overrides = {}) => ({
  product_id: PRODUCT_ID,
  product_name: "Laptop X",
  slug: "laptop-x",
  thumbnail_url: "https://res.cloudinary.com/demo/thumb.png",
  is_active: true,
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

const postProduct = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).post(CREATE_URL).set("Authorization", `Bearer ${token}`).send({})

describe("POST /api/admin/products (createProduct[1])", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    uploadState.body = validCreateBody()
    uploadState.files = null
    setupUserMocks()
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()

    Product.create.mockImplementation(async (data) => ({
      ...data,
      product_id: PRODUCT_ID,
    }))
    ProductVariation.bulkCreate.mockResolvedValue([])
    ProductImage.bulkCreate.mockResolvedValue([])
  })

  it("returns 201 Product created successfully for admin", async () => {
    Product.create.mockResolvedValue(createdProduct())

    const res = await postProduct()

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Product created successfully")
    expect(res.body.product).toMatchObject({
      product_id: PRODUCT_ID,
      product_name: "Laptop X",
      slug: "laptop-x",
    })
  })

  it("returns 201 Product created successfully for manager", async () => {
    Product.create.mockResolvedValue(createdProduct())

    const res = await postProduct(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Product created successfully")
  })

  it("calls Product.create with is_active true and thumbnail_url when thumbnail file exists", async () => {
    uploadState.files = {
      thumbnail: [{ path: "https://res.cloudinary.com/demo/thumb.png" }],
    }

    await postProduct()

    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_name: "Laptop X",
        slug: "laptop-x",
        thumbnail_url: "https://res.cloudinary.com/demo/thumb.png",
        is_active: true,
      }),
      { transaction: mockTransaction }
    )
  })

  it("calls ProductVariation.bulkCreate with product_id from created product", async () => {
    await postProduct()

    expect(ProductVariation.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          product_id: PRODUCT_ID,
          sku: "LAP-INT-16GB-512GB-DEN",
          is_primary: true,
          price: 25000000,
        }),
      ],
      { transaction: mockTransaction }
    )
  })

  it("calls ProductImage.bulkCreate with is_primary false and display_order for gallery files", async () => {
    uploadState.files = {
      product_images: [
        { path: "https://res.cloudinary.com/demo/gallery-0.png" },
        { path: "https://res.cloudinary.com/demo/gallery-1.png" },
      ],
    }

    await postProduct()

    expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
      [
        {
          product_id: PRODUCT_ID,
          image_url: "https://res.cloudinary.com/demo/gallery-0.png",
          is_primary: false,
          display_order: 0,
        },
        {
          product_id: PRODUCT_ID,
          image_url: "https://res.cloudinary.com/demo/gallery-1.png",
          is_primary: false,
          display_order: 1,
        },
      ],
      { transaction: mockTransaction }
    )
  })

  it("commits transaction on successful create", async () => {
    await postProduct()

    expect(mockTransaction.commit).toHaveBeenCalled()
    expect(mockTransaction.rollback).not.toHaveBeenCalled()
  })

  it("returns 400 Invalid variations data when variations JSON is invalid", async () => {
    uploadState.body = validCreateBody({ variations: "not-json" })

    const res = await postProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid variations data")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(Product.create).not.toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })

  it("returns 400 At least one variation is required when variations array is empty", async () => {
    uploadState.body = validCreateBody({ variations: variationsJson([]) })

    const res = await postProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("At least one variation is required")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(Product.create).not.toHaveBeenCalled()
  })

  it("returns 400 Exactly one variation must be marked as primary when none or multiple primary", async () => {
    uploadState.body = validCreateBody({
      variations: variationsJson([
        primaryVariation({ is_primary: false }),
        primaryVariation({ sku: "LAP-002", is_primary: false }),
      ]),
    })

    const res = await postProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Exactly one variation must be marked as primary")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(Product.create).not.toHaveBeenCalled()
  })

  it("returns 400 when two variations are marked primary", async () => {
    uploadState.body = validCreateBody({
      variations: variationsJson([
        primaryVariation({ is_primary: true }),
        primaryVariation({ sku: "LAP-002", is_primary: true }),
      ]),
    })

    const res = await postProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Exactly one variation must be marked as primary")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).post(CREATE_URL).send({})

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await postProduct(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await postProduct(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("rolls back transaction and returns 500 when Product.create throws", async () => {
    Product.create.mockRejectedValue(new Error("DB insert failed"))

    const res = await postProduct()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB insert failed")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })
})
