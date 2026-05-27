const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Role: {},
  Cart: {},
}))

const { User } = require("../../models")
const authRoutes = require("../../routes/authRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/auth", authRoutes)
app.use(errorHandler)

const ME_URL = "/api/auth/me"

const signSessionToken = (userId, overrides = {}) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
    ...overrides,
  })

const activeUserDbRecord = (overrides = {}) => ({
  user_id: 42,
  username: "kiet_shop",
  email: "kiet@example.com",
  full_name: "Nguyen Kiet",
  phone_number: "0901234567",
  address: "123 Đường ABC",
  avatar_url: "https://cdn.example/avatar.png",
  is_active: true,
  password_hash: "bcrypt-hashed-secret",
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
  })

  // FR: AC1 — Bearer hợp lệ + user active → 200, không password_hash
  it("returns 200 with user profile when token is valid and user is active", async () => {
    const dbUser = activeUserDbRecord()
    User.findByPk.mockResolvedValue(dbUser)
    const token = signSessionToken(42)

    const res = await request(app).get(ME_URL).set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({
      user_id: 42,
      username: "kiet_shop",
      email: "kiet@example.com",
      full_name: "Nguyen Kiet",
      phone_number: "0901234567",
      address: "123 Đường ABC",
      avatar_url: "https://cdn.example/avatar.png",
      roles: ["customer"],
    })
    expect(res.body.user.password_hash).toBeUndefined()
    expect(User.findByPk).toHaveBeenCalledTimes(2)
    expect(User.findByPk).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        attributes: { exclude: ["password_hash"] },
      })
    )
  })

  // FR: AC5 — roles là mảng role_name từ DB
  it("returns roles array mapped from user Roles association", async () => {
    User.findByPk.mockResolvedValue(
      activeUserDbRecord({
        Roles: [{ role_name: "customer" }, { role_name: "admin" }],
      })
    )
    const token = signSessionToken(42)

    const res = await request(app).get(ME_URL).set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.roles).toEqual(["customer", "admin"])
  })

  // FR: AC2 — thiếu Authorization → 401
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get(ME_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC2 — Bearer không có token
  it("returns 401 when Authorization header has no bearer token", async () => {
    const res = await request(app).get(ME_URL).set("Authorization", "Bearer")

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — token không hợp lệ → 401
  it("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .get(ME_URL)
      .set("Authorization", "Bearer not-a-valid-jwt")

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — token hết hạn → 401
  it("returns 401 when token is expired", async () => {
    const token = jwt.sign(
      { userId: 42 },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    )

    const res = await request(app).get(ME_URL).set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Invalid or expired token")
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC4 — user inactive → 403
  it("returns 403 when user is inactive", async () => {
    User.findByPk.mockResolvedValue(activeUserDbRecord({ is_active: false }))
    const token = signSessionToken(42)

    const res = await request(app).get(ME_URL).set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(User.findByPk).toHaveBeenCalledTimes(1)
  })

  // FR: AC4 — user không tồn tại → 403
  it("returns 403 when user is not found in database", async () => {
    User.findByPk.mockResolvedValue(null)
    const token = signSessionToken(42)

    const res = await request(app).get(ME_URL).set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(User.findByPk).toHaveBeenCalledTimes(1)
  })
})
