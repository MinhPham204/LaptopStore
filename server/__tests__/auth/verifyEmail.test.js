const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
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

const VERIFY_URL = "/api/auth/verify-email"
const FE_BASE = "http://localhost:3000"

const signEmailVerifyToken = (overrides = {}) =>
  jwt.sign(
    {
      purpose: "email_verify",
      userId: 42,
      email: "a@b.com",
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  )

const extractSessionToken = (location) => {
  const url = new URL(location)
  return decodeURIComponent(url.searchParams.get("token") || "")
}

const inactiveUserFixture = (overrides = {}) => ({
  user_id: 42,
  email: "a@b.com",
  is_active: false,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    process.env.FRONTEND_URL = FE_BASE
    delete process.env.CLIENT_URL
  })

  // FR: AC1 / AC2 / BR-01 — token hợp lệ, user inactive → activate + session redirect
  it("redirects to oauth success and activates inactive user on valid email_verify token", async () => {
    const user = inactiveUserFixture()
    User.findByPk.mockResolvedValue(user)
    const verifyToken = signEmailVerifyToken()

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: verifyToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(
      new RegExp(`^${FE_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/oauth/success\\?token=`)
    )

    expect(user.update).toHaveBeenCalledWith({ is_active: true })
    expect(User.findByPk).toHaveBeenCalledWith(42)

    const sessionToken = extractSessionToken(res.headers.location)
    const sessionPayload = jwt.verify(sessionToken, process.env.JWT_SECRET)
    expect(sessionPayload.userId).toBe(42)
    expect(sessionPayload.purpose).toBeUndefined()
  })

  // FR: BR-02 — user đã active → vẫn success, không update
  it("redirects to oauth success without update when user is already active", async () => {
    const user = inactiveUserFixture({ is_active: true })
    User.findByPk.mockResolvedValue(user)

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: signEmailVerifyToken() })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain(`${FE_BASE}/oauth/success?token=`)
    expect(user.update).not.toHaveBeenCalled()

    const sessionPayload = jwt.verify(
      extractSessionToken(res.headers.location),
      process.env.JWT_SECRET
    )
    expect(sessionPayload.userId).toBe(42)
  })

  // FR: AC3 — thiếu token query
  it("redirects to login with verify=missing when token is absent", async () => {
    const res = await request(app).get(VERIFY_URL).redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=missing`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — JWT hết hạn
  it("redirects to login with verify=invalid when token is expired", async () => {
    const expiredToken = jwt.sign(
      { purpose: "email_verify", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    )

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: expiredToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC3 — JWT không hợp lệ
  it("redirects to login with verify=invalid when token is malformed", async () => {
    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: "not-a-jwt" })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: §12 — purpose password_reset → invalid
  it("redirects to login with verify=invalid when purpose is not email_verify", async () => {
    const wrongPurposeToken = jwt.sign(
      { purpose: "password_reset", userId: 42, email: "a@b.com" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    )

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: wrongPurposeToken })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=invalid`)
    expect(User.findByPk).not.toHaveBeenCalled()
  })

  // FR: AC4 — user không tồn tại
  it("redirects to login with verify=notfound when user does not exist", async () => {
    User.findByPk.mockResolvedValue(null)

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: signEmailVerifyToken() })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=notfound`)
  })

  // FR: edge — findByPk throw → verify=error
  it("redirects to login with verify=error when database lookup throws", async () => {
    User.findByPk.mockRejectedValue(new Error("DB connection failed"))

    const res = await request(app)
      .get(VERIFY_URL)
      .query({ token: signEmailVerifyToken() })
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_BASE}/login?verify=error`)
  })
})
