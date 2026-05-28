const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: { name: "Role" },
}))

const { User, Role } = require("../../models")
const { authenticateToken } = require("../../middleware/auth")

const TEST_SECRET = "test-jwt-secret-for-unit-tests"
const USER_ID = 42

const signSessionToken = (userId = USER_ID, secret = TEST_SECRET, options = {}) =>
  jwt.sign({ userId }, secret, { expiresIn: "7d", ...options })

const activeUserRecord = (overrides = {}) => ({
  user_id: USER_ID,
  username: "kiet_shop",
  email: "kiet@example.com",
  full_name: "Nguyen Kiet",
  is_active: true,
  password_hash: "bcrypt-hashed-secret",
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

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

const runAuthenticateToken = async (req) => {
  const res = createMockRes()
  const next = jest.fn()
  await authenticateToken(req, res, next)
  return { res, next }
}

describe("authenticateToken (server/middleware/auth.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = TEST_SECRET
  })

  it("calls next and sets req.user, req.userId, req.userRoles for valid Bearer token", async () => {
    const dbUser = activeUserRecord()
    User.findByPk.mockResolvedValue(dbUser)
    const req = { headers: { authorization: `Bearer ${signSessionToken()}` } }

    const { res, next } = await runAuthenticateToken(req)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBeNull()
    expect(req.user).toBe(dbUser)
    expect(req.userId).toBe(USER_ID)
    expect(req.userRoles).toEqual(["customer"])
  })

  it("maps multiple Roles to req.userRoles array", async () => {
    User.findByPk.mockResolvedValue(
      activeUserRecord({
        Roles: [{ role_name: "customer" }, { role_name: "admin" }],
      })
    )
    const req = { headers: { authorization: `Bearer ${signSessionToken()}` } }

    await runAuthenticateToken(req)

    expect(req.userRoles).toEqual(["customer", "admin"])
  })

  it("loads user with Role include and excludes password_hash from query", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord())
    const req = { headers: { authorization: `Bearer ${signSessionToken()}` } }

    await runAuthenticateToken(req)

    expect(User.findByPk).toHaveBeenCalledWith(USER_ID, {
      include: [{ model: Role, through: { attributes: [] } }],
      attributes: { exclude: ["password_hash"] },
    })
  })

  it("returns 401 Access token required when Authorization header is missing", async () => {
    const { res, next } = await runAuthenticateToken({ headers: {} })

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(next).not.toHaveBeenCalled()
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  it("returns 401 when Bearer token part is empty", async () => {
    const { res, next } = await runAuthenticateToken({
      headers: { authorization: "Bearer" },
    })

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(next).not.toHaveBeenCalled()
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  it("returns 401 Invalid or expired token for malformed JWT", async () => {
    const { res, next } = await runAuthenticateToken({
      headers: { authorization: "Bearer not-a-valid-jwt" },
    })

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(next).not.toHaveBeenCalled()
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  it("returns 401 for expired JWT", async () => {
    const expiredToken = signSessionToken(USER_ID, TEST_SECRET, { expiresIn: "-1s" })

    const { res, next } = await runAuthenticateToken({
      headers: { authorization: `Bearer ${expiredToken}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 401 when JWT signed with wrong secret", async () => {
    const token = signSessionToken(USER_ID, "wrong-secret-key")

    const { res, next } = await runAuthenticateToken({
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(next).not.toHaveBeenCalled()
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 User not found or inactive when user is null", async () => {
    User.findByPk.mockResolvedValue(null)
    const { res, next } = await runAuthenticateToken({
      headers: { authorization: `Bearer ${signSessionToken()}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 403 when user is_active is false", async () => {
    User.findByPk.mockResolvedValue(activeUserRecord({ is_active: false }))
    const { res, next } = await runAuthenticateToken({
      headers: { authorization: `Bearer ${signSessionToken()}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(next).not.toHaveBeenCalled()
  })
})
