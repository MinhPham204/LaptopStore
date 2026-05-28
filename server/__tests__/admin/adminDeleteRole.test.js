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

const ROLE_ID = 6
const deleteUrl = (roleId = ROLE_ID) => `/api/admin/roles/${roleId}`

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

const buildRole = (overrides = {}) => ({
  role_id: ROLE_ID,
  role_name: "warehouse_staff",
  countUsers: jest.fn().mockResolvedValue(0),
  destroy: jest.fn().mockResolvedValue(undefined),
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

const deleteRole = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).delete(deleteUrl()).set("Authorization", `Bearer ${token}`)

describe("DELETE /api/admin/roles/:role_id (deleteRole)", () => {
  let role

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    role = buildRole()
    Role.findByPk.mockResolvedValue(role)
  })

  it("returns 200 Role deleted successfully and calls destroy when countUsers is 0 for admin", async () => {
    const res = await deleteRole()

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Role deleted successfully")
    expect(Role.findByPk).toHaveBeenCalledWith(String(ROLE_ID))
    expect(role.countUsers).toHaveBeenCalled()
    expect(role.destroy).toHaveBeenCalled()
  })

  it("returns 200 Role deleted successfully for manager when countUsers is 0", async () => {
    const res = await deleteRole(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Role deleted successfully")
    expect(role.destroy).toHaveBeenCalled()
  })

  it("returns 404 when role is not found", async () => {
    Role.findByPk.mockResolvedValue(null)

    const res = await deleteRole()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Role not found")
    expect(role.destroy).not.toHaveBeenCalled()
  })

  it("returns 400 Cannot delete role with assigned users when countUsers > 0", async () => {
    role.countUsers.mockResolvedValue(2)

    const res = await deleteRole()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot delete role with assigned users")
    expect(role.countUsers).toHaveBeenCalled()
    expect(role.destroy).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).delete(deleteUrl())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await deleteRole(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await deleteRole(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when role.destroy throws", async () => {
    role.destroy.mockRejectedValue(new Error("DB delete failed"))

    const res = await deleteRole()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB delete failed")
  })
})
