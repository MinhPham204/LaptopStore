const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn() },
  Role: {},
  Question: { findByPk: jest.fn(), update: jest.fn() },
  Answer: { findOne: jest.fn() },
  Product: {},
}))

const { User, Question, Answer } = require("../../models")
const { updateAnswer } = require("../../controllers/questionsController")
const adminRoutes = require("../../routes/adminRoutes")

const QUESTION_ID = 42
const ANSWER_ID = 10
const OTHER_QUESTION_ID = 99
const ADMIN_USER_ID = 1

const buildAnswer = (overrides = {}) => {
  const answer = {
    answer_id: ANSWER_ID,
    question_id: QUESTION_ID,
    user_id: 1,
    answer_text: "Câu trả lời cũ",
    created_at: "2026-05-27T09:00:00.000Z",
    updated_at: "2026-05-27T09:00:00.000Z",
    ...overrides,
  }
  answer.update = jest.fn().mockImplementation(async (data) => {
    Object.assign(answer, data)
    answer.updated_at = "2026-05-27T11:00:00.000Z"
    return answer
  })
  return answer
}

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const invokeUpdateAnswer = async ({ params = {}, body = {} } = {}) => {
  const req = {
    params: {
      question_id: String(QUESTION_ID),
      answer_id: String(ANSWER_ID),
      ...params,
    },
    body: {
      answer_text: "  Nội dung đã chỉnh sửa.  ",
      ...body,
    },
  }
  const res = mockRes()
  const next = jest.fn()
  await updateAnswer(req, res, next)
  return { req, res, next }
}

describe("questionsController.updateAnswer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: §4 / AC — happy path
  it("returns 200 with Answer updated successfully and trimmed answer in response (§4, AC)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)

    const { res, next } = await invokeUpdateAnswer()

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      message: "Answer updated successfully",
      answer: expect.objectContaining({
        answer_id: ANSWER_ID,
        answer_text: "Nội dung đã chỉnh sửa.",
      }),
    })
    expect(answer.update).toHaveBeenCalledWith({ answer_text: "Nội dung đã chỉnh sửa." })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: BR-03 — composite lookup
  it("looks up answer by composite answer_id and question_id (BR-03)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)

    await invokeUpdateAnswer()

    expect(Answer.findOne).toHaveBeenCalledWith({
      where: { answer_id: String(ANSWER_ID), question_id: String(QUESTION_ID) },
    })
  })

  // FR: BR-02 — no question flag changes
  it("does not call Question.findByPk or Question.update (BR-02)", async () => {
    const answer = buildAnswer()
    Answer.findOne.mockResolvedValue(answer)

    await invokeUpdateAnswer()

    expect(Question.findByPk).not.toHaveBeenCalled()
    expect(Question.update).not.toHaveBeenCalled()
  })

  // FR: §4 — validation
  it.each([
    ["missing answer_text", { answer_text: undefined }],
    ["empty string", { answer_text: "" }],
    ["whitespace only", { answer_text: "   \t\n  " }],
  ])("returns 400 when answer_text is %s (§4)", async (_label, body) => {
    const { res, next } = await invokeUpdateAnswer({ body })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: "Answer text is required" })
    expect(Answer.findOne).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — not found
  it("returns 404 when answer is not found (§4)", async () => {
    Answer.findOne.mockResolvedValue(null)

    const { res, next } = await invokeUpdateAnswer()

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Answer not found" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: BR-03 — wrong question in path
  it("returns 404 when answer_id does not belong to question_id in path (BR-03)", async () => {
    Answer.findOne.mockResolvedValue(null)

    const { res, next } = await invokeUpdateAnswer({
      params: {
        question_id: String(OTHER_QUESTION_ID),
        answer_id: String(ANSWER_ID),
      },
    })

    expect(Answer.findOne).toHaveBeenCalledWith({
      where: { answer_id: String(ANSWER_ID), question_id: String(OTHER_QUESTION_ID) },
    })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Answer not found" })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: error path
  it("calls next when answer.update throws", async () => {
    const answer = buildAnswer()
    const dbError = new Error("update failed")
    answer.update.mockRejectedValue(dbError)
    Answer.findOne.mockResolvedValue(answer)

    const { res, next } = await invokeUpdateAnswer()

    expect(res.json).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(dbError)
  })
})

describe("GAP-01: PUT /api/admin/questions/:question_id/answers/:answer_id not mounted", () => {
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

  it("returns 404 for PUT with admin JWT because route is not registered (GAP-01)", async () => {
    const res = await request(app)
      .put(`/api/admin/questions/${QUESTION_ID}/answers/${ANSWER_ID}`)
      .set("Authorization", `Bearer ${signSessionToken()}`)
      .send({ answer_text: "Nội dung mới." })

    expect(res.status).toBe(404)
    expect(Answer.findOne).not.toHaveBeenCalled()
  })
})
