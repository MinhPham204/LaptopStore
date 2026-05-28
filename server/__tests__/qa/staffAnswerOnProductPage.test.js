const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../services/notificationService", () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findByPk: jest.fn() },
  Answer: { create: jest.fn(), findByPk: jest.fn(), findOne: jest.fn() },
  Product: {},
  sequelize: {},
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
}))

const { User, Question, Answer } = require("../../models")
const notificationService = require("../../services/notificationService")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const QUESTION_ID = 42
const ANSWER_ID = 20
const ADMIN_USER_ID = 1
const STAFF_USER_ID = 11
const MANAGER_USER_ID = 2
const CUSTOMER_USER_ID = 10
const QUESTION_OWNER_ID = 5

const ANSWERS_URL = `/api/products/questions/${QUESTION_ID}/answers`

const signSessionToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const userRecord = (overrides = {}) => ({
  user_id: STAFF_USER_ID,
  username: "staff1",
  full_name: "Nhân viên A",
  email: "staff@example.com",
  is_active: true,
  Roles: [{ role_name: "staff" }],
  ...overrides,
})

const buildQuestion = (overrides = {}) => {
  const question = {
    question_id: QUESTION_ID,
    user_id: QUESTION_OWNER_ID,
    product_id: 10,
    is_answered: false,
    ...overrides,
  }
  question.update = jest.fn().mockResolvedValue(question)
  return question
}

const answerWithUser = (overrides = {}) => ({
  answer_id: ANSWER_ID,
  answer_text: "Sản phẩm bảo hành 12 tháng chính hãng.",
  created_at: "2026-05-27T11:00:00.000Z",
  user: {
    user_id: STAFF_USER_ID,
    username: "staff1",
    full_name: "Nhân viên A",
  },
  ...overrides,
})

const setupUserMocks = () => {
  User.findByPk.mockImplementation((id) => {
    if (id === ADMIN_USER_ID) {
      return Promise.resolve(
        userRecord({
          user_id: ADMIN_USER_ID,
          username: "admin",
          full_name: "Quản trị viên",
          Roles: [{ role_name: "admin" }],
        })
      )
    }
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
    return Promise.resolve(userRecord({ user_id: id }))
  })
}

const setupHappyPathMocks = ({ questionOverrides = {}, answerUserId = STAFF_USER_ID } = {}) => {
  const question = buildQuestion(questionOverrides)
  Question.findByPk.mockResolvedValue(question)
  Answer.findOne.mockResolvedValue(null)
  Answer.create.mockResolvedValue({
    answer_id: ANSWER_ID,
    question_id: QUESTION_ID,
    user_id: answerUserId,
  })
  Answer.findByPk.mockResolvedValue(
    answerWithUser({
      user:
        answerUserId === ADMIN_USER_ID
          ? { user_id: ADMIN_USER_ID, username: "admin", full_name: "Quản trị viên" }
          : { user_id: STAFF_USER_ID, username: "staff1", full_name: "Nhân viên A" },
    })
  )
  return { question }
}

const postAnswer = (body, token = signSessionToken(STAFF_USER_ID)) =>
  request(app).post(ANSWERS_URL).set("Authorization", `Bearer ${token}`).send(body)

describe("POST /api/products/questions/:question_id/answers (productController.createAnswer)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupUserMocks()
    setupHappyPathMocks()
  })

  // FR: §4 / AC — staff
  it("returns 201 for staff with answer in body and trimmed Answer.create (§4, AC)", async () => {
    const { question } = setupHappyPathMocks()

    const res = await postAnswer({
      answer_text: "  Sản phẩm bảo hành 12 tháng chính hãng.  ",
    })

    expect(res.status).toBe(201)
    expect(res.body.answer).toEqual(
      answerWithUser({
        answer_text: "Sản phẩm bảo hành 12 tháng chính hãng.",
      })
    )
    expect(Answer.create).toHaveBeenCalledWith({
      question_id: QUESTION_ID,
      user_id: STAFF_USER_ID,
      answer_text: "Sản phẩm bảo hành 12 tháng chính hãng.",
    })
    expect(question.update).toHaveBeenCalledWith({ is_answered: true })
  })

  // FR: §4 — admin also staff on PDP
  it("returns 201 for admin role (§4)", async () => {
    setupHappyPathMocks({ answerUserId: ADMIN_USER_ID })

    const res = await postAnswer(
      { answer_text: "Trả lời từ admin." },
      signSessionToken(ADMIN_USER_ID)
    )

    expect(res.status).toBe(201)
    expect(Answer.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ADMIN_USER_ID })
    )
  })

  // FR: §5 — notification to question owner
  it("calls createNotification when question has user_id (§5)", async () => {
    setupHappyPathMocks({ questionOverrides: { user_id: QUESTION_OWNER_ID, product_id: 10 } })

    await postAnswer({ answer_text: "Câu trả lời có thông báo." })

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: QUESTION_OWNER_ID,
      title: "Phản hồi mới",
      message: "Admin đã trả lời câu hỏi của bạn.",
      type: "new_answer",
      relatedType: "product",
      relatedId: 10,
    })
  })

  // FR: §5 — skip update when already answered
  it("does not call question.update when is_answered is already true (§5)", async () => {
    const { question } = setupHappyPathMocks({
      questionOverrides: { is_answered: true },
    })

    const res = await postAnswer({ answer_text: "Câu trả lời." })

    expect(res.status).toBe(201)
    expect(question.update).not.toHaveBeenCalled()
  })

  // FR: §4 — validation
  it("returns 400 when answer_text is missing (§4)", async () => {
    const res = await postAnswer({})

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("answer_text is required")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 / BR-01 — manager not staff on PDP
  it("returns 403 for manager role with Only staff can answer (BR-01, §4)", async () => {
    const res = await postAnswer(
      { answer_text: "Manager trả lời." },
      signSessionToken(MANAGER_USER_ID)
    )

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Only staff can answer")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  // FR: §4 — customer
  it("returns 403 for customer role (§4)", async () => {
    const res = await postAnswer(
      { answer_text: "Customer trả lời." },
      signSessionToken(CUSTOMER_USER_ID)
    )

    expect(res.status).toBe(403)
    expect(res.body.message).toBe("Only staff can answer")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  // FR: §4 — question missing
  it("returns 404 when question is not found (§4)", async () => {
    Question.findByPk.mockResolvedValue(null)

    const res = await postAnswer({ answer_text: "Câu trả lời." })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Question not found")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: §4 — duplicate answer
  it("returns 409 when answer already exists for question (§4)", async () => {
    Answer.findOne.mockResolvedValue({ answer_id: 99, question_id: QUESTION_ID })

    const res = await postAnswer({ answer_text: "Câu trả lời thứ hai." })

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("This question already has an answer")
    expect(Answer.create).not.toHaveBeenCalled()
  })

  // FR: BR-04 — unique constraint on create
  it("returns 409 when Answer.create raises SequelizeUniqueConstraintError (BR-04)", async () => {
    const uniqueErr = new Error("duplicate")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    Answer.create.mockRejectedValue(uniqueErr)

    const res = await postAnswer({ answer_text: "Câu trả lời." })

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("This question already has an answer")
  })

  // FR: §4 — auth
  it("returns 401 without bearer token (§4)", async () => {
    const res = await request(app)
      .post(ANSWERS_URL)
      .send({ answer_text: "Câu trả lời." })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Question.findByPk).not.toHaveBeenCalled()
  })
})
