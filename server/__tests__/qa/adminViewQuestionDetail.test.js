const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findByPk: jest.fn() },
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

const QUESTION_ID = 42
const DETAIL_URL = `/api/admin/questions/${QUESTION_ID}`

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

const productQuestion = () => ({
  question_id: QUESTION_ID,
  question_text: "RAM tối đa bao nhiêu?",
  is_answered: true,
  product_id: 5,
  parent_question_id: null,
  created_at: "2026-05-27T08:00:00.000Z",
  updated_at: "2026-05-27T10:00:00.000Z",
  user: {
    user_id: 2,
    username: "buyer",
    full_name: "Nguyễn Văn A",
    email: "a@example.com",
  },
  product: { product_id: 5, product_name: "Laptop X" },
  answers: [
    {
      answer_id: 10,
      answer_text: "Tối đa 32GB.",
      created_at: "2026-05-27T09:00:00.000Z",
      updated_at: "2026-05-27T09:30:00.000Z",
      user: { user_id: 1, username: "admin", full_name: "Quản trị viên" },
    },
  ],
})

const globalQuestion = () => ({
  question_id: QUESTION_ID,
  question_text: "Chính sách bảo hành?",
  is_answered: false,
  product_id: null,
  parent_question_id: null,
  created_at: "2026-05-27T08:00:00.000Z",
  updated_at: "2026-05-27T08:00:00.000Z",
  user: {
    user_id: 3,
    username: "guest",
    full_name: "Khách global",
    email: "guest@example.com",
  },
  product: null,
  answers: [],
})

const expectedFindByPkInclude = () => [
  {
    model: User,
    as: "user",
    attributes: ["user_id", "username", "full_name", "email"],
  },
  {
    model: Product,
    as: "product",
    attributes: ["product_id", "product_name"],
  },
  {
    model: Answer,
    as: "answers",
    attributes: ["answer_id", "answer_text", "created_at", "updated_at"],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["user_id", "username", "full_name"],
      },
    ],
    order: [["created_at", "ASC"]],
  },
]

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === MANAGER_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: MANAGER_USER_ID,
          username: "manager1",
          full_name: "Manager User",
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

const getQuestionDetail = (token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).get(DETAIL_URL).set("Authorization", `Bearer ${token}`)

describe("GET /api/admin/questions/:question_id (questionsController.getQuestionDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    Question.findByPk.mockResolvedValue(productQuestion())
  })

  // FR: §4 / AC — admin
  it("returns 200 with question body for admin (§4, AC)", async () => {
    const res = await getQuestionDetail()

    expect(res.status).toBe(200)
    expect(res.body.question).toEqual(productQuestion())
    expect(Question.findByPk).toHaveBeenCalledWith(
      String(QUESTION_ID),
      expect.objectContaining({ include: expectedFindByPkInclude() })
    )
  })

  // FR: BR-02 on routes — manager allowed
  it("returns 200 with question body for manager (BR-02)", async () => {
    const res = await getQuestionDetail(signSessionToken(MANAGER_USER_ID))

    expect(res.status).toBe(200)
    expect(res.body.question).toEqual(productQuestion())
  })

  // FR: §5 / BR-02 / BR-03 — findByPk include shape
  it("loads question with user (email), product, answers+user ordered ASC and no children include (§5, BR-02, BR-03)", async () => {
    await getQuestionDetail()

    const [, options] = Question.findByPk.mock.calls[0]
    expect(options.include).toEqual(expectedFindByPkInclude())
    expect(options.include.some((inc) => inc.as === "children")).toBe(false)
    expect(options.include.some((inc) => inc.model === Question)).toBe(false)

    const userInclude = options.include.find((inc) => inc.as === "user")
    expect(userInclude.attributes).toContain("email")

    const answersInclude = options.include.find((inc) => inc.as === "answers")
    expect(answersInclude.order).toEqual([["created_at", "ASC"]])
    expect(answersInclude.include[0]).toEqual({
      model: User,
      as: "user",
      attributes: ["user_id", "username", "full_name"],
    })
  })

  // FR: BR-01 — global Q&A product null
  it("returns 200 for global question with product null (BR-01)", async () => {
    Question.findByPk.mockResolvedValue(globalQuestion())

    const res = await getQuestionDetail()

    expect(res.status).toBe(200)
    expect(res.body.question.product_id).toBeNull()
    expect(res.body.question.product).toBeNull()
  })

  // FR: §4 — not found
  it("returns 404 when question is not found (§4)", async () => {
    Question.findByPk.mockResolvedValue(null)

    const res = await getQuestionDetail()

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Question not found")
  })

  // FR: §4 — auth
  it("returns 401 without bearer token (§4)", async () => {
    const res = await request(app).get(DETAIL_URL)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for customer role (§4)", async () => {
    const res = await getQuestionDetail(signSessionToken(CUSTOMER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 for staff role (§4)", async () => {
    const res = await getQuestionDetail(signSessionToken(STAFF_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive (§4)", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await getQuestionDetail()

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  it("returns 500 when Question.findByPk throws", async () => {
    Question.findByPk.mockRejectedValue(new Error("DB connection failed"))

    const res = await getQuestionDetail()

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
