const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: { findByPk: jest.fn() },
}))

const { User, Role } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const ROLE_ID = 3
const updateUrl = (roleId = ROLE_ID) => `/api/admin/roles/${roleId}`

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

const validUpdateBody = () => ({
  role_name: "manager",
  description: "Quan ly cua hang — cap nhat mo ta",
})

const buildRole = (overrides = {}) => {
  const role = {
    role_id: ROLE_ID,
    role_name: "staff",
    description: "Old description",
    update: jest.fn(async function updateRole(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return role
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

const putRole = (body = validUpdateBody(), token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).put(updateUrl()).set("Authorization", `Bearer ${token}`).send(body)

describe("PUT /api/admin/roles/:role_id (updateRole)", () => {
  let role

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    role = buildRole()
    Role.findByPk.mockResolvedValue(role)
  })

  it("returns 200 Role updated successfully with role object for admin", async () => {
    const body = validUpdateBody()
    const res = await putRole(body)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Role updated successfully")
    expect(res.body.role).toMatchObject({
      role_id: ROLE_ID,
      role_name: body.role_name,
      description: body.description,
    })
    expect(Role.findByPk).toHaveBeenCalledWith(String(ROLE_ID))
  })

  it("returns 200 Role updated successfully for manager", async () => {
    const res = await putRole(validUpdateBody(), signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Role updated successfully")
  })

  it("calls role.update with full req.body mass assignment (BR-01)", async () => {
    const body = validUpdateBody()

    await putRole(body)

    expect(role.update).toHaveBeenCalledWith(body)
  })

  it("returns 404 when role is not found", async () => {
    Role.findByPk.mockResolvedValue(null)

    const res = await putRole()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Role not found")
    expect(role.update).not.toHaveBeenCalled()
  })

  it("returns 409 when role.update throws SequelizeUniqueConstraintError (duplicate role_name)", async () => {
    const uniqueErr = new Error("unique violation")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    uniqueErr.errors = [{ path: "role_name", message: "role_name must be unique" }]
    role.update.mockRejectedValue(uniqueErr)

    const res = await putRole()

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("Duplicate entry")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(updateUrl()).send(validUpdateBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await putRole(validUpdateBody(), signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putRole(validUpdateBody(), signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when role.update throws", async () => {
    role.update.mockRejectedValue(new Error("DB update failed"))

    const res = await putRole()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
  })
})
