jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: { name: "Role" },
}))

const { authorizeRoles } = require("../../middleware/auth")

/** Same whitelist as server/routes/adminRoutes.js */
const adminManagerGate = authorizeRoles("admin", "manager")

const createMockRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  return res
}

const runAuthorizeRoles = (req) => {
  const res = createMockRes()
  const next = jest.fn()
  adminManagerGate(req, res, next)
  return { res, next }
}

const userWithRoles = (roleNames) => ({
  user_id: 1,
  Roles: roleNames.map((role_name) => ({ role_name })),
})

describe("authorizeRoles (server/middleware/auth.js)", () => {
  it("calls next when user has admin role", () => {
    const req = { user: userWithRoles(["admin"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBeNull()
    expect(res.body).toBeNull()
  })

  it("calls next when user has manager role", () => {
    const req = { user: userWithRoles(["manager"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBeNull()
  })

  it("calls next when user has admin and customer roles (OR logic BR-03)", () => {
    const req = { user: userWithRoles(["customer", "admin"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBeNull()
  })

  it("returns 401 Authentication required when req.user is missing (BR-05)", () => {
    const req = {}
    const { res, next } = runAuthorizeRoles(req)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: "Authentication required" })
  })

  it("returns 403 Insufficient permissions for customer-only role (BR-04)", () => {
    const req = { user: userWithRoles(["customer"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: "Insufficient permissions" })
  })

  it("returns 403 for staff role not in whitelist", () => {
    const req = { user: userWithRoles(["staff"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: "Insufficient permissions" })
  })

  it("returns 403 when role_name casing does not match admin (BR-02)", () => {
    const req = { user: userWithRoles(["Admin"]) }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: "Insufficient permissions" })
  })

  it("returns 403 when user has empty Roles array", () => {
    const req = { user: { user_id: 1, Roles: [] } }
    const { res, next } = runAuthorizeRoles(req)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ message: "Insufficient permissions" })
  })

  it("throws when req.user.Roles is undefined (GAP-02)", () => {
    const req = { user: { user_id: 1 } }

    expect(() => runAuthorizeRoles(req)).toThrow(TypeError)
  })
})
