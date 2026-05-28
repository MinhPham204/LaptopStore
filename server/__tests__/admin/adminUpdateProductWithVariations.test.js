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
  Product: { findByPk: jest.fn() },
  ProductVariation: {
    findAll: jest.fn(),
    update: jest.fn(),
    bulkCreate: jest.fn(),
    destroy: jest.fn(),
  },
  ProductImage: { destroy: jest.fn(), bulkCreate: jest.fn() },
}))

const sequelize = require("../../config/database")
const { User, Product, ProductVariation, ProductImage } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const PRODUCT_ID = 101
const updateUrl = (productId = PRODUCT_ID) => `/api/admin/products/${productId}`

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

const variationFields = (overrides = {}) => ({
  processor: "Intel Core i5-12450H",
  ram: "16GB",
  storage: "512GB SSD",
  graphics_card: "RTX 4050",
  screen_size: "15.6 inch",
  color: "Den",
  price: 22000000,
  stock_quantity: 8,
  is_primary: false,
  sku: "LAP-SKU-001",
  ...overrides,
})

const variationsJson = (variations) => JSON.stringify(variations)

const validUpdateBody = (overrides = {}) => ({
  product_name: "Laptop X Updated",
  slug: "laptop-x",
  description: "Updated description",
  category_id: "1",
  brand_id: "2",
  discount_percentage: "5",
  is_active: "true",
  variations: variationsJson([
    variationFields({ variation_id: 5, is_primary: true, sku: "LAP-SKU-5" }),
  ]),
  ...overrides,
})

