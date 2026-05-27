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

const REGISTER_URL = "/api/auth/register"

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

const customerRoleFixture = () => ({
  role_id: 1,
  role_name: "customer",
})

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    User.findOne.mockResolvedValue(null)
    Role.findOne.mockResolvedValue(customerRoleFixture())
    Cart.create.mockResolvedValue({ cart_id: 1, user_id: 42 })
  })

  // FR: AC1 — payload hợp lệ → 201, token + user.user_id
  it("returns 201 with token and user when registration succeeds", async () => {
    const user = createdUserFixture()
    User.create.mockResolvedValue(user)

    const res = await request(app).post(REGISTER_URL).send(validPayload())

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("User registered successfully")
    expect(res.body.token).toBeDefined()

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(payload.userId).toBe(42)

    expect(res.body.user).toEqual({
      user_id: 42,
      username: "kietpham",
      email: "kiet@example.com",
      full_name: "Kiệt Phạm",
      phone_number: "0901234567",
      roles: ["customer"],
    })

    // FR: BR-03 — duplicate check before insert
    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["username", "email", "phone_number"],
      })
    )

    // FR: BR-02 — plaintext passed; model hook hashes on real DB
    expect(User.create).toHaveBeenCalledWith({
      username: "kietpham",
      email: "kiet@example.com",
      password_hash: "secret123",
      full_name: "Kiệt Phạm",
      phone_number: "0901234567",
    })

    // FR: BR-01 — active by default (no is_active: false)
    expect(User.create.mock.calls[0][0]).not.toHaveProperty("is_active", false)

    // FR: BR-04
    expect(Role.findOne).toHaveBeenCalledWith({ where: { role_name: "customer" } })
    expect(user.addRole).toHaveBeenCalledWith(customerRoleFixture())

    // FR: BR-05 / AC5
    expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })
  })

  // FR: BR-06 — session JWT without purpose claim
  it("issues a session JWT without purpose claim", async () => {
    User.create.mockResolvedValue(createdUserFixture())

    const res = await request(app).post(REGISTER_URL).send(validPayload())

    expect(res.status).toBe(201)
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(payload.userId).toBe(42)
    expect(payload.purpose).toBeUndefined()
  })

  describe("validation — 400", () => {
    // FR: AC4
    it("returns 400 when username is too short", async () => {
      const res = await request(app)
        .post(REGISTER_URL)
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
      expect(User.findOne).not.toHaveBeenCalled()
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
      const res = await request(app)
        .post(REGISTER_URL)
        .send({ ...validPayload(), email: "not-an-email" })

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Invalid email",
            path: "email",
          }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when password is too short", async () => {
      const res = await request(app)
        .post(REGISTER_URL)
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

    it("returns 400 when phone_number is missing", async () => {
      const { phone_number, ...body } = validPayload()
      const res = await request(app).post(REGISTER_URL).send(body)

      expect(res.status).toBe(400)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: "Phone number is required",
            path: "phone_number",
          }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 400 when phone_number format is invalid", async () => {
      const res = await request(app)
        .post(REGISTER_URL)
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
    // FR: AC3 / BR-03 — duplicate username
    it("returns 409 when username is already taken", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "other@example.com",
        phone_number: "0999999999",
      })

      const res = await request(app).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.message).toBe("Duplicate entry")
      expect(res.body.errors).toEqual([
        {
          field: "username",
          code: "DUPLICATE_USERNAME",
          message: "Username already taken",
        },
      ])
      expect(User.create).not.toHaveBeenCalled()
      expect(Cart.create).not.toHaveBeenCalled()
    })

    it("returns 409 when email is already registered", async () => {
      User.findOne.mockResolvedValue({
        username: "otheruser",
        email: "kiet@example.com",
        phone_number: "0999999999",
      })

      const res = await request(app).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.errors).toEqual([
        {
          field: "email",
          code: "DUPLICATE_EMAIL",
          message: "Email already registered",
        },
      ])
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 409 when phone_number is already registered", async () => {
      User.findOne.mockResolvedValue({
        username: "otheruser",
        email: "other@example.com",
        phone_number: "0901234567",
      })

      const res = await request(app).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.errors).toEqual([
        {
          field: "phone_number",
          code: "DUPLICATE_PHONE",
          message: "Phone number already registered",
        },
      ])
      expect(User.create).not.toHaveBeenCalled()
    })

    it("returns 409 with multiple errors when several fields collide", async () => {
      User.findOne.mockResolvedValue({
        username: "kietpham",
        email: "kiet@example.com",
        phone_number: "0901234567",
      })

      const res = await request(app).post(REGISTER_URL).send(validPayload())

      expect(res.status).toBe(409)
      expect(res.body.errors).toHaveLength(3)
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "DUPLICATE_USERNAME" }),
          expect.objectContaining({ code: "DUPLICATE_EMAIL" }),
          expect.objectContaining({ code: "DUPLICATE_PHONE" }),
        ])
      )
      expect(User.create).not.toHaveBeenCalled()
    })
  })

  // FR: edge case — customer role not seeded; still 201 with hardcoded roles
  it("returns 201 without calling addRole when customer role is missing", async () => {
    const user = createdUserFixture()
    User.create.mockResolvedValue(user)
    Role.findOne.mockResolvedValue(null)

    const res = await request(app).post(REGISTER_URL).send(validPayload())

    expect(res.status).toBe(201)
    expect(res.body.user.roles).toEqual(["customer"])
    expect(user.addRole).not.toHaveBeenCalled()
    expect(Cart.create).toHaveBeenCalledWith({ user_id: 42 })
  })
})
