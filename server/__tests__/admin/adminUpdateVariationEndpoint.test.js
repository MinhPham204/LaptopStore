const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  ProductVariation: { findByPk: jest.fn() },
}))

const { User, ProductVariation } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const PRODUCT_ID = 101
const VARIATION_ID = 205
const updateUrl = (variationId = VARIATION_ID) => `/api/admin/variations/${variationId}`
const feWrongPathUrl = `/api/admin/products/${PRODUCT_ID}/variations/${VARIATION_ID}`

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

const fullUpdateBody = () => ({
  price: 29990000,
  stock_quantity: 3,
  is_primary: true,
  processor: "Intel Core i7-13700H",
  ram: "32GB",
  storage: "1TB SSD",
  graphics_card: "RTX 4060",
  screen_size: "16 inch",
  color: "Bac",
  sku: "LAP-INT-32GB-1TB-BAC",
  is_available: false,
})

const buildVariation = (overrides = {}) => {
  const variation = {
    variation_id: VARIATION_ID,
    product_id: PRODUCT_ID,
    sku: "LAP-OLD-SKU",
    price: "25000000.00",
    stock_quantity: 10,
    update: jest.fn(async function updateVariation(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return variation
}

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

const putVariation = (body, token = signSessionToken(ADMIN_USER_ID)) =>
  request(app)
    .put(updateUrl())
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("PUT /api/admin/variations/:variation_id (updateVariation)", () => {
  let variation

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    variation = buildVariation()
    ProductVariation.findByPk.mockResolvedValue(variation)
  })

  it("returns 200 Variation updated successfully for admin", async () => {
    const body = fullUpdateBody()
    const res = await putVariation(body)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Variation updated successfully")
    expect(res.body.variation).toMatchObject({
      variation_id: VARIATION_ID,
      sku: body.sku,
      stock_quantity: body.stock_quantity,
    })
    expect(ProductVariation.findByPk).toHaveBeenCalledWith(String(VARIATION_ID))
  })

  it("returns 200 Variation updated successfully for manager", async () => {
    const res = await putVariation(fullUpdateBody(), signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Variation updated successfully")
  })

  it("calls variation.update with full req.body mass assignment (BR-01)", async () => {
    const body = fullUpdateBody()

    await putVariation(body)

    expect(variation.update).toHaveBeenCalledWith(body)
  })

  it("returns 200 for partial body update", async () => {
    const partial = { price: 27990000, stock_quantity: 7 }

    const res = await putVariation(partial)

    expect(res.status).toBe(200)
    expect(variation.update).toHaveBeenCalledWith(partial)
    expect(res.body.variation.price).toBe(27990000)
    expect(res.body.variation.stock_quantity).toBe(7)
  })

  it("returns 404 when variation is not found", async () => {
    ProductVariation.findByPk.mockResolvedValue(null)

    const res = await putVariation(fullUpdateBody())

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Variation not found")
    expect(variation.update).not.toHaveBeenCalled()
  })

  it("returns 409 when variation.update throws SequelizeUniqueConstraintError (duplicate sku)", async () => {
    const uniqueErr = new Error("unique violation")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    uniqueErr.errors = [{ path: "sku", message: "sku must be unique" }]
    variation.update.mockRejectedValue(uniqueErr)

    const res = await putVariation(fullUpdateBody())

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("Duplicate entry")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(updateUrl()).send(fullUpdateBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await putVariation(fullUpdateBody(), signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putVariation(fullUpdateBody(), signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when variation.update throws", async () => {
    variation.update.mockRejectedValue(new Error("DB update failed"))

    const res = await putVariation(fullUpdateBody())

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
  })

  it("returns 404 for FE wrong path PUT /products/:product_id/variations/:variation_id (GAP-01)", async () => {
    const res = await request(app)
      .put(feWrongPathUrl)
      .set("Authorization", `Bearer ${signSessionToken(ADMIN_USER_ID)}`)
      .send(fullUpdateBody())

    expect(res.status).toBe(404)
    expect(ProductVariation.findByPk).not.toHaveBeenCalled()
  })
})
