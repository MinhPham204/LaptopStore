const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Product: { findByPk: jest.fn() },
}))

const { User, Product } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const PRODUCT_ID = 101
const deleteUrl = (productId = PRODUCT_ID) => `/api/admin/products/${productId}`

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

const buildProduct = (overrides = {}) => {
  const product = {
    product_id: PRODUCT_ID,
    product_name: "Laptop X",
    is_active: true,
    update: jest.fn(async function updateProduct(data) {
      Object.assign(this, data)
      return this
    }),
    destroy: jest.fn(),
    ...overrides,
  }
  return product
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

const deleteProduct = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).delete(deleteUrl()).set("Authorization", `Bearer ${token}`)

describe("DELETE /api/admin/products/:product_id (deleteProduct)", () => {
  let product

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    product = buildProduct()
    Product.findByPk.mockResolvedValue(product)
  })

  it("returns 200 Product deleted successfully for admin", async () => {
    const res = await deleteProduct()

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Product deleted successfully")
    expect(Product.findByPk).toHaveBeenCalledWith(String(PRODUCT_ID))
  })

  it("returns 200 Product deleted successfully for manager", async () => {
    const res = await deleteProduct(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Product deleted successfully")
  })

  it("soft-deletes via product.update({ is_active: false }) and does not destroy (BR-01)", async () => {
    await deleteProduct()

    expect(product.update).toHaveBeenCalledWith({ is_active: false })
    expect(product.destroy).not.toHaveBeenCalled()
    expect(product.is_active).toBe(false)
  })

  it("returns 200 on second DELETE when product row still exists (BR-05 idempotent)", async () => {
    const first = await deleteProduct()
    expect(first.status).toBe(200)

    Product.findByPk.mockResolvedValue(product)

    const second = await deleteProduct()
    expect(second.status).toBe(200)
    expect(second.body.message).toBe("Product deleted successfully")
    expect(product.update).toHaveBeenCalledTimes(2)
    expect(product.destroy).not.toHaveBeenCalled()
  })

  it("returns 404 when product is not found", async () => {
    Product.findByPk.mockResolvedValue(null)

    const res = await deleteProduct()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
    expect(product.update).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).delete(deleteUrl())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await deleteProduct(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await deleteProduct(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Product.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when product.update throws", async () => {
    product.update.mockRejectedValue(new Error("DB update failed"))

    const res = await deleteProduct()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
    expect(product.destroy).not.toHaveBeenCalled()
  })
})
