const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), name: "User" },
  Role: { findAll: jest.fn() },
}))

const { User, Role } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/roles"

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

const mockRoles = [
  {
    role_id: 1,
    role_name: "admin",
    description: "Quan tri vien he thong",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    Users: [
      {
        user_id: 1,
        username: "super_admin",
        email: "admin@laptopstore.com",
      },
    ],
  },
  {
    role_id: 2,
    role_name: "customer",
    description: null,
    created_at: "2025-01-02T00:00:00.000Z",
    updated_at: "2025-01-02T00:00:00.000Z",
    Users: [
      {
        user_id: 10,
        username: "buyer1",
        email: "buyer@example.com",
      },
    ],
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

const getRoles = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).get(LIST_URL).set("Authorization", `Bearer ${token}`)

describe("GET /api/admin/roles (getAllRoles)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Role.findAll.mockResolvedValue(mockRoles)
  })

  it("returns 200 with roles array for admin", async () => {
    const res = await getRoles()

    expect(res.status).toBe(200)
    expect(res.body.roles).toEqual(mockRoles)
    expect(res.body.roles).toHaveLength(2)
    expect(res.body.roles[0].role_name).toBe("admin")
  })

  it("returns 200 with roles array for manager", async () => {
    const res = await getRoles(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.roles).toEqual(mockRoles)
  })

  it("calls Role.findAll with User include and empty through attributes", async () => {
    await getRoles()

    expect(Role.findAll).toHaveBeenCalledWith({
      include: [
        {
          model: User,
          through: { attributes: [] },
        },
      ],
    })
  })

  it("returns roles with nested Users in response", async () => {
    const res = await getRoles()

    expect(res.body.roles[0].Users).toHaveLength(1)
    expect(res.body.roles[0].Users[0]).toMatchObject({
      user_id: 1,
      username: "super_admin",
      email: "admin@laptopstore.com",
    })
    expect(res.body.roles[1].Users[0].username).toBe("buyer1")
  })

  it("passes through nested Users fields from DB without excluding password_hash (GAP-03)", async () => {
    Role.findAll.mockResolvedValue([
      {
        role_id: 1,
        role_name: "admin",
        Users: [
          {
            user_id: 1,
            username: "admin",
            password_hash: "$2b$10$hashed",
          },
        ],
      },
    ])

    const res = await getRoles()

    expect(res.body.roles[0].Users[0].password_hash).toBe("$2b$10$hashed")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await getRoles(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await getRoles(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getRoles()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 500 when Role.findAll throws", async () => {
    Role.findAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getRoles()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
