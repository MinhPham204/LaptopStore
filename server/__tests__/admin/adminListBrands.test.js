const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Brand: { findAll: jest.fn() },
}))

const { User, Brand } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/brands"

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

const mockBrands = [
  {
    brand_id: 1,
    brand_name: "ASUS",
    slug: "asus",
    logo_url: "https://cdn.example/asus.png",
    description: "Taiwan brand",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    brand_id: 2,
    brand_name: "Dell",
    slug: "dell",
    logo_url: null,
    description: null,
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

const getBrands = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).get(LIST_URL).set("Authorization", `Bearer ${token}`)

describe("GET /api/admin/brands (adminController.getAllBrands)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Brand.findAll.mockResolvedValue(mockBrands)
  })

  // FR: AC §11 — admin → 200 brands array
  it("returns 200 with brands array for admin (AC §11)", async () => {
    const res = await getBrands()

    expect(res.status).toBe(200)
    expect(res.body.brands).toEqual(mockBrands)
    expect(res.body.brands).toHaveLength(2)
  })

  // FR: AC §11 — manager allowed on API
  it("returns 200 with brands array for manager (AC §11)", async () => {
    const res = await getBrands(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.brands).toEqual(mockBrands)
  })

  // FR: BR-02 / §5 — order brand_name ASC
  it("loads brands ordered by brand_name ASC (BR-02)", async () => {
    await getBrands()

    expect(Brand.findAll).toHaveBeenCalledWith({
      order: [["brand_name", "ASC"]],
    })
  })

  // FR: BR-02 — empty list
  it("returns 200 with empty brands array when none exist", async () => {
    Brand.findAll.mockResolvedValue([])

    const res = await getBrands()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ brands: [] })
  })

  // FR: §4 — 401 no token
  it("returns 401 without bearer token (§4)", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Brand.findAll).not.toHaveBeenCalled()
  })

  // FR: §4 — 403 customer
  it("returns 403 for customer role (§4)", async () => {
    const res = await getBrands(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Brand.findAll).not.toHaveBeenCalled()
  })

  // FR: §4 — 403 staff
  it("returns 403 for staff role (§4)", async () => {
    const res = await getBrands(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Brand.findAll).not.toHaveBeenCalled()
  })

  // FR: §4 — inactive user
  it("returns 403 when user is inactive (§4)", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getBrands()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Brand.findAll).not.toHaveBeenCalled()
  })

  // FR: §4 — 500 DB error
  it("returns 500 when Brand.findAll throws (§4)", async () => {
    Brand.findAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getBrands()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
