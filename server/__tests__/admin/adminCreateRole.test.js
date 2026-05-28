const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: { create: jest.fn() },
}))

const { User, Role } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const CREATE_URL = "/api/admin/roles"

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

const validRoleBody = () => ({
  role_name: "warehouse_staff",
  description: "Nhan vien kho — quyen tuy chinh sau",
})

const createdRole = (overrides = {}) => ({
  role_id: 6,
  role_name: "warehouse_staff",
  description: "Nhan vien kho — quyen tuy chinh sau",
  created_at: "2026-05-28T10:00:00.000Z",
  updated_at: "2026-05-28T10:00:00.000Z",
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

const postRole = (body = validRoleBody(), token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).post(CREATE_URL).set("Authorization", `Bearer ${token}`).send(body)

describe("POST /api/admin/roles (createRole)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Role.create.mockResolvedValue(createdRole())
  })

  it("returns 201 Role created successfully with role object for admin", async () => {
    const res = await postRole()

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Role created successfully")
    expect(res.body.role).toMatchObject({
      role_id: 6,
      role_name: "warehouse_staff",
      description: "Nhan vien kho — quyen tuy chinh sau",
    })
  })

  it("returns 201 Role created successfully for manager", async () => {
    const res = await postRole(validRoleBody(), signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Role created successfully")
    expect(res.body.role.role_name).toBe("warehouse_staff")
  })

  it("calls Role.create with role_name and description from body", async () => {
    const body = validRoleBody()

    await postRole(body)

    expect(Role.create).toHaveBeenCalledWith({
      role_name: body.role_name,
      description: body.description,
    })
  })

  it("returns 409 when Role.create throws SequelizeUniqueConstraintError (duplicate role_name)", async () => {
    const uniqueErr = new Error("unique violation")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    uniqueErr.errors = [{ path: "role_name", message: "role_name must be unique" }]
    Role.create.mockRejectedValue(uniqueErr)

    const res = await postRole()

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("Duplicate entry")
  })

  it("returns 500 when Role.create throws", async () => {
    Role.create.mockRejectedValue(new Error("DB insert failed"))

    const res = await postRole()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB insert failed")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).post(CREATE_URL).send(validRoleBody())

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Role.create).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await postRole(validRoleBody(), signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.create).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await postRole(validRoleBody(), signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.create).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await postRole()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Role.create).not.toHaveBeenCalled()
  })
})
