const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Order: { findAndCountAll: jest.fn() },
  Payment: {},
}))

const { User, Order, Payment } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/orders"

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

const sampleOrders = [
  {
    order_id: 42,
    order_code: "ORD-20260527-ABCD",
    user_id: 5,
    final_amount: "25030000.00",
    status: "processing",
    shipping_name: "Nguyen Van A",
    created_at: "2026-05-27T10:00:00.000Z",
    user: {
      user_id: 5,
      username: "buyer1",
      email: "buyer@example.com",
      full_name: "Nguyen Van A",
      phone_number: "0901234567",
    },
    payment: {
      payment_id: 10,
      payment_method: "COD",
      payment_status: "pending",
      provider: "COD",
    },
  },
]

const listResult = (overrides = {}) => ({
  count: 120,
  rows: sampleOrders,
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

const getOrders = (query = "", token = signSessionToken(ADMIN_USER_ID)) => {
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : ""
  return request(app).get(`${LIST_URL}${qs}`).set("Authorization", `Bearer ${token}`)
}

const lastFindAndCountAllCall = () => Order.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/admin/orders (adminController.getAllOrders)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Order.findAndCountAll.mockResolvedValue(listResult())
  })

  it("returns 200 with orders and pagination for admin", async () => {
    const res = await getOrders()

    expect(res.status).toBe(200)
    expect(res.body.orders).toEqual(sampleOrders)
    expect(res.body.pagination).toEqual({
      total: 120,
      page: 1,
      limit: 20,
      totalPages: 6,
    })
  })

  it("returns 200 with orders and pagination for manager", async () => {
    const res = await getOrders("", signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
    expect(res.body.pagination.total).toBe(120)
  })

  it("uses empty where when status query is omitted", async () => {
    await getOrders()

    expect(lastFindAndCountAllCall().where).toEqual({})
    expect(lastFindAndCountAllCall().where).not.toHaveProperty("status")
  })

  it("filters by status=processing when query param is set", async () => {
    await getOrders("status=processing")

    expect(lastFindAndCountAllCall().where).toEqual({ status: "processing" })
  })

  it("applies page, limit, offset and computes totalPages", async () => {
    Order.findAndCountAll.mockResolvedValue(listResult({ count: 47 }))

    const res = await getOrders("page=2&limit=10")

    expect(Order.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 10,
      })
    )
    expect(res.body.pagination).toEqual({
      total: 47,
      page: 2,
      limit: 10,
      totalPages: 5,
    })
  })

  it("includes user and payment with correct attributes and sorts by created_at DESC", async () => {
    await getOrders()

    const call = lastFindAndCountAllCall()
    expect(call.order).toEqual([["created_at", "DESC"]])
    expect(call.include).toEqual([
      {
        model: User,
        as: "user",
        attributes: ["user_id", "username", "email", "full_name", "phone_number"],
      },
      {
        model: Payment,
        as: "payment",
        attributes: ["payment_id", "payment_method", "payment_status", "provider"],
      },
    ])
  })

  // FR: BR-01 — server does not filter by payment_status
  it("does not filter by payment_status in where clause (BR-01)", async () => {
    await getOrders("status=cancelled")

    const { where } = lastFindAndCountAllCall()
    expect(where).toEqual({ status: "cancelled" })
    expect(where).not.toHaveProperty("payment_status")
    expect(JSON.stringify(where)).not.toMatch(/payment_status/)
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Order.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await getOrders("", signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Order.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await getOrders("", signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Order.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 500 when Order.findAndCountAll throws", async () => {
    Order.findAndCountAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getOrders()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
