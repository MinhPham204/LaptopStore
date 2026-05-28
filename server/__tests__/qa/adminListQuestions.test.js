const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")
const { Op } = require("sequelize")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findAndCountAll: jest.fn() },
  Answer: { name: "Answer" },
  Product: { name: "Product" },
}))

const { User, Question, Answer, Product } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const LIST_URL = "/api/admin/questions"

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

const sampleQuestions = [
  {
    question_id: 1,
    question_text: "RAM tối đa bao nhiêu?",
    is_answered: false,
    product_id: 5,
    parent_question_id: 99,
    user: { user_id: 2, username: "buyer", full_name: "Khách", email: "buyer@x.com" },
    product: { product_id: 5, product_name: "Laptop A" },
    answers: [
      {
        answer_id: 10,
        answer_text: "32GB",
        created_at: "2026-05-27T10:00:00.000Z",
        user: { user_id: 1, username: "admin", full_name: "Admin" },
      },
    ],
  },
]

const listResult = (overrides = {}) => ({
  count: 100,
  rows: sampleQuestions,
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

const getQuestions = (query = "", token = signSessionToken(ADMIN_USER_ID)) => {
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : ""
  return request(app).get(`${LIST_URL}${qs}`).set("Authorization", `Bearer ${token}`)
}

const lastFindAndCountAllCall = () => Question.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/admin/questions (questionsController.getAllQuestions)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Question.findAndCountAll.mockResolvedValue(listResult())
  })

  // FR: §4 / AC — admin
  it("returns 200 with questions and pagination for admin (§4, AC)", async () => {
    const res = await getQuestions()

    expect(res.status).toBe(200)
    expect(res.body.questions).toEqual(sampleQuestions)
    expect(res.body.pagination).toEqual({
      total: 100,
      page: 1,
      limit: 20,
      totalPages: 5,
    })
  })

  // FR: BR-02 — manager
  it("returns 200 with questions and pagination for manager (BR-02)", async () => {
    const res = await getQuestions("", signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.questions).toHaveLength(1)
    expect(res.body.pagination.total).toBe(100)
  })

  // FR: §4 — answered filter
  it("filters is_answered true when answered=true (§4)", async () => {
    await getQuestions("answered=true")

    expect(lastFindAndCountAllCall().where).toEqual({ is_answered: true })
  })

  it("filters is_answered false when answered=false (§4)", async () => {
    await getQuestions("answered=false")

    expect(lastFindAndCountAllCall().where).toEqual({ is_answered: false })
  })

  // FR: §4 — has_product filter
  it("filters product_id Op.ne null when has_product=true (§4)", async () => {
    await getQuestions("has_product=true")

    expect(lastFindAndCountAllCall().where).toEqual({
      product_id: { [Op.ne]: null },
    })
  })

  it("filters product_id null when has_product=false (§4)", async () => {
    await getQuestions("has_product=false")

    expect(lastFindAndCountAllCall().where).toEqual({ product_id: null })
  })

  // FR: §4 — pagination
  it("applies page, limit, offset and computes totalPages (§4)", async () => {
    Question.findAndCountAll.mockResolvedValue(listResult({ count: 47 }))

    const res = await getQuestions("page=2&limit=10")

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 10,
      })
    )
    expect(res.body.pagination).toEqual({
      total: 47,
      page: 2,
      limit: 10,
      totalPages: 5,
    })
  })

  // FR: BR-03 — sort whitelist
  it("uses whitelisted sort_by field in order (BR-03)", async () => {
    await getQuestions("sort_by=updated_at&sort_order=ASC")

    expect(lastFindAndCountAllCall().order).toEqual([
      ["updated_at", "ASC"],
      ["created_at", "DESC"],
    ])
  })

  it("falls back to created_at when sort_by is invalid (BR-03)", async () => {
    await getQuestions("sort_by=malicious;DROP&sort_order=DESC")

    expect(lastFindAndCountAllCall().order).toEqual([
      ["created_at", "DESC"],
      ["created_at", "DESC"],
    ])
  })

  it("accepts sort_order DESC (§4)", async () => {
    await getQuestions("sort_by=question_id&sort_order=desc")

    expect(lastFindAndCountAllCall().order[0]).toEqual(["question_id", "DESC"])
  })

  it("falls back to DESC when sort_order is invalid (BR-03)", async () => {
    await getQuestions("sort_by=created_at&sort_order=INVALID")

    expect(lastFindAndCountAllCall().order[0]).toEqual(["created_at", "DESC"])
  })

  // FR: §5 — includes
  it("includes user, optional product, answers with user (§5)", async () => {
    await getQuestions()

    expect(lastFindAndCountAllCall().include).toEqual([
      {
        model: User,
        as: "user",
        attributes: ["user_id", "username", "full_name", "email"],
      },
      {
        model: Product,
        as: "product",
        attributes: ["product_id", "product_name"],
        required: false,
      },
      {
        model: Answer,
        as: "answers",
        attributes: ["answer_id", "answer_text", "created_at"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_id", "username", "full_name"],
          },
        ],
        required: false,
      },
    ])
  })

  // FR: BR-01 — follow-ups not excluded
  it("does not filter parent_question_id in where clause (BR-01)", async () => {
    await getQuestions("answered=true&has_product=true")

    const { where } = lastFindAndCountAllCall()
    expect(where).not.toHaveProperty("parent_question_id")
    expect(where).toEqual({
      is_answered: true,
      product_id: { [Op.ne]: null },
    })
  })

  // FR: §4 — auth
  it("returns 401 without bearer token (§4)", async () => {
    const res = await request(app).get(LIST_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role (§4, BR-02)", async () => {
    const res = await getQuestions("", signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role (§4, BR-02)", async () => {
    const res = await getQuestions("", signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive (§4)", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getQuestions()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
  })

  it("returns 500 when Question.findAndCountAll throws", async () => {
    Question.findAndCountAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await getQuestions()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
