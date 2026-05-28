const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: {},
  Product: { findOne: jest.fn() },
  Question: { findAndCountAll: jest.fn() },
  User: { name: "User" },
  Answer: { name: "Answer" },
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
  Role: {},
}))

const { Product, Question, User, Answer } = require("../../models")
const { getProductQuestions } = require("../../controllers/productController")
const productRoutes = require("../../routes/productRoutes")

const PRODUCT_ID = 10
const PRODUCT_SLUG = "acer-swift-3"

const mockProduct = () => ({ product_id: PRODUCT_ID })

const flatQuestionRows = () => [
  {
    question_id: 10,
    question_text: "Có tặng chuột không?",
    is_answered: true,
    created_at: "2026-05-27T12:00:00.000Z",
    user: { user_id: 2, username: "buyer", full_name: "Khách A" },
    answers: [
      {
        answer_id: 7,
        answer_text: "Có tặng chuột không dây.",
        created_at: "2026-05-27T13:00:00.000Z",
        user: { user_id: 1, username: "staff1", full_name: "Staff" },
      },
    ],
  },
  {
    question_id: 11,
    question_text: "Bảo hành chuột bao lâu?",
    is_answered: false,
    created_at: "2026-05-27T11:00:00.000Z",
    user: { user_id: 2, username: "buyer", full_name: "Khách A" },
    answers: [],
  },
]

const listResult = (overrides = {}) => ({
  count: 15,
  rows: flatQuestionRows(),
  ...overrides,
})

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const invokeGetProductQuestions = async ({ id = PRODUCT_ID, query = {} } = {}) => {
  const req = {
    params: { id: String(id) },
    query,
  }
  const res = mockRes()
  const next = jest.fn()
  await getProductQuestions(req, res, next)
  return { req, res, next }
}

const expectedIncludes = () => [
  {
    model: User,
    as: "user",
    attributes: ["user_id", "username", "full_name"],
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
  },
]

describe("productController.getProductQuestions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Product.findOne.mockResolvedValue(mockProduct())
    Question.findAndCountAll.mockResolvedValue(listResult())
  })

  // FR: §4 / AC — numeric id
  it("resolves product by numeric id and returns 200 with questions and pagination (§4, AC)", async () => {
    const { res, next } = await invokeGetProductQuestions()

    expect(Product.findOne).toHaveBeenCalledWith({
      where: { product_id: String(PRODUCT_ID) },
      attributes: ["product_id"],
    })
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      questions: flatQuestionRows(),
      pagination: {
        total: 15,
        page: 1,
        limit: 10,
        totalPages: 2,
      },
    })
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — slug
  it("resolves product by slug (§4)", async () => {
    await invokeGetProductQuestions({ id: PRODUCT_SLUG })

    expect(Product.findOne).toHaveBeenCalledWith({
      where: { slug: PRODUCT_SLUG },
      attributes: ["product_id"],
    })
  })

  // FR: §5 — flat where (root + follow-up)
  it("queries questions by product_id only without filtering parent_question_id (§5)", async () => {
    await invokeGetProductQuestions()

    const call = Question.findAndCountAll.mock.calls[0][0]
    expect(call.where).toEqual({ product_id: PRODUCT_ID })
    expect(call.where).not.toHaveProperty("parent_question_id")
  })

  // FR: §5 — includes
  it("includes user and answers with answer user (§5)", async () => {
    await invokeGetProductQuestions()

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["question_id", "question_text", "is_answered", "created_at"],
        include: expectedIncludes(),
      })
    )
  })

  // FR: §5 — order
  it("orders questions DESC and answers ASC (§5)", async () => {
    await invokeGetProductQuestions()

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [
          ["created_at", "DESC"],
          [{ model: Answer, as: "answers" }, "created_at", "ASC"],
        ],
      })
    )
  })

  // FR: §4 — defaults
  it("uses default page=1 and limit=10 with correct offset and totalPages (§4)", async () => {
    await invokeGetProductQuestions()

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 0,
      })
    )
  })

  // FR: §4 — flat list in response
  it("returns flat list containing both root and follow-up rows (§4)", async () => {
    const { res } = await invokeGetProductQuestions()

    const questions = res.json.mock.calls[0][0].questions
    expect(questions).toHaveLength(2)
    expect(questions[0].question_id).toBe(10)
    expect(questions[1].question_id).toBe(11)
  })

  // FR: §4 — pagination query
  it("applies custom page and limit in pagination response (§4)", async () => {
    Question.findAndCountAll.mockResolvedValue(listResult({ count: 25 }))

    const { res } = await invokeGetProductQuestions({ query: { page: "2", limit: "5" } })

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        offset: 5,
      })
    )
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: {
          total: 25,
          page: 2,
          limit: 5,
          totalPages: 5,
        },
      })
    )
  })

  // FR: §4 — product missing
  it("returns 404 when product is not found (§4)", async () => {
    Product.findOne.mockResolvedValue(null)

    const { res, next } = await invokeGetProductQuestions()

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: "Product not found" })
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §4 — limit max 50
  it("caps limit at 50 when query limit exceeds max (§4)", async () => {
    await invokeGetProductQuestions({ query: { limit: "100" } })

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    )
  })

  // FR: §4 — limit min 1
  it("enforces minimum limit of 1 (§4)", async () => {
    await invokeGetProductQuestions({ query: { limit: "0" } })

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    )
  })

  // FR: §4 — page min 1
  it("enforces minimum page of 1 (§4)", async () => {
    await invokeGetProductQuestions({ query: { page: "0" } })

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
      })
    )
    const pagination = Question.findAndCountAll.mock.calls[0][0]
    expect(pagination.limit).toBe(10)
  })

  it("uses page 1 in pagination when page query is below minimum (§4)", async () => {
    const { res } = await invokeGetProductQuestions({ query: { page: "-2" } })

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ page: 1 }),
      })
    )
  })

  // FR: Error — DB failure
  it("calls next when Question.findAndCountAll throws", async () => {
    const dbError = new Error("DB connection failed")
    Question.findAndCountAll.mockRejectedValue(dbError)

    const { res, next } = await invokeGetProductQuestions()

    expect(res.json).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(dbError)
  })
})

describe("GAP-01: GET /api/products/:id/questions not mounted on productRoutes", () => {
  const app = express()
  app.use(express.json())
  app.use("/api/products", productRoutes)

  it("returns 404 for GET /api/products/42/questions because route is not registered (GAP-01)", async () => {
    const res = await request(app).get("/api/products/42/questions")

    expect(res.status).toBe(404)
    expect(Question.findAndCountAll).not.toHaveBeenCalled()
  })
})
