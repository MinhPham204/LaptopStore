const request = require("supertest")
const express = require("express")
const jwt = require("jsonwebtoken")

jest.mock("../../services/notificationService", () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../models", () => ({
  User: { findByPk: jest.fn(), findAll: jest.fn() },
  Role: {},
  Product: { findOne: jest.fn() },
  Question: { create: jest.fn(), findByPk: jest.fn() },
  Answer: { findOne: jest.fn() },
  sequelize: {},
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
}))

const { User, Product, Question, Answer } = require("../../models")
const notificationService = require("../../services/notificationService")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const PRODUCT_ID = 10
const PRODUCT_SLUG = "acer-swift-3"
const PARENT_QUESTION_ID = 42
const NEW_QUESTION_ID = 43
const CUSTOMER_USER_ID = 5
const STAFF_NOTIFY_USER_ID = 1

const signSessionToken = (userId = CUSTOMER_USER_ID) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests", {
    expiresIn: "7d",
  })

const userRecord = () => ({
  user_id: CUSTOMER_USER_ID,
  username: "khach1",
  full_name: "Trần B",
  email: "khach@example.com",
  is_active: true,
  Roles: [{ role_name: "customer" }],
})

const mockProduct = () => ({
  product_id: PRODUCT_ID,
  product_name: "Acer Swift 3",
})

const rootParent = () => ({
  question_id: PARENT_QUESTION_ID,
  product_id: PRODUCT_ID,
  parent_question_id: null,
})

const questionWithUser = (overrides = {}) => ({
  question_id: NEW_QUESTION_ID,
  question_text: "Máy có bàn phím tiếng Việt không?",
  is_answered: false,
  created_at: "2026-05-27T10:00:00.000Z",
  parent_question_id: null,
  user: {
    user_id: CUSTOMER_USER_ID,
    username: "khach1",
    full_name: "Trần B",
  },
  ...overrides,
})

const setupAuthAndNotifyMocks = () => {
  User.findByPk.mockResolvedValue(userRecord())
  User.findAll.mockResolvedValue([{ user_id: STAFF_NOTIFY_USER_ID }])
}

const setupRootHappyPath = () => {
  Product.findOne.mockResolvedValue(mockProduct())
  Question.create.mockResolvedValue({
    question_id: NEW_QUESTION_ID,
    product_id: PRODUCT_ID,
    parent_question_id: null,
  })
  Question.findByPk.mockResolvedValue(questionWithUser())
}

const postProductQuestion = (productKey, body, token = signSessionToken()) =>
  request(app)
    .post(`/api/products/${productKey}/questions`)
    .set("Authorization", `Bearer ${token}`)
    .send(body)

