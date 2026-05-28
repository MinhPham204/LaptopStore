const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findByPk: jest.fn() },
  Answer: { destroy: jest.fn() },
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

const { Question, Answer } = require("../../models")
const { updateQuestion, deleteQuestion } = require("../../controllers/productController")
const productRoutes = require("../../routes/productRoutes")

const QUESTION_ID = 5
const OWNER_USER_ID = 2
const OTHER_CUSTOMER_ID = 10
const STAFF_USER_ID = 11
const ADMIN_USER_ID = 1
const MANAGER_USER_ID = 3

const QUESTIONS_URL = `/api/products/questions/${QUESTION_ID}`

const mockReqUser = (userId, roleNames) => ({
  user_id: userId,
  Roles: roleNames.map((role_name) => ({ role_name })),
})

const buildQuestion = (overrides = {}) => {
  const question = {
    question_id: QUESTION_ID,
    product_id: 10,
    user_id: OWNER_USER_ID,
    question_text: "Câu hỏi gốc",
    is_answered: true,
    parent_question_id: null,
    created_at: "2026-05-27T08:00:00.000Z",
    updated_at: "2026-05-27T08:00:00.000Z",
    ...overrides,
  }
  question.update = jest.fn().mockImplementation(async (data) => {
    Object.assign(question, data)
    return question
  })
  question.destroy = jest.fn().mockResolvedValue(undefined)
  return question
}

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const invokeUpdateQuestion = async ({ user, body = {}, params = {} } = {}) => {
  const req = {
    params: { question_id: String(QUESTION_ID), ...params },
    body: { question_text: "  Câu hỏi đã chỉnh sửa  ", ...body },
    user: user ?? mockReqUser(OWNER_USER_ID, ["customer"]),
  }
  const res = mockRes()
  const next = jest.fn()
  await updateQuestion(req, res, next)
  return { req, res, next }
}

const invokeDeleteQuestion = async ({ user, params = {} } = {}) => {
  const req = {
    params: { question_id: String(QUESTION_ID), ...params },
    user: user ?? mockReqUser(OWNER_USER_ID, ["customer"]),
  }
  const res = mockRes()
  const next = jest.fn()
  await deleteQuestion(req, res, next)
  return { req, res, next }
}

describe("productController.updateQuestion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Answer.destroy.mockResolvedValue(1)
  })

  // FR: §4 / AC — owner
  it("returns 200 for owner with trimmed question_text (§4, AC)", async () => {
    const question = buildQuestion()
    Question.findByPk.mockResolvedValue(question)

    const { res, next } = await invokeUpdateQuestion({
      user: mockReqUser(OWNER_USER_ID, ["customer"]),
    })

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ question })
    expect(question.update).toHaveBeenCalledWith({ question_text: "Câu hỏi đã chỉnh sửa" })
    expect(question.question_text).toBe("Câu hỏi đã chỉnh sửa")
    expect(next).not.toHaveBeenCalled()
  })

  // FR: BR-01 / §5 — staff edits another user's question
  it("returns 200 when staff updates another user's question (BR-01, §5)", async () => {
    const question = buildQuestion({ user_id: OTHER_CUSTOMER_ID })
    Question.findByPk.mockResolvedValue(question)

    const { res, next } = await invokeUpdateQuestion({
      user: mockReqUser(STAFF_USER_ID, ["staff"]),
      body: { question_text: "Staff chỉnh sửa." },
    })

    expect(res.json).toHaveBeenCalledWith({ question })
    expect(question.update).toHaveBeenCalledWith({ question_text: "Staff chỉnh sửa." })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — validation
  it("returns 400 when question_text is missing (§4)", async () => {
    const { res, next } = await invokeUpdateQuestion({ body: { question_text: "   " } })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: "question_text is required" })
    expect(Question.findByPk).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — not found
  it("returns 404 when question is not found (§4)", async () => {
    Question.findByPk.mockResolvedValue(null)

    const { res, next } = await invokeUpdateQuestion()

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Question not found" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — other customer
  it("returns 403 when customer is not owner and not staff (§4)", async () => {
    Question.findByPk.mockResolvedValue(buildQuestion({ user_id: OWNER_USER_ID }))

    const { res, next } = await invokeUpdateQuestion({
      user: mockReqUser(OTHER_CUSTOMER_ID, ["customer"]),
    })

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: "Insufficient permissions" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: BR-03 — manager not staff
  it("returns 403 when manager updates another user's question (BR-03)", async () => {
    Question.findByPk.mockResolvedValue(buildQuestion({ user_id: OTHER_CUSTOMER_ID }))

    const { res, next } = await invokeUpdateQuestion({
      user: mockReqUser(MANAGER_USER_ID, ["manager"]),
    })

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: "Insufficient permissions" })
    expect(next).not.toHaveBeenCalled()
  })
})

describe("productController.deleteQuestion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Answer.destroy.mockResolvedValue(2)
  })

  // FR: §4 — owner delete
  it("returns 200 for owner and destroys answers then question (§4)", async () => {
    const question = buildQuestion()
    Question.findByPk.mockResolvedValue(question)

    const { res, next } = await invokeDeleteQuestion({
      user: mockReqUser(OWNER_USER_ID, ["customer"]),
    })

    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(Answer.destroy).toHaveBeenCalledWith({ where: { question_id: QUESTION_ID } })
    expect(question.destroy).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §5 — staff delete
  it("returns 200 for staff deleting another user's question (§5)", async () => {
    const question = buildQuestion({ user_id: OTHER_CUSTOMER_ID })
    Question.findByPk.mockResolvedValue(question)

    const { res, next } = await invokeDeleteQuestion({
      user: mockReqUser(STAFF_USER_ID, ["staff"]),
    })

    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(Answer.destroy).toHaveBeenCalledWith({ where: { question_id: QUESTION_ID } })
    expect(question.destroy).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — not found
  it("returns 404 when question is not found on delete (§4)", async () => {
    Question.findByPk.mockResolvedValue(null)

    const { res, next } = await invokeDeleteQuestion()

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Question not found" })
    expect(Answer.destroy).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — other customer
  it("returns 403 when customer deletes another user's question (§4)", async () => {
    Question.findByPk.mockResolvedValue(buildQuestion({ user_id: OWNER_USER_ID }))

    const { res, next } = await invokeDeleteQuestion({
      user: mockReqUser(OTHER_CUSTOMER_ID, ["customer"]),
    })

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: "Insufficient permissions" })
    expect(Answer.destroy).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})

describe("GAP-01: PUT/DELETE /api/products/questions/:question_id not mounted", () => {
  const app = express()
  app.use(express.json())
  app.use("/api/products", productRoutes)

  const signSessionToken = (userId = OWNER_USER_ID) =>
    jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
      expiresIn: "7d",
    })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
  })

  it("returns 404 for PUT because update route is not registered (GAP-01)", async () => {
    const res = await request(app)
      .put(QUESTIONS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)
      .send({ question_text: "Sửa câu hỏi." })

    expect(res.status).toBe(404)
    expect(Question.findByPk).not.toHaveBeenCalled()
  })

  it("returns 404 for DELETE because delete route is not registered (GAP-01)", async () => {
    const res = await request(app)
      .delete(QUESTIONS_URL)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(404)
    expect(Question.findByPk).not.toHaveBeenCalled()
  })
})
