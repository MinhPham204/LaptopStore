const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: { findAll: jest.fn() },
}))

const { User, Role } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const TARGET_USER_ID = 5
const rolesUrl = (userId = TARGET_USER_ID) => `/api/admin/users/${userId}/roles`
const feWrongPathUrl = `/api/admin/users/${TARGET_USER_ID}/role`

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

const customerRole = { role_id: 2, role_name: "customer" }
const staffRole = { role_id: 4, role_name: "staff" }

const buildTargetUser = (overrides = {}) => ({
  user_id: TARGET_USER_ID,
  username: "user1",
  setRoles: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

let targetUser

const setupFindByPk = () => {
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

const putUserRoles = (body, token = signSessionToken(ADMIN_USER_ID)) =>
  request(app)
    .put(rolesUrl())
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("PUT /api/admin/users/:user_id/roles (updateUserRoles)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    targetUser = buildTargetUser()
    setupFindByPk()
    Role.findAll.mockResolvedValue([customerRole, staffRole])
  })

  it("returns 200 User roles updated successfully with roles array for admin", async () => {
    const res = await putUserRoles({ role_ids: [2, 4] })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("User roles updated successfully")
    expect(res.body.user).toEqual({
      user_id: TARGET_USER_ID,
      username: "user1",
      roles: [
        { role_id: 2, role_name: "customer" },
        { role_id: 4, role_name: "staff" },
      ],
    })
    expect(User.findByPk).toHaveBeenCalledWith(String(TARGET_USER_ID))
  })

  it("returns 200 User roles updated successfully for manager", async () => {
    const res = await putUserRoles({ role_ids: [2, 4] }, signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("User roles updated successfully")
    expect(res.body.user.roles).toHaveLength(2)
  })

  it("calls Role.findAll with role_ids and setRoles replaces all roles (BR-01)", async () => {
    const roleIds = [2, 4]

    await putUserRoles({ role_ids: roleIds })

    expect(Role.findAll).toHaveBeenCalledWith({ where: { role_id: roleIds } })
    expect(targetUser.setRoles).toHaveBeenCalledWith([customerRole, staffRole])
  })

  it("calls setRoles with empty array when role_ids is empty", async () => {
    Role.findAll.mockResolvedValue([])

    const res = await putUserRoles({ role_ids: [] })

    expect(res.status).toBe(200)
    expect(Role.findAll).toHaveBeenCalledWith({ where: { role_id: [] } })
    expect(targetUser.setRoles).toHaveBeenCalledWith([])
    expect(res.body.user.roles).toEqual([])
  })

  it("sets only roles found in DB when role_ids contains invalid ids (BR-02)", async () => {
    Role.findAll.mockResolvedValue([customerRole])

    const res = await putUserRoles({ role_ids: [2, 999] })

    expect(Role.findAll).toHaveBeenCalledWith({ where: { role_id: [2, 999] } })
    expect(targetUser.setRoles).toHaveBeenCalledWith([customerRole])
    expect(res.body.user.roles).toEqual([{ role_id: 2, role_name: "customer" }])
  })

  it("returns 404 when target user is not found", async () => {
    User.findByPk.mockImplementation((id) => {
      if (Number(id) === TARGET_USER_ID) return Promise.resolve(null)
      return Promise.resolve(userRecord({ user_id: Number(id) }))
    })

    const res = await putUserRoles({ role_ids: [2] })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("User not found")
    expect(Role.findAll).not.toHaveBeenCalled()
    expect(targetUser.setRoles).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(rolesUrl()).send({ role_ids: [2] })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await putUserRoles({ role_ids: [2] }, signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putUserRoles({ role_ids: [2] }, signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Role.findAll).not.toHaveBeenCalled()
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

    const res = await putUserRoles({ role_ids: [2] })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(targetUser.setRoles).not.toHaveBeenCalled()
  })

  it("returns 500 when setRoles throws", async () => {
    targetUser.setRoles.mockRejectedValue(new Error("DB setRoles failed"))

    const res = await putUserRoles({ role_ids: [2, 4] })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB setRoles failed")
  })

  it("returns 404 for FE wrong path PUT /users/:user_id/role (GAP-02)", async () => {
    const res = await request(app)
      .put(feWrongPathUrl)
      .set("Authorization", `Bearer ${signSessionToken(ADMIN_USER_ID)}`)
      .send({ role_ids: [2] })

    expect(res.status).toBe(404)
    expect(Role.findAll).not.toHaveBeenCalled()
    expect(targetUser.setRoles).not.toHaveBeenCalled()
  })
})
