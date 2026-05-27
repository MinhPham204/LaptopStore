const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  Role: { findOne: jest.fn() },
  Cart: { create: jest.fn() },
}))

const { User, Role, Cart } = require("../../models")
const authRoutes = require("../../routes/authRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/auth", authRoutes)
app.use(errorHandler)

const REGISTER_EMAIL_URL = "/api/auth/register-email"
const LOGIN_URL = "/api/auth/login"

const validPayload = () => ({
  username: "kietpham",
  email: "kiet@example.com",
  password: "secret123",
  full_name: "Kiệt Phạm",
  phone_number: "0901234567",
})

const createdUserFixture = (overrides = {}) => ({
  user_id: 42,
  username: "kietpham",
  email: "kiet@example.com",
  full_name: "Kiệt Phạm",
  phone_number: "0901234567",
  addRole: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const customerRoleFixture = () => ({ role_id: 1, role_name: "customer" })

const extractVerifyTokenFromLogs = (logSpy) => {
  const combined = logSpy.mock.calls.map((args) => args.join(" ")).join("\n")
  const match = combined.match(/verify-email\?token=([^\s)]+)/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

const setupRegisterEmailSuccess = () => {
  User.findOne.mockResolvedValue(null)
  Role.findOne.mockResolvedValue(customerRoleFixture())
  User.create.mockResolvedValue(createdUserFixture())
  Cart.create.mockResolvedValue({ cart_id: 1, user_id: 42 })
}

describe("POST /api/auth/register-email", () => {
  let logSpy
  const savedEnv = {}

  beforeEach(() => {
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

    ;["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"].forEach((key) => {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    })

    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    process.env.API_PUBLIC_URL = "http://localhost:5000"
    delete process.env.EMAIL_VERIFY_EXPIRES_IN
  })

  afterEach(() => {
    logSpy.mockRestore()
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
  })

  // FR: AC1 / BR-02 — đăng ký thành công → 201, không token/user
  it("returns 201 with message and email only (no session token)", async () => {
    setupRegisterEmailSuccess()

    const res = await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      message: "Verification email sent",
      email: "kiet@example.com",
    })
    expect(res.body.token).toBeUndefined()
    expect(res.body.user).toBeUndefined()
  })

  // FR: AC2 / BR-01 — user inactive cho đến khi verify
  it("creates user with is_active false", async () => {
    setupRegisterEmailSuccess()

    await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "kietpham",
        email: "kiet@example.com",
        is_active: false,
        password_hash: "secret123",
      })
    )
  })

  // FR: AC4 / BR-05 — link verify trỏ backend
  it("logs verify-email URL when user is created (dev sendEmail skip)", async () => {
    setupRegisterEmailSuccess()

    await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    const token = extractVerifyTokenFromLogs(logSpy)
    expect(token).not.toBeNull()
    expect(logSpy.mock.calls.some((args) =>
      String(args.join(" ")).includes("/api/auth/verify-email?token=")
    )).toBe(true)
  })

  // FR: AC4 / BR-03 / BR-04 — purpose email_verify, TTL ~24h
  it("issues email_verify JWT with userId and email in dev log", async () => {
    setupRegisterEmailSuccess()

    await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    const token = extractVerifyTokenFromLogs(logSpy)
    const decoded = jwt.decode(token)

    expect(decoded.purpose).toBe("email_verify")
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe("kiet@example.com")
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(24 * 60 * 60 + 5)
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(23 * 60 * 60)
  })

  // FR: BR-06 — thiếu SMTP vẫn 201
  it("returns 201 when SMTP is not configured (sendEmail fail-open)", async () => {
    setupRegisterEmailSuccess()

    const res = await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    expect(res.status).toBe(201)
    expect(
      logSpy.mock.calls.some((args) => String(args[0]).includes("[MAIL] Missing EMAIL_*"))
    ).toBe(true)
  })

  // FR: AC7 / BR-07 — role customer + cart (chi tiết thứ tự cart: autoCreateCartOnRegistration.test.js)
  it("assigns customer role and creates cart for inactive user", async () => {
    const user = createdUserFixture()
    setupRegisterEmailSuccess()
    User.create.mockResolvedValue(user)

    await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

    expect(Role.findOne).toHaveBeenCalledWith({ where: { role_name: "customer" } })
    expect(user.addRole).toHaveBeenCalledWith(customerRoleFixture())
    expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })
  })

  describe("validation — 400", () => {
    it("returns 400 when username is too short", async () => {
      const res = await request(app)
        .post(REGISTER_EMAIL_URL)
        .send({ ...validPayload(), username: "ab" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Username must be 3-50 characters",
            path: "username",
          }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
      const res = await request(app)
        .post(REGISTER_EMAIL_URL)
        .send({ ...validPayload(), email: "bad" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "Invalid email", path: "email" }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when password is too short", async () => {
      const res = await request(app)
        .post(REGISTER_EMAIL_URL)
        .send({ ...validPayload(), password: "12345" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Password must be at least 6 characters",
            path: "password",
          }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when phone_number is invalid", async () => {
      const res = await request(app)
        .post(REGISTER_EMAIL_URL)
        .send({ ...validPayload(), phone_number: "abc" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Invalid phone number",
            path: "phone_number",
          }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })
  })

  describe("conflict — 409", () => {
    // FR: AC5 — trùng user → 409, không tạo cart
    it("returns 409 on duplicate username without creating cart", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "other@example.com",
        phone_number: "0999999999",
      })

      const res = await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.message).toBe("Duplicate entry")
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "DUPLICATE_USERNAME" }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
      expect(Cart.create).not.toHaveBeenCalled()
    })

    it("returns 409 with multiple duplicate errors", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "kiet@example.com",
        phone_number: "0901234567",
      })

      const res = await request(app).post(REGISTER_EMAIL_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.errors).toHaveLength(3)
      expect(Cart.create).not.toHaveBeenCalled()
    })
  })
})

// FR: AC3 / BR-08 — login trước khi verify → 403 inactive
describe("POST /api/auth/login — pre-verify user (AC3)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 403 Account is inactive for unverified user", async () => {
    const inactiveUser = {
      user_id: 42,
      username: "kietpham",
      email: "kiet@example.com",
      is_active: false,
      comparePassword: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
      Roles: [{ role_name: "customer" }],
    }
    User.findOne.mockResolvedValue(inactiveUser)

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ username: "kietpham", password: "secret123" })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Account is inactive")
    expect(inactiveUser.comparePassword).toHaveBeenCalledWith("secret123")
    expect(inactiveUser.update).not.toHaveBeenCalled()
  })
})