describe("POST /api/products/:id/questions (productController.createQuestion)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "test-jwt-secret-for-unit-tests"
    setupAuthAndNotifyMocks()
    setupRootHappyPath()
    Answer.findOne.mockResolvedValue({ answer_id: 1 })
  })

  // FR: §4 / AC — numeric product id
  it("returns 201 for root question with numeric product id (§4, AC)", async () => {
    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "  Máy có bàn phím tiếng Việt không?  ",
    })

    expect(res.status).toBe(201)
    expect(res.body.question).toEqual(questionWithUser())
    expect(Product.findOne).toHaveBeenCalledWith({
      where: { product_id: String(PRODUCT_ID) },
      attributes: ["product_id", "product_name"],
    })
    expect(Question.create).toHaveBeenCalledWith({
      product_id: PRODUCT_ID,
      user_id: CUSTOMER_USER_ID,
      question_text: "Máy có bàn phím tiếng Việt không?",
      is_answered: false,
      parent_question_id: null,
    })
    expect(User.findAll).toHaveBeenCalled()
    expect(notificationService.createNotification).toHaveBeenCalled()
  })

  // FR: §5 — resolve by slug
  it("returns 201 for root question with product slug (§5)", async () => {
    const res = await postProductQuestion(PRODUCT_SLUG, {
      question_text: "Có sẵn hàng không?",
    })

    expect(res.status).toBe(201)
    expect(Product.findOne).toHaveBeenCalledWith({
      where: { slug: PRODUCT_SLUG },
      attributes: ["product_id", "product_name"],
    })
  })

  // FR: §4.2 / BR-01, BR-02 — valid follow-up
  it("returns 201 for valid follow-up when parent is root, same product, and has answer (§4.2)", async () => {
    Question.findByPk.mockImplementation((id) => {
      if (id === PARENT_QUESTION_ID) {
        return Promise.resolve(rootParent())
      }
      return Promise.resolve(
        questionWithUser({
          question_text: "Cảm ơn, vậy bảo hành bao lâu?",
          parent_question_id: PARENT_QUESTION_ID,
        })
      )
    })
    Question.create.mockResolvedValue({
      question_id: NEW_QUESTION_ID,
      parent_question_id: PARENT_QUESTION_ID,
    })

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "  Cảm ơn, vậy bảo hành bao lâu?  ",
      parent_question_id: PARENT_QUESTION_ID,
    })

    expect(res.status).toBe(201)
    expect(Answer.findOne).toHaveBeenCalledWith({
      where: { question_id: PARENT_QUESTION_ID },
    })
    expect(Question.create).toHaveBeenCalledWith({
      product_id: PRODUCT_ID,
      user_id: CUSTOMER_USER_ID,
      question_text: "Cảm ơn, vậy bảo hành bao lâu?",
      is_answered: false,
      parent_question_id: PARENT_QUESTION_ID,
    })
  })

  // FR: §4 — validation
  it.each([
    ["missing question_text", {}],
    ["empty string", { question_text: "" }],
    ["whitespace only", { question_text: "   \t\n  " }],
  ])("returns 400 when question_text is %s (§4)", async (_label, body) => {
    const res = await postProductQuestion(PRODUCT_ID, body)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("question_text is required")
    expect(Product.findOne).not.toHaveBeenCalled()
  })

  // FR: §4 — product missing
  it("returns 404 when product is not found (§4)", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await postProductQuestion(PRODUCT_ID, { question_text: "Câu hỏi." })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: §4 — parent missing
  it("returns 404 when parent question is not found (§4)", async () => {
    Question.findByPk.mockResolvedValue(null)

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "Follow-up.",
      parent_question_id: PARENT_QUESTION_ID,
    })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Parent question not found")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: BR-01 — one follow-up level
  it("returns 400 when parent is already a follow-up (BR-01)", async () => {
    Question.findByPk.mockResolvedValue({
      question_id: 50,
      product_id: PRODUCT_ID,
      parent_question_id: PARENT_QUESTION_ID,
    })

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "Follow-up thứ hai.",
      parent_question_id: 50,
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Only one follow-up level is allowed")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: §4 — parent wrong product
  it("returns 400 when parent question does not belong to this product (§4)", async () => {
    Question.findByPk.mockResolvedValue({
      question_id: PARENT_QUESTION_ID,
      product_id: 99,
      parent_question_id: null,
    })

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "Follow-up.",
      parent_question_id: PARENT_QUESTION_ID,
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Parent question does not belong to this product")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: BR-02 — parent must have answer
  it("returns 400 when parent has no answer yet (BR-02)", async () => {
    Question.findByPk.mockResolvedValue(rootParent())
    Answer.findOne.mockResolvedValue(null)

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "Follow-up sớm.",
      parent_question_id: PARENT_QUESTION_ID,
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Parent must be answered before follow-up")
    expect(Question.create).not.toHaveBeenCalled()
  })

  // FR: BR-05 — unique constraint
  it("returns 409 when Question.create raises SequelizeUniqueConstraintError (BR-05)", async () => {
    Question.findByPk.mockResolvedValue(rootParent())
    Answer.findOne.mockResolvedValue({ answer_id: 1 })
    const uniqueErr = new Error("duplicate")
    uniqueErr.name = "SequelizeUniqueConstraintError"
    Question.create.mockRejectedValue(uniqueErr)

    const res = await postProductQuestion(PRODUCT_ID, {
      question_text: "Follow-up trùng.",
      parent_question_id: PARENT_QUESTION_ID,
    })

    expect(res.status).toBe(409)
    expect(res.body.message).toBe("This question already has a follow-up")
  })

  // FR: BR-01 / §4 — auth
  it("returns 401 without bearer token (BR-01, §4)", async () => {
    const res = await request(app)
      .post(`/api/products/${PRODUCT_ID}/questions`)
      .send({ question_text: "Câu hỏi." })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Access token required")
    expect(Product.findOne).not.toHaveBeenCalled()
  })
})
