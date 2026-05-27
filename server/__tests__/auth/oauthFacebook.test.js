const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

global.__mockFacebookOAuth = { verify: null, options: null }

jest.mock("passport-google-oauth20", () => ({
  Strategy: class MockGoogleStrategy {
    constructor() {
      this.name = "google"
    }
  },
}))

jest.mock("passport-facebook", () => ({
  Strategy: class MockFacebookStrategy {
    constructor(options, verify) {
      this.name = "facebook"
      global.__mockFacebookOAuth.verify = verify
      global.__mockFacebookOAuth.options = options
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

const facebookProfile = (overrides = {}) => ({
  id: "fb-user-456",
  displayName: "Facebook User",
  emails: [{ value: "fbuser@example.com" }],
  photos: [{ value: "https://graph.facebook.com/avatar.png" }],
  ...overrides,
})

const runFacebookVerify = (profile) =>
  new Promise((resolve, reject) => {
    const verify = global.__mockFacebookOAuth.verify
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

describe("Facebook OAuth — strategy verify (findOrCreateOAuthUser)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    Role.findOne.mockResolvedValue({ role_id: 1, role_name: "customer" })
    Cart.create.mockResolvedValue({ cart_id: 1, user_id: 99 })
  })

  // FR: AC3 — user Facebook mới → create + cart + last_login
  it("creates user and cart for new Facebook account", async () => {
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    const created = {
      user_id: 99,
      username: "fbuser_abc12",
      email: "fbuser@example.com",
      update: jest.fn().mockResolvedValue(undefined),
      addRole: jest.fn().mockResolvedValue(undefined),
    }
    User.create.mockResolvedValue(created)

    const result = await runFacebookVerify(facebookProfile())

    expect(User.findOne).toHaveBeenNthCalledWith(1, {
      where: { oauth_provider: "facebook", oauth_id: "fb-user-456" },
    })
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fbuser@example.com",
        full_name: "Facebook User",
        oauth_provider: "facebook",
        oauth_id: "fb-user-456",
        avatar_url: "https://graph.facebook.com/avatar.png",
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
      oauth_provider: "facebook",
      oauth_id: "fb-user-456",
    })
    User.findOne.mockResolvedValueOnce(existing)

    const result = await runFacebookVerify(facebookProfile())

    expect(User.findOne).toHaveBeenCalledTimes(1)
    expect(User.create).not.toHaveBeenCalled()
    expect(Cart.create).not.toHaveBeenCalled()
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login: expect.any(Date) })
    )
    expect(result.user).toBe(existing)
  })

  // FR: AC5 — email trùng → gắn oauth fields, không User.create
  it("links Facebook oauth to existing user with matching email", async () => {
    const existing = existingUserFixture()
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)

    await runFacebookVerify(facebookProfile())

    expect(existing.update).toHaveBeenCalledWith({
      oauth_provider: "facebook",
      oauth_id: "fb-user-456",
      avatar_url: "https://graph.facebook.com/avatar.png",
    })
    expect(User.create).not.toHaveBeenCalled()
    expect(Cart.create).not.toHaveBeenCalled()
  })

  // FR: AC6 — profile không có email → chỉ lookup oauth, User.create email null
  it("attempts create without email when Facebook profile has no emails", async () => {
    User.findOne.mockResolvedValueOnce(null)
    const created = {
      user_id: 88,
      update: jest.fn().mockResolvedValue(undefined),
      addRole: jest.fn().mockResolvedValue(undefined),
    }
    User.create.mockResolvedValue(created)

    await runFacebookVerify(
      facebookProfile({ emails: undefined, displayName: "FB No Email" })
    )

    expect(User.findOne).toHaveBeenCalledTimes(1)
    expect(User.findOne).toHaveBeenCalledWith({
      where: { oauth_provider: "facebook", oauth_id: "fb-user-456" },
    })
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        oauth_provider: "facebook",
        oauth_id: "fb-user-456",
      })
    )
  })

  // FR: AC1 (config) — FacebookStrategy nhận env + profileFields
  it("registers FacebookStrategy with env callback URL and profileFields", () => {
    expect(global.__mockFacebookOAuth.options).toEqual(
      expect.objectContaining({
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ["id", "displayName", "emails", "photos"],
      })
    )
    expect(global.__mockFacebookOAuth.verify).toEqual(expect.any(Function))
  })
})

describe("Facebook OAuth — HTTP routes (authSocialRoutes)", () => {
  const FE_URL = "http://localhost:3000"
  let app
  const mockAuthenticateCalls = []

  beforeAll(() => {
    jest.resetModules()
    global.__oauthRouteMode = "initiate"
    global.__oauthRouteProvider = "facebook"

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
          if (strategy !== global.__oauthRouteProvider) {
            return next()
          }
          if (options?.failureRedirect) {
            if (global.__oauthRouteMode === "failure") {
              return res.redirect(options.failureRedirect)
            }
            req.user = { token: "fb-oauth-session-jwt", user: { user_id: 42 } }
            return next()
          }
          return res.redirect(302, "https://www.facebook.com/v18.0/dialog/oauth")
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
    global.__oauthRouteProvider = "facebook"
  })

  // FR: AC1 — GET /facebook với scope email
  it("redirects to Facebook authorize with email scope", async () => {
    const res = await request(app).get("/api/auth/facebook").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain("facebook.com")
    expect(mockAuthenticateCalls).toEqual(
      expect.arrayContaining([
        {
          strategy: "facebook",
          options: { scope: ["email"], session: false },
        },
      ])
    )
  })

  // FR: AC2 — callback thành công → redirect oauth/success?token=
  it("redirects to oauth success with JWT on successful Facebook callback", async () => {
    global.__oauthRouteMode = "success"

    const res = await request(app).get("/api/auth/facebook/callback").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      `${FE_URL}/oauth/success?token=${encodeURIComponent("fb-oauth-session-jwt")}`
    )
    expect(mockAuthenticateCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategy: "facebook",
          options: expect.objectContaining({
            failureRedirect: `${FE_URL}/login?oauth=facebook_failed`,
            session: false,
          }),
        }),
      ])
    )
  })

  // FR: failure UX — redirect facebook_failed
  it("redirects to login with facebook_failed on OAuth failure", async () => {
    global.__oauthRouteMode = "failure"

    const res = await request(app).get("/api/auth/facebook/callback").redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${FE_URL}/login?oauth=facebook_failed`)
  })
})
