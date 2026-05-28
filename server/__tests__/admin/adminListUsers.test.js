const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Role: { name: "Role" },
}))

const { User, Role } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/users"

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

const sampleUsers = [
  {
    user_id: 5,
    username: "user1",
    email: "a@example.com",
    full_name: "Nguyen A",
    phone_number: "0901234567",
    is_active: true,
    last_login: "2026-05-20T08:00:00.000Z",
    created_at: "2026-01-15T10:00:00.000Z",
    Roles: [{ role_id: 2, role_name: "customer", description: "Khach hang" }],
  },
]

const listResult = (overrides = {}) => ({
  count: 150,
  rows: sampleUsers,
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

const getUsers = (query = "", token = signSessionToken(ADMIN_USER_ID)) => {
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : ""
  return request(app).get(`${LIST_URL}${qs}`).set("Authorization", `Bearer ${token}`)
}

const lastFindAndCountAllCall = () => User.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/admin/users (getAllUsers)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    User.findAndCountAll.mockResolvedValue(listResult())
  })

  it("returns 200 with users and pagination for admin", async () => {
    const res = await getUsers()

    expect(res.status).toBe(200)
    expect(res.body.users).toEqual(sampleUsers)
    expect(res.body.pagination).toEqual({
      total: 150,
      page: 1,
      limit: 20,
      totalPages: 8,
    })
    expect(res.body.users[0]).not.toHaveProperty("password_hash")
  })

  it("returns 200 with users and pagination for manager", async () => {
    const res = await getUsers("", signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
    expect(res.body.pagination.total).toBe(150)
  })

  it("calls User.findAndCountAll excluding password_hash and including Roles", async () => {
    await getUsers()

    expect(User.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: { exclude: ["password_hash"] },
        include: [
          {
            model: Role,
            through: { attributes: [] },
          },
        ],
      })
    )
  })

  it("applies page, limit, offset and computes totalPages", async () => {
    User.findAndCountAll.mockResolvedValue(listResult({ count: 47 }))

    const res = await getUsers("page=2&limit=10")

    expect(lastFindAndCountAllCall()).toMatchObject({
      limit: 10,
      offset: 10,
    })
    expect(res.body.pagination).toEqual({
      total: 47,
      page: 2,
      limit: 10,
      totalPages: 5,
    })
  })

  it.each([
    ["user_id", "user_id"],
    ["username", "username"],
    ["created_at", "created_at"],
    ["last_login", "last_login"],
    ["email", "email"],
  ])("sorts by whitelisted field %s", async (sortField) => {
    await getUsers(`sort=${sortField}&order=ASC`)

    expect(lastFindAndCountAllCall().order).toEqual([[sortField, "ASC"]])
  })

  it("falls back to created_at when sort is not in whitelist", async () => {
    await getUsers("sort=password_hash&order=ASC")

    expect(lastFindAndCountAllCall().order).toEqual([["created_at", "ASC"]])
  })

  it("uses ASC order when order=asc", async () => {
    await getUsers("sort=username&order=asc")

    expect(lastFindAndCountAllCall().order).toEqual([["username", "ASC"]])
  })

  it("uses DESC order when order=DESC", async () => {
    await getUsers("sort=email&order=DESC")

    expect(lastFindAndCountAllCall().order).toEqual([["email", "DESC"]])
  })

  it("falls back to DESC when order is invalid", async () => {
    await getUsers("sort=username&order=invalid")

    expect(lastFindAndCountAllCall().order).toEqual([["username", "DESC"]])
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(User.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await getUsers("", signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(User.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await getUsers("", signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(User.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getUsers()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(User.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 500 when User.findAndCountAll throws", async () => {
    User.findAndCountAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getUsers()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
