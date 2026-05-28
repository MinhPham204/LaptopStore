const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findOne: jest.fn() },
  ProductVariation: { name: "ProductVariation" },
  ProductImage: { name: "ProductImage" },
  Category: { name: "Category" },
  Brand: { name: "Brand" },
  Tag: { name: "Tag" },
  Question: { name: "Question" },
  Answer: { name: "Answer" },
  User: { name: "User" },
  Order: {},
  OrderItem: {},
  Role: {},
}))

const { Product, Question, Answer, User } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const userInclude = () => ({
  model: User,
  as: "user",
  attributes: ["user_id", "username", "full_name"],
})

const answerInclude = () => ({
  model: Answer,
  as: "answers",
  attributes: ["answer_id", "answer_text", "created_at"],
  include: [userInclude()],
})

const expectedQuestionsInclude = () => ({
  model: Question,
  as: "questions",
  attributes: [
    "question_id",
    "question_text",
    "is_answered",
    "created_at",
    "parent_question_id",
  ],
  where: { parent_question_id: null },
  required: false,
  include: [
    userInclude(),
    answerInclude(),
    {
      model: Question,
      as: "children",
      attributes: [
        "question_id",
        "question_text",
        "is_answered",
        "created_at",
        "parent_question_id",
      ],
      include: [userInclude(), answerInclude()],
    },
  ],
})

const expectedQuestionOrderClauses = () => [
  [{ model: Question, as: "questions" }, "created_at", "DESC"],
  [
    { model: Question, as: "questions" },
    { model: Answer, as: "answers" },
    "created_at",
    "ASC",
  ],
  [
    { model: Question, as: "questions" },
    { model: Question, as: "children" },
    "created_at",
    "ASC",
  ],
  [
    { model: Question, as: "questions" },
    { model: Question, as: "children" },
    { model: Answer, as: "answers" },
    "created_at",
    "ASC",
  ],
]

const nestedQuestions = () => [
  {
    question_id: 10,
    question_text: "Có tặng chuột không?",
    is_answered: true,
    created_at: "2026-05-20T10:00:00.000Z",
    parent_question_id: null,
    user: { user_id: 3, username: "u1", full_name: "Khách" },
    answers: [
      {
        answer_id: 7,
        answer_text: "Có, chuột không dây.",
        created_at: "2026-05-20T11:00:00.000Z",
        user: { user_id: 1, username: "admin", full_name: "QTV" },
      },
    ],
    children: [
      {
        question_id: 11,
        question_text: "Bảo hành chuột bao lâu?",
        is_answered: false,
        created_at: "2026-05-21T10:00:00.000Z",
        parent_question_id: 10,
        user: { user_id: 3, username: "u1", full_name: "Khách" },
        answers: [],
      },
    ],
  },
]

const buildMockProduct = (jsonOverrides = {}) => {
  const json = {
    product_id: 42,
    product_name: "Acer Swift 3",
    slug: "acer-swift-3",
    is_active: true,
    view_count: 5,
    specs: {},
    variations: [],
    images: [],
    Tags: [],
    category: { category_id: 1, category_name: "Laptop" },
    brand: { brand_id: 2, brand_name: "Acer" },
    questions: [],
    ...jsonOverrides,
  }

  return {
    increment: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ ...json })),
  }
}

const getFindOneOptions = () => Product.findOne.mock.calls.at(-1)[0]

const getQuestionsInclude = () =>
  getFindOneOptions().include.find((inc) => inc.as === "questions")

describe("GET /api/products/:id — embedded questions (getProductDetail)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: §5 — include shape
  it("includes questions with root filter, nested user/answers/children, and required:false (§5)", async () => {
    Product.findOne.mockResolvedValue(buildMockProduct({ questions: nestedQuestions() }))

    await request(app).get("/api/products/42")

    expect(getQuestionsInclude()).toEqual(expectedQuestionsInclude())
  })

  // FR: §5 — order clauses
  it("orders root questions DESC, answers ASC, children ASC, and children answers ASC (§5)", async () => {
    Product.findOne.mockResolvedValue(buildMockProduct())

    await request(app).get("/api/products/42")

    const { order } = getFindOneOptions()
    expectedQuestionOrderClauses().forEach((clause) => {
      expect(order).toEqual(expect.arrayContaining([clause]))
    })
  })

  // FR: §4 / BR-01 — nested response
  it("returns 200 with nested questions including answers and children (§4, BR-01)", async () => {
    Product.findOne.mockResolvedValue(buildMockProduct({ questions: nestedQuestions() }))

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(200)
    expect(res.body.product.questions).toHaveLength(1)
    expect(res.body.product.questions[0]).toMatchObject({
      question_id: 10,
      parent_question_id: null,
      answers: [
        expect.objectContaining({
          answer_id: 7,
          answer_text: "Có, chuột không dây.",
        }),
      ],
      children: [
        expect.objectContaining({
          question_id: 11,
          parent_question_id: 10,
          answers: [],
        }),
      ],
    })
  })

  // FR: BR-02 — no questions still 200
  it("returns 200 with empty questions array when product has no Q&A (BR-02)", async () => {
    Product.findOne.mockResolvedValue(buildMockProduct({ questions: [] }))

    const res = await request(app).get("/api/products/acer-swift-3")

    expect(res.status).toBe(200)
    expect(res.body.product.questions).toEqual([])
    expect(getQuestionsInclude().required).toBe(false)
  })

  // FR: §4 — product missing
  it("returns 404 when product is not found (§4)", async () => {
    Product.findOne.mockResolvedValue(null)

    const res = await request(app).get("/api/products/999")

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Product not found")
    expect(res.body.product).toBeUndefined()
  })

  // FR: Error — DB failure
  it("returns 500 when Product.findOne throws", async () => {
    Product.findOne.mockRejectedValue(new Error("DB connection failed"))

    const res = await request(app).get("/api/products/42")

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
