const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Category: { findByPk: jest.fn() },
}))

const { User, Category } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const CATEGORY_ID = 10
const deleteUrl = (id = CATEGORY_ID) => `/api/admin/categories/${id}`

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

const buildCategory = (overrides = {}) => {
  const category = {
    category_id: CATEGORY_ID,
    category_name: "Office Laptops",
    slug: "office-laptops",
    countProducts: jest.fn().mockResolvedValue(0),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return category
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

const deleteCategory = (id = CATEGORY_ID, token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).delete(deleteUrl(id)).set("Authorization", `Bearer ${token}`)

describe("DELETE /api/admin/categories/:category_id (deleteCategory)", () => {
  let category

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    category = buildCategory()
    Category.findByPk.mockResolvedValue(category)
  })

  // FR: AC §10 — admin, no products
  it("returns 200 and calls destroy when countProducts is 0 for admin", async () => {
    const res = await deleteCategory()

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Category deleted successfully")
    expect(Category.findByPk).toHaveBeenCalledWith(String(CATEGORY_ID))
    expect(category.countProducts).toHaveBeenCalled()
    expect(category.destroy).toHaveBeenCalledTimes(1)
  })

  // FR: AC §10 — manager
  it("returns 200 and calls destroy when countProducts is 0 for manager", async () => {
    const res = await deleteCategory(CATEGORY_ID, signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Category deleted successfully")
    expect(category.destroy).toHaveBeenCalledTimes(1)
  })

  // FR: §4 — 404
  it("returns 404 when category is not found", async () => {
    Category.findByPk.mockResolvedValue(null)

    const res = await deleteCategory()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Category not found")
    expect(category.destroy).not.toHaveBeenCalled()
  })

  // FR: BR-02 — products block delete
  it("returns 400 and does not destroy when countProducts > 0", async () => {
    category.countProducts.mockResolvedValue(3)

    const res = await deleteCategory()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot delete category with associated products")
    expect(category.destroy).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).delete(deleteUrl())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await deleteCategory(CATEGORY_ID, signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await deleteCategory(CATEGORY_ID, signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when destroy throws", async () => {
    category.destroy.mockRejectedValue(new Error("DB delete failed"))

    const res = await deleteCategory()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB delete failed")
  })
})
