const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")
const { Op } = require("sequelize")

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
  Category: { findByPk: jest.fn(), findOne: jest.fn() },
}))

const { User, Category } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const CATEGORY_ID = 5
const updateUrl = (id = CATEGORY_ID) => `/api/admin/categories/${id}`

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

const buildCategory = (overrides = {}) => {
  const category = {
    category_id: CATEGORY_ID,
    category_name: "Laptop Gaming",
    slug: "laptop-gaming",
    description: "Old description",
    display_order: 1,
    icon_url: "https://cdn.example/old-icon.png",
    update: jest.fn(async function updateCategory(data) {
      Object.assign(this, data)
      return this
    }),
    ...overrides,
  }
  return category
}

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

const putCategory = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).put(updateUrl()).set("Authorization", `Bearer ${token}`).send({})

describe("PUT /api/admin/categories/:category_id (updateCategory[1])", () => {
  let category

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    uploadState.body = {}
    uploadState.files = null
    setupUserMocks()
    category = buildCategory()
    Category.findByPk.mockResolvedValue(category)
    Category.findOne.mockResolvedValue(null)
  })

  it("returns 200 Category updated successfully for admin", async () => {
    uploadState.body = {
      category_name: "Laptop Gaming",
      description: "Updated description",
      display_order: 2,
    }

    const res = await putCategory()

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Category updated successfully")
    expect(res.body.category).toBeDefined()
    expect(category.update).toHaveBeenCalled()
  })

  it("returns 200 for manager role", async () => {
    uploadState.body = { category_name: "Laptop Gaming", description: "x", display_order: 1 }

    const res = await putCategory(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Category updated successfully")
  })

  // FR: BR-01 — only description/display_order, name unchanged
  it("keeps slug and category_name unchanged when only description and display_order change (BR-01)", async () => {
    uploadState.body = {
      category_name: "Laptop Gaming",
      description: "New description only",
      display_order: 3,
    }

    await putCategory()

    expect(Category.findOne).not.toHaveBeenCalled()
    expect(category.update).toHaveBeenCalledWith({
      description: "New description only",
      display_order: 3,
    })
    const updateArg = category.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty("slug")
    expect(updateArg).not.toHaveProperty("category_name")
  })

  // FR: §5 — category_name change regenerates slug, excludes self
  it("updates slug and checks findOne excluding current category_id when name changes", async () => {
    uploadState.body = {
      category_name: "Gaming Pro",
      description: "Desc",
      display_order: 1,
    }

    await putCategory()

    expect(Category.findOne).toHaveBeenCalledWith({
      where: { slug: "gaming-pro", category_id: { [Op.ne]: String(CATEGORY_ID) } },
    })
    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        category_name: "Gaming Pro",
        slug: "gaming-pro",
        description: "Desc",
        display_order: 1,
      })
    )
  })

  it("sets icon_url when req.files.thumbnail is present", async () => {
    uploadState.body = { category_name: "Laptop Gaming", description: "", display_order: 1 }
    uploadState.files = {
      thumbnail: [{ path: "https://res.cloudinary.com/demo/new-icon.png" }],
    }

    await putCategory()

    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        icon_url: "https://res.cloudinary.com/demo/new-icon.png",
      })
    )
  })

  // FR: BR-03 — no thumbnail → icon_url not in update payload
  it("does not include icon_url in update when thumbnail is not uploaded (BR-03)", async () => {
    uploadState.body = { category_name: "Laptop Gaming", description: "x", display_order: 1 }

    await putCategory()

    const updateArg = category.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty("icon_url")
  })

  it("returns 404 when category is not found", async () => {
    Category.findByPk.mockResolvedValue(null)

    const res = await putCategory()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Category not found")
    expect(category.update).not.toHaveBeenCalled()
  })

  it("returns 400 when slug conflicts with another category", async () => {
    uploadState.body = { category_name: "Gaming Pro", description: "", display_order: 0 }
    Category.findOne.mockResolvedValue({ category_id: 99, slug: "gaming-pro" })

    const res = await putCategory()

    expect(res.status).toBe(400)
    expect(res.body.message).toBe(
      "Slug already exists. Please choose a different category name."
    )
    expect(category.update).not.toHaveBeenCalled()
  })

  it("returns 401 without bearer token", async () => {
    const res = await request(app).put(updateUrl()).send({})

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role", async () => {
    const res = await putCategory(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role", async () => {
    const res = await putCategory(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Category.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when category.update throws", async () => {
    uploadState.body = { category_name: "Laptop Gaming", description: "x", display_order: 1 }
    category.update.mockRejectedValue(new Error("DB update failed"))

    const res = await putCategory()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB update failed")
  })
})
