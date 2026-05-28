const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findByPk: jest.fn() },
  Answer: { create: jest.fn(), findByPk: jest.fn(), findOne: jest.fn() },
  Product: {},
}))

const { User, Question, Answer } = require("../../models")
const adminRoutes = require("../../routes/adminRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/admin", adminRoutes)
app.use(errorHandler)

const ADMIN_USER_ID = 1
const MANAGER_USER_ID = 2
const CUSTOMER_USER_ID = 10
const STAFF_USER_ID = 11
const QUESTION_ID = 42
const ANSWER_ID = 10

const BASE_URL = `/api/admin/questions/${QUESTION_ID}/answers`

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

const buildQuestion = (overrides = {}) => {
  const question = {
    question_id: QUESTION_ID,
    is_answered: false,
    ...overrides,
  }
  question.update = jest.fn().mockResolvedValue(question)
  return question
}

const answerWithUserPayload = (overrides = {}) => ({
  answer_id: ANSWER_ID,
  question_id: QUESTION_ID,
  user_id: ADMIN_USER_ID,
  answer_text: "Sản phẩm hỗ trợ RAM tối đa 32GB.",
  created_at: "2026-05-27T10:00:00.000Z",
  updated_at: "2026-05-27T10:00:00.000Z",
  user: {
    user_id: ADMIN_USER_ID,
    username: "admin",
    full_name: "Quản trị viên",
  },
  ...overrides,
})

const postCreateAnswer = (body, token = signSessionToken(ADMIN_USER_ID)) =>
  request(app).post(BASE_URL).set("Authorization", `Bearer ${token}`).send(body)

const setupHappyPathMocks = ({ userId = ADMIN_USER_ID, questionOverrides = {} } = {}) => {
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

  const question = buildQuestion(questionOverrides)
  Question.findByPk.mockResolvedValue(question)

  Answer.create.mockResolvedValue({
    answer_id: ANSWER_ID,
    question_id: String(QUESTION_ID),
    user_id: userId,
    answer_text: "Sản phẩm hỗ trợ RAM tối đa 32GB.",
  })

  Answer.findByPk.mockResolvedValue(
    answerWithUserPayload({
      user_id: userId,
      user:
        userId === MANAGER_USER_ID
          ? { user_id: MANAGER_USER_ID, username: "manager1", full_name: "Manager User" }
          : { user_id: ADMIN_USER_ID, username: "admin", full_name: "Quản trị viên" },
    })
  )

  return { question }
}

describe("POST /api/admin/questions/:question_id/answers (questionsController.createAnswer)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    Answer.findOne.mockReset()
  })

  // FR: §4 / AC — admin role
  it("returns 201 for admin with message and answer including user (§4, AC)", async () => {
    setupHappyPathMocks()
    const body = { answer_text: "  Sản phẩm hỗ trợ RAM tối đa 32GB.  " }

    const res = await postCreateAnswer(body)

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Answer created successfully")
    expect(res.body.answer).toMatchObject({
      answer_id: ANSWER_ID,
      question_id: QUESTION_ID,
      user_id: ADMIN_USER_ID,
      answer_text: "Sản phẩm hỗ trợ RAM tối đa 32GB.",
      user: {
        user_id: ADMIN_USER_ID,
        username: "admin",
        full_name: "Quản trị viên",
      },
    })
  })

  // FR: BR-05 — manager allowed on admin route
  it("returns 201 for manager with message and answer including user (BR-05)", async () => {
    setupHappyPathMocks({ userId: MANAGER_USER_ID })
    const token = signSessionToken(MANAGER_USER_ID)

    const res = await postCreateAnswer(
      { answer_text: "Sản phẩm hỗ trợ RAM tối đa 32GB." },
      token
    )

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Answer created successfully")
    expect(res.body.answer.user).toEqual({
      user_id: MANAGER_USER_ID,
      username: "manager1",
      full_name: "Manager User",
    })
  })

  // FR: §5 — Answer.create payload
  it("calls Answer.create with question_id, user_id, and trimmed answer_text (§5)", async () => {
    setupHappyPathMocks()
    const rawText = "  Câu trả lời có khoảng trắng.  "

    await postCreateAnswer({ answer_text: rawText })

    expect(Answer.create).toHaveBeenCalledWith({
      question_id: String(QUESTION_ID),
      user_id: ADMIN_USER_ID,
      answer_text: "Câu trả lời có khoảng trắng.",
    })
  })

  // FR: BR-02 — always set is_answered true
  it("calls question.update({ is_answered: true }) even when question is already answered (BR-02)", async () => {
    const { question } = setupHappyPathMocks({
      questionOverrides: { is_answered: true },
    })

    const res = await postCreateAnswer({ answer_text: "Thêm câu trả lời thứ hai." })

    expect(res.status).toBe(201)
    expect(question.update).toHaveBeenCalledWith({ is_answered: true })
  })

  // FR: BR-01 — no duplicate check unlike PDP
  it("does not call Answer.findOne before Answer.create (BR-01)", async () => {
    setupHappyPathMocks()

    await postCreateAnswer({ answer_text: "Câu trả lời mới." })

    expect(Answer.findOne).not.toHaveBeenCalled()
  })

  // FR: §4 — validation
  it.each([
    ["missing answer_text", {}],
    ["empty string", { answer_text: "" }],
    ["whitespace only", { answer_text: "   \t\n  " }],
  ])("returns 400 when answer_text is %s (§4)", async (_label, body) => {
    setupHappyPathMocks()

    const res = await postCreateAnswer(body)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Answer text is required")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 — question missing
  it("returns 404 when question is not found (§4)", async () => {
    setupHappyPathMocks()
    Question.findByPk.mockResolvedValue(null)

    const res = await postCreateAnswer({ answer_text: "Nội dung trả lời." })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Question not found")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 — auth
  it("returns 401 without bearer token (§4)", async () => {
    const res = await request(app)
      .post(BASE_URL)
      .send({ answer_text: "Nội dung trả lời." })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
  })

  // FR: §4 / BR-05 — customer cannot use admin route
  it("returns 403 for customer role (§4, BR-05)", async () => {
    setupHappyPathMocks()
    const token = signSessionToken(CUSTOMER_USER_ID)

    const res = await postCreateAnswer({ answer_text: "Nội dung trả lời." }, token)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 / BR-05 — staff must use PDP route
  it("returns 403 for staff role (§4, BR-05)", async () => {
    setupHappyPathMocks()
    const token = signSessionToken(STAFF_USER_ID)

    const res = await postCreateAnswer({ answer_text: "Nội dung trả lời." }, token)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Insufficient permissions")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 — inactive user
  it("returns 403 when user is inactive (§4)", async () => {
    User.findByPk.mockResolvedValue(
      userRecord({ is_active: false, Roles: [{ role_name: "admin" }] })
    )

    const res = await postCreateAnswer({ answer_text: "Nội dung trả lời." })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("User not found or inactive")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: error path
  it("returns 500 when Answer.create throws", async () => {
    setupHappyPathMocks()
    Answer.create.mockRejectedValue(new Error("DB connection failed"))

    const res = await postCreateAnswer({ answer_text: "Nội dung trả lời." })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