const buildProduct = (overrides = {}) => {
  const product = {
    product_id: PRODUCT_ID,
    product_name: "Laptop X",
    is_active: true,
    update: jest.fn(async function updateProduct(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return product
}

const fullUpdatedProduct = () => ({
  product_id: PRODUCT_ID,
  product_name: "Laptop X Updated",
  variations: [{ variation_id: 5, sku: "LAP-SKU-5" }],
  images: [{ image_id: 30, image_url: "https://res.cloudinary.com/demo/gallery.png" }],
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

const setupProductFindByPk = (product) => {
  Product.findByPk.mockImplementation((id, options) => {
    if (options && options.include) {
      return Promise.resolve(fullUpdatedProduct())
    }
    return Promise.resolve(product)
  })
}

const putProduct = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).put(updateUrl()).set("Authorization", `Bearer ${token}`).send({})

describe("PUT /api/admin/products/:product_id (updateProduct[1])", () => {
  let product

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    uploadState.body = validUpdateBody()
    uploadState.files = null
    setupUserMocks()
    product = buildProduct()
    setupProductFindByPk(product)
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()

    ProductVariation.findAll.mockResolvedValue([
      { variation_id: 5 },
      { variation_id: 10 },
    ])
    ProductVariation.update.mockResolvedValue([1])
    ProductVariation.bulkCreate.mockResolvedValue([])
    ProductVariation.destroy.mockResolvedValue(1)
    ProductImage.destroy.mockResolvedValue(1)
    ProductImage.bulkCreate.mockResolvedValue([])
  })

  it("returns 200 Product updated successfully with product including variations and images", async () => {
    const res = await putProduct()

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Product updated successfully")
    expect(res.body.product).toMatchObject({
      product_id: PRODUCT_ID,
      variations: expect.any(Array),
      images: expect.any(Array),
    })
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  it("returns 200 Product updated successfully for manager", async () => {
    const res = await putProduct(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Product updated successfully")
  })

  it("syncs variations: update existing, create new, delete removed", async () => {
    uploadState.body = validUpdateBody({
      variations: variationsJson([
        variationFields({
          variation_id: 5,
          is_primary: true,
          sku: "LAP-SKU-5",
          price: 23000000,
        }),
        variationFields({
          is_primary: false,
          sku: "LAP-SKU-NEW",
          color: "Bac",
        }),
      ]),
    })

    await putProduct()

    expect(ProductVariation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "LAP-SKU-5",
        price: 23000000,
      }),
      {
        where: { variation_id: 5 },
        transaction: mockTransaction,
      }
    )
    expect(ProductVariation.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          product_id: String(PRODUCT_ID),
          sku: "LAP-SKU-NEW",
          color: "Bac",
        }),
      ],
      { transaction: mockTransaction }
    )
    expect(ProductVariation.destroy).toHaveBeenCalledWith({
      where: {
        variation_id: [10],
        product_id: String(PRODUCT_ID),
      },
      transaction: mockTransaction,
    })
  })

  it("destroys product images when deleted_image_ids is provided", async () => {
    uploadState.body = validUpdateBody({
      deleted_image_ids: ["20", "21"],
    })

    await putProduct()

    expect(ProductImage.destroy).toHaveBeenCalledWith({
      where: {
        image_id: ["20", "21"],
        product_id: String(PRODUCT_ID),
      },
      transaction: mockTransaction,
    })
  })

  it("updates thumbnail_url and bulkCreates new gallery images from uploaded files", async () => {
    uploadState.files = {
      thumbnail: [{ path: "https://res.cloudinary.com/demo/new-thumb.png" }],
      product_images: [{ path: "https://res.cloudinary.com/demo/new-gallery.png" }],
    }

    await putProduct()

    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail_url: "https://res.cloudinary.com/demo/new-thumb.png",
      }),
      { transaction: mockTransaction }
    )
    expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
      [
        {
          product_id: String(PRODUCT_ID),
          image_url: "https://res.cloudinary.com/demo/new-gallery.png",
          is_primary: false,
          display_order: 0,
        },
      ],
      { transaction: mockTransaction }
    )
  })

  it("passes is_active from request body to product.update", async () => {
    uploadState.body = validUpdateBody({ is_active: "false" })

    await putProduct()

    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: "false",
      }),
      { transaction: mockTransaction }
    )
  })

  it("skips variation sync when variations array is empty (BR-02)", async () => {
    uploadState.body = validUpdateBody({ variations: variationsJson([]) })

    await putProduct()

    expect(ProductVariation.findAll).not.toHaveBeenCalled()
    expect(ProductVariation.update).not.toHaveBeenCalled()
    expect(ProductVariation.bulkCreate).not.toHaveBeenCalled()
    expect(ProductVariation.destroy).not.toHaveBeenCalled()
    expect(product.update).toHaveBeenCalled()
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  it("returns 400 Invalid variations data when JSON parse fails", async () => {
    uploadState.body = validUpdateBody({ variations: "not-json" })

    const res = await putProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid variations data")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(product.update).not.toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })

  it("returns 400 when no variation is marked primary", async () => {
    uploadState.body = validUpdateBody({
      variations: variationsJson([
        variationFields({ variation_id: 5, is_primary: false }),
      ]),
    })

    const res = await putProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Exactly one variation must be marked as primary")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(product.update).not.toHaveBeenCalled()
  })

  it("returns 400 when two variations are marked primary", async () => {
    uploadState.body = validUpdateBody({
      variations: variationsJson([
        variationFields({ variation_id: 5, is_primary: true, sku: "A" }),
        variationFields({ variation_id: 6, is_primary: true, sku: "B" }),
      ]),
    })

    const res = await putProduct()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Exactly one variation must be marked as primary")
    expect(mockTransaction.rollback).toHaveBeenCalled()
  })

  it("returns 404 when product is not found", async () => {
    Product.findByPk.mockResolvedValue(null)

    const res = await putProduct()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(product.update).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(updateUrl()).send({})

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await putProduct(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putProduct(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it("rolls back transaction and returns 500 when product.update throws", async () => {
    product.update.mockRejectedValue(new Error("DB update failed"))

    const res = await putProduct()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
  })
})
