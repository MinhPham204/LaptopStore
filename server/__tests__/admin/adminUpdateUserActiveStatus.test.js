const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
}))

const { User } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const TARGET_USER_ID = 5
const statusUrl = (userId = TARGET_USER_ID) => `/api/admin/users/${userId}/status`

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

const buildTargetUser = (overrides = {}) => {
  const user = {
    user_id: TARGET_USER_ID,
    username: "user1",
    email: "a@example.com",
    is_active: true,
    update: jest.fn(async function updateUser(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return user
}

const setupCallerMocks = () => {
  User.findByPk.mockImplementation((id) => {
    const idNum = Number(id)
    if (idNum === TARGET_USER_ID) {
      return Promise.resolve(targetUser)
    }
    if (idNum === MANAGER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: MANAGER_USER_ID,
          username: "manager1",
          Roles: [{ role_name: "manager" }],
        })
      )
    }
    if (idNum === CUSTOMER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: CUSTOMER_USER_ID,
          username: "buyer",
          Roles: [{ role_name: "customer" }],
        })
      )
    }
    if (idNum === STAFF_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: STAFF_USER_ID,
          username: "staff1",
          Roles: [{ role_name: "staff" }],
        })
      )
    }
    return Promise.resolve(userRecord({ user_id: idNum }))
  })
}

let targetUser

const putUserStatus = (body, token = signSessionToken(ADMIN_USER_ID)) =>
  request(app)
    .put(statusUrl())
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("PUT /api/admin/users/:user_id/status (updateUserStatus)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    targetUser = buildTargetUser()
    setupCallerMocks()
  })

  it("returns 200 and deactivates user for admin", async () => {
    const res = await putUserStatus({ is_active: false })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("User status updated successfully")
    expect(targetUser.update).toHaveBeenCalledWith({ is_active: false })
    expect(res.body.user.is_active).toBe(false)
    expect(User.findByPk).toHaveBeenCalledWith(String(TARGET_USER_ID))
  })

  it("returns 200 and deactivates user for manager", async () => {
    const res = await putUserStatus({ is_active: false }, signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("User status updated successfully")
    expect(targetUser.update).toHaveBeenCalledWith({ is_active: false })
    expect(res.body.user.is_active).toBe(false)
  })

  it("returns 200 and activates user when is_active is true", async () => {
    targetUser.is_active = false

    const res = await putUserStatus({ is_active: true })

    expect(res.status).toBe(200)
    expect(targetUser.update).toHaveBeenCalledWith({ is_active: true })
    expect(res.body.user.is_active).toBe(true)
  })

  it("returns user object that may include password_hash from instance (GAP-01)", async () => {
    targetUser = buildTargetUser({
      password_hash: "$2a$10$hashedsecret",
    })
    User.findByPk.mockImplementation((id) => {
      if (Number(id) === TARGET_USER_ID) return Promise.resolve(targetUser)
      return Promise.resolve(userRecord({ user_id: Number(id) }))
    })

    const res = await putUserStatus({ is_active: false })

    expect(res.status).toBe(200)
    expect(res.body.user.password_hash).toBe("$2a$10$hashedsecret")
  })

  it("returns 404 when target user is not found", async () => {
    User.findByPk.mockImplementation((id) => {
      if (Number(id) === TARGET_USER_ID) return Promise.resolve(null)
      return Promise.resolve(userRecord({ user_id: Number(id) }))
    })

    const res = await putUserStatus({ is_active: false })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("User not found")
    expect(targetUser.update).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(statusUrl()).send({ is_active: false })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
  })

  it("returns 403 for customer role", async () => {
    const res = await putUserStatus({ is_active: false }, signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(targetUser.update).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putUserStatus({ is_active: false }, signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(targetUser.update).not.toHaveBeenCalled()
  })

  it("returns 403 when caller is inactive", async () => {
    User.findByPk.mockImplementation((id) => {
      if (Number(id) === ADMIN_USER_ID) {
        return Promise.resolve(
          userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
        )
      }
      if (Number(id) === TARGET_USER_ID) return Promise.resolve(targetUser)
      return Promise.resolve(userRecord({ user_id: Number(id) }))
    })

    const res = await putUserStatus({ is_active: false })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(targetUser.update).not.toHaveBeenCalled()
  })

  it("returns 500 when user.update throws", async () => {
    targetUser.update.mockRejectedValue(new Error("DB update failed"))

    const res = await putUserStatus({ is_active: false })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
  })
})
