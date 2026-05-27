const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findOne: jest.fn() },
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

const LOGIN_URL = "/api/auth/login"

const activeUserFixture = (overrides = {}) => ({
  user_id: 42,
  username: "kietpham",
  email: "kiet@example.com",
  full_name: "Kiệt Phạm",
  phone_number: "0901234567",
  avatar_url: null,
  is_active: true,
  comparePassword: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(undefined),
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: AC1 — username/password đúng, user active → 200
  it("returns 200 with token and user profile when credentials are valid", async () => {
    const user = activeUserFixture()
    User.findOne.mockResolvedValue(user)

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ username: "kietpham", password: "secret123" })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Login successful")
    expect(res.body.token).toBeDefined()

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(payload.userId).toBe(42)

    expect(res.body.user).toEqual({
      user_id: 42,
      username: "kietpham",
      email: "kiet@example.com",
      full_name: "Kiệt Phạm",
      phone_number: "0901234567",
      avatar_url: null,
      roles: ["customer"],
    })

    // FR: BR-01 — lookup by username only
    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { username: "kietpham" },
      })
    )

    // FR: BR-04
    expect(user.comparePassword).toHaveBeenCalledWith("secret123")

    // FR: BR-05 / AC7
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login: expect.any(Date) })
    )
  })

  // FR: BR-08 — response includes avatar_url
  it("includes avatar_url in user object on success", async () => {
    const user = activeUserFixture({ avatar_url: "https://cdn.example/avatar.png" })
    User.findOne.mockResolvedValue(user)

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ username: "kietpham", password: "secret123" })

    expect(res.status).toBe(200)
    expect(res.body.user.avatar_url).toBe("https://cdn.example/avatar.png")
  })

  describe("validation — 400", () => {
    // FR: validation — username required
    it("returns 400 when username is missing", async () => {
      const res = await request(app)
        .post(LOGIN_URL)
        .send({ password: "secret123" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Username is required",
            path: "username",
          }),
        ])
      )
      expect(User.findOne).not.toHaveBeenCalled()
    })

    // FR: validation — password required
    it("returns 400 when password is missing", async () => {
      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "kietpham" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Password is required",
            path: "password",
          }),
        ])
      )
      expect(User.findOne).not.toHaveBeenCalled()
    })

    it("returns 400 when username is whitespace only", async () => {
      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "   ", password: "secret123" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Username is required",
            path: "username",
          }),
        ])
      )
      expect(User.findOne).not.toHaveBeenCalled()
    })
  })

  describe("unauthorized — 401", () => {
    // FR: BR-02 — user not found
    it("returns 401 when username does not exist", async () => {
      User.findOne.mockResolvedValue(null)

      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "unknown", password: "secret123" })

      expect(res.status).toBe(401)
      expect(res.body.message).toBe("Invalid username or password")
      expect(User.findOne).toHaveBeenCalled()
    })

    // FR: AC2 / BR-02 — wrong password
    it("returns 401 when password is incorrect", async () => {
      const user = activeUserFixture({
        comparePassword: jest.fn().mockResolvedValue(false),
      })
      User.findOne.mockResolvedValue(user)

      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "kietpham", password: "wrong-password" })

      expect(res.status).toBe(401)
      expect(res.body.message).toBe("Invalid username or password")
      expect(user.comparePassword).toHaveBeenCalledWith("wrong-password")
      expect(user.update).not.toHaveBeenCalled()
    })

    // FR: edge case — OAuth user without password (comparePassword fails)
    it("returns 401 when comparePassword fails (e.g. OAuth-only user)", async () => {
      const user = activeUserFixture({
        comparePassword: jest.fn().mockResolvedValue(false),
      })
      User.findOne.mockResolvedValue(user)

      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "oauthuser", password: "any" })

      expect(res.status).toBe(401)
      expect(res.body.message).toBe("Invalid username or password")
    })
  })

  describe("forbidden — 403", () => {
    // FR: AC3 / BR-03 — inactive account
    it("returns 403 when user is inactive", async () => {
      const user = activeUserFixture({ is_active: false })
      User.findOne.mockResolvedValue(user)

      const res = await request(app)
        .post(LOGIN_URL)
        .send({ username: "kietpham", password: "secret123" })

      expect(res.status).toBe(403)
      expect(res.body.message).toBe("Account is inactive")
      expect(user.comparePassword).toHaveBeenCalled()
      expect(user.update).not.toHaveBeenCalled()
    })
  })
})
