const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { create: jest.fn(), findByPk: jest.fn() },
  Product: {},
  Answer: {},
}))

const { User, Question } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const GLOBAL_QUESTIONS_URL = "/api/products/questions"

const CUSTOMER_USER_ID = 5
const STAFF_USER_ID = 11
const ADMIN_USER_ID = 1
const QUESTION_ID = 99

const signSessionToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const userRecord = (overrides = {}) => ({
  user_id: CUSTOMER_USER_ID,
  username: "khach1",
  full_name: "Trần B",
  email: "khach@example.com",
  is_active: true,
  Roles: [{ role_name: "customer" }],
  ...overrides,
})

const createdQuestionRow = () => ({
  question_id: QUESTION_ID,
  product_id: null,
  question_text: "Cửa hàng có hỗ trợ trả góp không?",
  is_answered: false,
  parent_question_id: null,
})

const questionWithUser = () => ({
  ...createdQuestionRow(),
  created_at: "2026-05-27T10:00:00.000Z",
  user: {
    user_id: CUSTOMER_USER_ID,
    username: "khach1",
    full_name: "Trần B",
  },
})

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === STAFF_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: STAFF_USER_ID,
          username: "staff1",
          Roles: [{ role_name: "staff" }],
        })
      )
    }
    if (id === ADMIN_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: ADMIN_USER_ID,
          username: "admin",
          Roles: [{ role_name: "admin" }],
        })
      )
    }
    return Promise.resolve(userRecord({ user_id: id }))
  })
}

const setupHappyPathMocks = (userId = CUSTOMER_USER_ID) => {
  Question.create.mockResolvedValue({ ...createdQuestionRow(), user_id: userId })
  Question.findByPk.mockResolvedValue({
    ...questionWithUser(),
    user: {
      user_id: userId,
      username: userId === ADMIN_USER_ID ? "admin" : userId === STAFF_USER_ID ? "staff1" : "khach1",
      full_name:
        userId === ADMIN_USER_ID ? "Admin" : userId === STAFF_USER_ID ? "Staff User" : "Trần B",
    },
  })
}

const postGlobalQuestion = (body, token = signSessionToken(CUSTOMER_USER_ID)) =>
  request(app)
    .post(GLOBAL_QUESTIONS_URL)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/products/questions (productController.createGlobalQuestion)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    setupHappyPathMocks()
  })

  // FR: §4 / AC — customer happy path
  it("returns 201 with question for authenticated customer (§4, AC)", async () => {
    const res = await postGlobalQuestion({
      question_text: "  Cửa hàng có hỗ trợ trả góp không?  ",
    })

    expect(res.status).toBe(201)
    expect(res.body.question).toEqual(questionWithUser())
  })

  // FR: §5 — Question.create payload
  it("calls Question.create with global question fields and trimmed text (§5)", async () => {
    await postGlobalQuestion({ question_text: "  Câu hỏi có trim.  " })

    expect(Question.create).toHaveBeenCalledWith({
      product_id: null,
      user_id: CUSTOMER_USER_ID,
      question_text: "Câu hỏi có trim.",
      is_answered: false,
      parent_question_id: null,
    })
  })

  // FR: BR-02 — ignore body linkage fields
  it("ignores product_id and parent_question_id from request body (BR-02)", async () => {
    await postGlobalQuestion({
      question_text: "Câu hỏi global.",
      product_id: 5,
      parent_question_id: 10,
    })

    expect(Question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: null,
        parent_question_id: null,
      })
    )
  })

  // FR: BR-03 — any authenticated role
  it.each([
    ["staff", STAFF_USER_ID],
    ["admin", ADMIN_USER_ID],
  ])("returns 201 for %s role (BR-03)", async (_role, userId) => {
    setupHappyPathMocks(userId)

    const res = await postGlobalQuestion(
      { question_text: "Câu hỏi từ staff/admin." },
      signSessionToken(userId)
    )

    expect(res.status).toBe(201)
    expect(Question.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId })
    )
  })

  // FR: §4 — validation
  it.each([
    ["missing question_text", {}],
    ["empty string", { question_text: "" }],
    ["whitespace only", { question_text: "   \t\n  " }],
  ])("returns 400 when question_text is %s (§4)", async (_label, body) => {
    const res = await postGlobalQuestion(body)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("question_text is required")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: BR-01 / §4 — auth
  it("returns 401 without bearer token (BR-01, §4)", async () => {
    const res = await request(app)
      .post(GLOBAL_QUESTIONS_URL)
      .send({ question_text: "Câu hỏi." })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Question.create).not.toHaveBeenCalled()
  })

  it("returns 403 when user is inactive (§4)", async () => {
    User.findByPk.mockResolvedValue(userRecord({ is_active: false }))

    const res = await postGlobalQuestion({ question_text: "Câu hỏi." })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Question.create).not.toHaveBeenCalled()
  })

  it("returns 500 when Question.create throws", async () => {
    Question.create.mockRejectedValue(new Error("DB connection failed"))

    const res = await postGlobalQuestion({ question_text: "Câu hỏi." })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
