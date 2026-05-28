const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { update: jest.fn() },
  Answer: { findOne: jest.fn(), count: jest.fn() },
  Product: {},
}))

const { User, Question, Answer } = require("../../models")
const { deleteAnswer } = require("../../controllers/questionsController")
const adminRoutes = require("../../routes/adminRoutes")

const QUESTION_ID = 42
const ANSWER_ID = 10
const OTHER_QUESTION_ID = 99
const ADMIN_USER_ID = 1

const buildAnswer = (overrides = {}) => {
  const answer = {
    answer_id: ANSWER_ID,
    question_id: QUESTION_ID,
    answer_text: "Câu trả lời mẫu",
    ...overrides,
  }
  answer.destroy = jest.fn().mockResolvedValue(undefined)
  return answer
}

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const invokeDeleteAnswer = async (params = {}) => {
  const req = {
    params: {
      question_id: String(QUESTION_ID),
      answer_id: String(ANSWER_ID),
      ...params,
    },
  }
  const res = mockRes()
  const next = jest.fn()
  await deleteAnswer(req, res, next)
  return { req, res, next }
}

describe("questionsController.deleteAnswer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Question.update.mockResolvedValue([1])
  })

  // FR: §4 / AC — happy path
  it("returns 200 with Answer deleted successfully and calls answer.destroy (§4, AC)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)
    Answer.count.mockResolvedValue(1)

    const { res, next } = await invokeDeleteAnswer()

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ message: "Answer deleted successfully" })
    expect(answer.destroy).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §5 — composite lookup
  it("looks up answer by composite answer_id and question_id (§5)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)
    Answer.count.mockResolvedValue(0)

    await invokeDeleteAnswer({
      question_id: String(QUESTION_ID),
      answer_id: String(ANSWER_ID),
    })

    expect(Answer.findOne).toHaveBeenCalledWith({
      where: { answer_id: String(ANSWER_ID), question_id: String(QUESTION_ID) },
    })
  })

  // FR: BR-01 — still other answers
  it("does not call Question.update when remaining answer count is greater than 0 (BR-01)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)
    Answer.count.mockResolvedValue(2)

    const { res } = await invokeDeleteAnswer()

    expect(res.json).toHaveBeenCalledWith({ message: "Answer deleted successfully" })
    expect(Question.update).not.toHaveBeenCalled()
  })

  // FR: BR-02 — last answer removed
  it("calls Question.update with is_answered false when count is 0 (BR-02)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)
    Answer.count.mockResolvedValue(0)

    await invokeDeleteAnswer()

    expect(Question.update).toHaveBeenCalledWith(
      { is_answered: false },
      { where: { question_id: String(QUESTION_ID) } }
    )
  })

  // FR: §4 — not found
  it("returns 404 when answer is not found (§4)", async () => {
    Answer.findOne.mockResolvedValue(null)

    const { res, next } = await invokeDeleteAnswer()

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Answer not found" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: AC — wrong question_id in path
  it("returns 404 when answer_id does not belong to question_id in path (AC)", async () => {
    Answer.findOne.mockResolvedValue(null)

    const { res, next } = await invokeDeleteAnswer({
      question_id: String(OTHER_QUESTION_ID),
      answer_id: String(ANSWER_ID),
    })

    expect(Answer.findOne).toHaveBeenCalledWith({
      where: { answer_id: String(ANSWER_ID), question_id: String(OTHER_QUESTION_ID) },
    })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Answer not found" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: error path
  it("calls next when answer.destroy throws", async () => {
    const answer = buildAnswer()
    const dbError = new Error("destroy failed")
    answer.destroy.mockRejectedValue(dbError)
    Answer.findOne.mockResolvedValue(answer)

    const { res, next } = await invokeDeleteAnswer()

    expect(res.json).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(dbError)
  })
})

describe("GAP-01: DELETE /api/admin/questions/:question_id/answers/:answer_id not mounted", () => {
  const app = express()
  app.use(express.json())
  app.use("/api/admin", adminRoutes)

  const signSessionToken = (userId = ADMIN_USER_ID) =>
    jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
      expiresIn: "7d",
    })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    User.findByPk.mockResolvedValue({
      user_id: ADMIN_USER_ID,
      username: "admin",
      is_active: true,
      Roles: [{ role_name: "admin" }],
    })
  })

  it("returns 404 for DELETE with admin JWT because route is not registered (GAP-01)", async () => {
    const res = await request(app)
      .delete(`/api/admin/questions/${QUESTION_ID}/answers/${ANSWER_ID}`)
      .set("Authorization", `Bearer ${signSessionToken()}`)

    expect(res.status).toBe(404)
    expect(Answer.findOne).not.toHaveBeenCalled()
  })
})
