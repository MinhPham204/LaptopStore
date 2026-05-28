const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Category: { findAll: jest.fn() },
}))

const { User, Category } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/categories"

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

const mockCategories = [
  {
    category_id: 1,
    category_name: "Laptop Gaming",
    slug: "laptop-gaming",
    description: "High performance",
    parent_id: null,
    icon_url: "https://cdn.example/gaming.png",
    display_order: 1,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    category_id: 2,
    category_name: "Office Laptops",
    slug: "office-laptops",
    description: null,
    parent_id: null,
    icon_url: null,
    display_order: 2,
    created_at: "2025-02-01T00:00:00.000Z",
    updated_at: "2025-02-01T00:00:00.000Z",
  },
]

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

const getCategories = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).get(LIST_URL).set("Authorization", `Bearer ${token}`)

describe("GET /api/admin/categories (adminController.getAllCategories)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Category.findAll.mockResolvedValue(mockCategories)
  })

  // FR: §4 / AC — admin → 200 categories array
  it("returns 200 with categories array for admin", async () => {
    const res = await getCategories()

    expect(res.status).toBe(200)
    expect(res.body.categories).toEqual(mockCategories)
    expect(res.body.categories).toHaveLength(2)
  })

  // FR: §2 — manager allowed on API
  it("returns 200 with categories array for manager", async () => {
    const res = await getCategories(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.categories).toEqual(mockCategories)
  })

  // FR: §5 — order display_order ASC
  it("loads categories ordered by display_order ASC", async () => {
    await getCategories()

    expect(Category.findAll).toHaveBeenCalledWith({
      order: [["display_order", "ASC"]],
    })
  })

  it("returns 200 with empty categories array when none exist", async () => {
    Category.findAll.mockResolvedValue([])

    const res = await getCategories()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ categories: [] })
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Category.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await getCategories(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await getCategories(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getCategories()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Category.findAll).not.toHaveBeenCalled()
  })

  it("returns 500 when Category.findAll throws", async () => {
    Category.findAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getCategories()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
