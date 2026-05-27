const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

global.__mockGoogleOAuth = { verify: null, options: null }

jest.mock("passport-google-oauth20", () => ({
  Strategy: class MockGoogleStrategy {
    constructor(options, verify) {
      this.name = "google"
      global.__mockGoogleOAuth.verify = verify
      global.__mockGoogleOAuth.options = options
    }
  },
}))

jest.mock("passport-facebook", () => ({
  Strategy: class MockFacebookStrategy {
    constructor() {
      this.name = "facebook"
    }
  },
}))

jest.mock("../../models", () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  Role: { findOne: jest.fn() },
  Cart: { create: jest.fn() },
}))

const { User, Role, Cart } = require("../../models")

require("../../config/passport")

const googleProfile = (overrides = {}) => ({
  id: "google-sub-123",
  displayName: "Google User",
  emails: [{ value: "googleuser@gmail.com" }],
  photos: [{ value: "https://lh3.googleusercontent.com/avatar.png" }],
  ...overrides,
})

const runGoogleVerify = (profile) =>
  new Promise((resolve, reject) => {
    const verify = global.__mockGoogleOAuth.verify
    verify("access-token", "refresh-token", profile, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })

const existingUserFixture = (overrides = {}) => ({
  user_id: 42,
  email: "existing@example.com",
  avatar_url: null,
  update: jest.fn().mockResolvedValue(undefined),
  addRole: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe("Google OAuth — strategy verify (findOrCreateOAuthUser)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    Role.findOne.mockResolvedValue({ role_id: 1, role_name: "customer" })
    Cart.create.mockResolvedValue({ cart_id: 1, user_id: 99 })
  })

  // FR: AC3 — user Google mới → create + cart + last_login
  it("creates user and cart for new Google account", async () => {
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    const created = {
      user_id: 99,
      username: "googleuser_abc12",
      email: "googleuser@gmail.com",
      update: jest.fn().mockResolvedValue(undefined),
      addRole: jest.fn().mockResolvedValue(undefined),
    }
    User.create.mockResolvedValue(created)

    const result = await runGoogleVerify(googleProfile())

    expect(User.findOne).toHaveBeenNthCalledWith(1, {
      where: { oauth_provider: "google", oauth_id: "google-sub-123" },
    })
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "googleuser@gmail.com",
        full_name: "Google User",
        oauth_provider: "google",
        oauth_id: "google-sub-123",
        avatar_url: "https://lh3.googleusercontent.com/avatar.png",
      })
    )
    expect(created.addRole).toHaveBeenCalled()
    expect(Cart.create).toHaveBeenCalledWith({ user_id: 99 })
    expect(created.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login: expect.any(Date) })
    )
    expect(result.token).toBeDefined()
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET)
    expect(decoded.userId).toBe(99)
    expect(result.user).toBe(created)
  })

  // FR: AC4 — trùng oauth_provider + oauth_id → không tạo user/cart mới
  it("reuses existing user when oauth_provider and oauth_id match", async () => {
    const existing = existingUserFixture({
      oauth_provider: "google",
      oauth_id: "google-sub-123",
    })
    User.findOne.mockResolvedValueOnce(existing)

    const result = await runGoogleVerify(googleProfile())

    expect(User.findOne).toHaveBeenCalledTimes(1)
    expect(User.create).not.toHaveBeenCalled()
    expect(Cart.create).not.toHaveBeenCalled()
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login: expect.any(Date) })
    )
    expect(result.user).toBe(existing)
  })

  // FR: AC5 — email trùng → gắn oauth fields, không User.create
  it("links Google oauth to existing user with matching email", async () => {
    const existing = existingUserFixture()
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)

    await runGoogleVerify(googleProfile())

    expect(existing.update).toHaveBeenCalledWith({
      oauth_provider: "google",
      oauth_id: "google-sub-123",
      avatar_url: "https://lh3.googleusercontent.com/avatar.png",
    })
    expect(User.create).not.toHaveBeenCalled()
    expect(Cart.create).not.toHaveBeenCalled()
  })

  // FR: AC1 (config) — GoogleStrategy nhận env OAuth
  it("registers GoogleStrategy with env callback URL", () => {
    expect(global.__mockGoogleOAuth.options).toEqual(
      expect.objectContaining({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      })
    )
    expect(global.__mockGoogleOAuth.verify).toEqual(expect.any(Function))
  })
})

describe("Google OAuth — HTTP routes (authSocialRoutes)", () => {
  const FE_URL = "http://localhost:3000"
  let app
  const mockAuthenticateCalls = []

  beforeAll(() => {
    jest.resetModules()
    global.__oauthRouteMode = "initiate"

    jest.doMock("passport-google-oauth20", () => ({
      Strategy: class MockGoogleStrategy {
        constructor() {
          this.name = "google"
        }
      },
    }))
    jest.doMock("passport-facebook", () => ({
      Strategy: class MockFacebookStrategy {
        constructor() {
          this.name = "facebook"
        }
      },
    }))
    jest.doMock("../../models", () => ({
      User: { findOne: jest.fn() },
      Role: { findOne: jest.fn() },
      Cart: { create: jest.fn() },
    }))
    jest.doMock("../../config/passport", () => ({
      authenticate: (strategy, options) => {
        mockAuthenticateCalls.push({ strategy, options })
        return (req, res, next) => {
          if (options?.failureRedirect) {
            if (global.__oauthRouteMode === "failure") {
              return res.redirect(options.failureRedirect)
            }
            req.user = { token: "oauth-session-jwt", user: { user_id: 42 } }
            return next()
          }
          return res.redirect(302, "https://accounts.google.com/o/oauth2/v2/auth")
        }
      },
      use: jest.fn(),
      initialize: jest.fn(() => (_req, _res, next) => next()),
    }))

    process.env.FE_APP_URL = FE_URL
    const authSocialRoutes = require("../../routes/authSocialRoutes")
    app = express()
    app.use("/api/auth", authSocialRoutes)
  })

  beforeEach(() => {
    global.__oauthRouteMode = "initiate"
  })

  // FR: AC1 — GET /google redirect với scope profile+email
  it("redirects to Google authorize with profile and email scope", async () => {
    const res = await request(app).get("/api/auth/google").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain("accounts.google.com")
    expect(mockAuthenticateCalls).toEqual(
      expect.arrayContaining([
        {
          strategy: "google",
          options: { scope: ["profile", "email"], session: false },
        },
      ])
    )
  })

  // FR: AC2 — callback thành công → redirect oauth/success?token=
  it("redirects to oauth success with JWT on successful callback", async () => {
    global.__oauthRouteMode = "success"

    const res = await request(app).get("/api/auth/google/callback").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      `${FE_URL}/oauth/success?token=${encodeURIComponent("oauth-session-jwt")}`
    )
    expect(mockAuthenticateCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategy: "google",
          options: expect.objectContaining({
            failureRedirect: `${FE_URL}/login?oauth=google_failed`,
            session: false,
          }),
        }),
      ])
    )
  })

  // FR: AC6 — failure → /login?oauth=google_failed
  it("redirects to login with google_failed on OAuth failure", async () => {
    global.__oauthRouteMode = "failure"

    const res = await request(app).get("/api/auth/google/callback").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_URL}/login?oauth=google_failed`)
  })
})
