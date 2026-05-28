const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

const uploadState = { body: {}, files: null }

jest.mock("../../middleware/upload", () => ({
  uploadProductFiles: (req, res, next) => {
    req.body = { ...(uploadState.body || {}) }
    req.files = uploadState.files || {}
    next()
  },
}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Category: { findOne: jest.fn(), create: jest.fn() },
}))

const { User, Category } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const CREATE_URL = "/api/admin/categories"

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

const createdCategory = (overrides = {}) => ({
  category_id: 10,
  category_name: "Office Laptops",
  slug: "office-laptops",
  description: "For work",
  display_order: 0,
  icon_url: null,
  parent_id: null,
  ...overrides,
})

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === MANAGER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: MANAGER_USER_ID,
          username: "manager1",
          Roles: [{ role_name: "manager" }],
        })
      )
    }
    if (id === CUSTOMER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: CUSTOMER_USER_ID,
          username: "buyer",
          Roles: [{ role_name: "customer" }],
        })
      )
    }
    if (id === STAFF_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: STAFF_USER_ID,
          username: "staff1",
          Roles: [{ role_name: "staff" }],
        })
      )
    }
    return Promise.resolve(userRecord({ user_id: id }))
  })
}

const postCategory = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).post(CREATE_URL).set("Authorization", `Bearer ${token}`).send({})

describe("POST /api/admin/categories (createCategory[1])", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    uploadState.body = {}
    uploadState.files = null
    setupUserMocks()
    Category.findOne.mockResolvedValue(null)
    Category.create.mockResolvedValue(createdCategory())
  })

  // FR: AC §10 — 201 success
  it("returns 201 Category created successfully for admin (§10)", async () => {
    uploadState.body = {
      category_name: "Office Laptops",
      description: "For work",
      display_order: 2,
    }
    uploadState.files = {
      thumbnail: [{ path: "https://res.cloudinary.com/demo/icon.png" }],
    }
    Category.create.mockResolvedValue(
      createdCategory({
        display_order: 2,
        icon_url: "https://res.cloudinary.com/demo/icon.png",
      })
    )

    const res = await postCategory()

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Category created successfully")
    expect(res.body.category).toMatchObject({
      category_name: "Office Laptops",
      slug: "office-laptops",
    })
  })

  it("returns 201 for manager role", async () => {
    uploadState.body = {
      category_name: "Gaming Laptops",
      description: "",
    }

    const res = await postCategory(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Category created successfully")
  })

  // FR: BR-01 — slug check before create
  it("checks slug uniqueness with Category.findOne before create (BR-01)", async () => {
    uploadState.body = { category_name: "Office Laptops", description: "Desc" }

    await postCategory()

    expect(Category.findOne).toHaveBeenCalledWith({
      where: { slug: "office-laptops" },
    })
    expect(Category.create).toHaveBeenCalled()
  })

  // FR: §5 — create payload with generated slug and display_order default
  it("creates category with slug, description, display_order default 0 and icon_url null when no file", async () => {
    uploadState.body = {
      category_name: "Office Laptops",
      description: "For work",
    }

    await postCategory()

    expect(Category.create).toHaveBeenCalledWith({
      category_name: "Office Laptops",
      slug: "office-laptops",
      description: "For work",
      display_order: 0,
      icon_url: null,
    })
  })

  // FR: §5 — thumbnail → icon_url
  it("sets icon_url from req.files.thumbnail when file is uploaded", async () => {
    uploadState.body = { category_name: "Office Laptops", description: "" }
    uploadState.files = {
      thumbnail: [{ path: "https://res.cloudinary.com/demo/new-icon.png" }],
    }

    await postCategory()

    expect(Category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        icon_url: "https://res.cloudinary.com/demo/new-icon.png",
      })
    )
  })

  // FR: §4 — slug conflict
  it("returns 400 when slug already exists (Category.findOne returns existing)", async () => {
    uploadState.body = { category_name: "Office Laptops", description: "" }
    Category.findOne.mockResolvedValue({ category_id: 99, slug: "office-laptops" })

    const res = await postCategory()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(
      "Slug already exists. Please choose a different category name."
    )
    expect(Category.create).not.toHaveBeenCalled()
  })

  // FR: §4 — unique constraint on create
  it("returns 409 when Category.create throws SequelizeUniqueConstraintError", async () => {
    uploadState.body = { category_name: "Office Laptops", description: "" }
    const uniqueErr = new Error("unique violation")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    uniqueErr.errors = [{ path: "category_name", message: "must be unique" }]
    Category.create.mockRejectedValue(uniqueErr)

    const res = await postCategory()

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("Duplicate entry")
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).post(CREATE_URL).send({})

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Category.findOne).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await postCategory(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findOne).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await postCategory(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findOne).not.toHaveBeenCalled()
  })

  it("returns 500 when Category.create throws", async () => {
    uploadState.body = { category_name: "Office Laptops", description: "" }
    Category.create.mockRejectedValue(new Error("DB insert failed"))

    const res = await postCategory()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB insert failed")
  })
})
