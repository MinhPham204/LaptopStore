const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  sequelize: {},
  Product: { name: "Product" },
  Question: { findAndCountAll: jest.fn() },
  Answer: { name: "Answer" },
  User: { name: "User" },
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
  Role: {},
}))

const { Question, User, Product, Answer } = require("../../models")
const productRoutes = require("../../routes/productRoutes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api/products", productRoutes)
app.use(errorHandler)

const GLOBAL_QUESTIONS_URL = "/api/products/questions"

const globalAndProductQuestions = () => [
  {
    question_id: 1,
    product_id: null,
    question_text: "Shop có giao nhanh không?",
    is_answered: true,
    created_at: "2026-05-27T08:00:00.000Z",
    parent_question_id: null,
    user: { user_id: 2, username: "user1", full_name: "Nguyễn A" },
    product: null,
    answers: [
      {
        answer_id: 5,
        answer_text: "Có, 1–2 ngày nội thành.",
        created_at: "2026-05-27T09:00:00.000Z",
        user: { user_id: 1, username: "admin", full_name: "QTV" },
      },
    ],
  },
  {
    question_id: 2,
    product_id: 10,
    question_text: "Laptop này pin bao lâu?",
    is_answered: false,
    created_at: "2026-05-27T07:00:00.000Z",
    parent_question_id: null,
    user: { user_id: 3, username: "user2", full_name: "Trần B" },
    product: { product_id: 10, product_name: "Acer Swift 3", slug: "acer-swift-3" },
    answers: [],
  },
]

const listResult = (overrides = {}) => ({
  count: 42,
  rows: globalAndProductQuestions(),
  ...overrides,
})

const getFindAndCountAllOptions = () => Question.findAndCountAll.mock.calls.at(-1)[0]

describe("GET /api/products/questions (productController.getGlobalQuestions)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Question.findAndCountAll.mockResolvedValue(listResult())
  })

  // FR: §4 / AC — public, no auth
  it("returns 200 without Authorization header (§4, AC)", async () => {
    const res = await request(app).get(GLOBAL_QUESTIONS_URL)

    expect(res.status).toBe(200)
    expect(res.body.questions).toHaveLength(2)
    expect(res.body.questions[0].product_id).toBeNull()
    expect(res.body.questions[1].product_id).toBe(10)
    expect(res.body.questions[1].product).toEqual({
      product_id: 10,
      product_name: "Acer Swift 3",
      slug: "acer-swift-3",
    })
  })

  // FR: BR-01 — only root questions, not product_id filter
  it("filters only parent_question_id null without product_id IS NULL (BR-01)", async () => {
    await request(app).get(GLOBAL_QUESTIONS_URL)

    const opts = getFindAndCountAllOptions()
    expect(opts.where).toEqual({ parent_question_id: null })
    expect(opts.where).not.toHaveProperty("product_id")
  })

  // FR: §4 — defaults
  it("uses default limit 3 and page-based offset 0 when no query params (§4)", async () => {
    await request(app).get(GLOBAL_QUESTIONS_URL)

    const opts = getFindAndCountAllOptions()
    expect(opts.limit).toBe(3)
    expect(opts.offset).toBe(0)
  })

  // FR: §5 — includes, order, distinct
  it("includes user, optional product, answers+user with order and distinct:true (§5)", async () => {
    await request(app).get(GLOBAL_QUESTIONS_URL)

    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: [
          "question_id",
          "product_id",
          "question_text",
          "is_answered",
          "created_at",
          "parent_question_id",
        ],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_id", "username", "full_name"],
          },
          {
            model: Product,
            as: "product",
            attributes: ["product_id", "product_name", "slug"],
            required: false,
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
        ],
        order: [
          ["created_at", "DESC"],
          [{ model: Answer, as: "answers" }, "created_at", "ASC"],
        ],
        distinct: true,
      })
    )
  })

  // FR: §4 — response shape and charset
  it("returns questions, total, page, limit, offset, totalPages with utf-8 Content-Type (§4)", async () => {
    const res = await request(app).get(`${GLOBAL_QUESTIONS_URL}?page=2&limit=10`)

    expect(res.headers["content-type"]).toMatch(/application\/json;\s*charset=utf-8/i)
    expect(res.body).toEqual({
      questions: globalAndProductQuestions(),
      total: 42,
      page: 2,
      limit: 10,
      offset: 10,
      totalPages: 5,
    })
  })

  // FR: §4 — offset priority over page
  it("uses explicit offset instead of page-based offset when offset query is provided (§4)", async () => {
    await request(app).get(`${GLOBAL_QUESTIONS_URL}?offset=5&page=99&limit=10`)

    const opts = getFindAndCountAllOptions()
    expect(opts.offset).toBe(5)
    expect(opts.limit).toBe(10)
  })

  // FR: §4 — limit max 50
  it("caps limit at 50 when query limit exceeds max (§4)", async () => {
    await request(app).get(`${GLOBAL_QUESTIONS_URL}?limit=100`)

    expect(getFindAndCountAllOptions().limit).toBe(50)
  })

  // FR: §4 — limit min 1
  it("enforces minimum limit of 1 (§4)", async () => {
    await request(app).get(`${GLOBAL_QUESTIONS_URL}?limit=0`)

    expect(getFindAndCountAllOptions().limit).toBe(1)
  })

  // FR: §4 — page min 1 (offset from page when no offset param)
  it("uses page 1 for offset calculation when page query is below minimum (§4)", async () => {
    await request(app).get(`${GLOBAL_QUESTIONS_URL}?page=0&limit=10`)

    expect(getFindAndCountAllOptions().offset).toBe(0)
  })

  // FR: §4 — offset min 0
  it("enforces minimum offset of 0 when offset query is negative (§4)", async () => {
    await request(app).get(`${GLOBAL_QUESTIONS_URL}?offset=-5&limit=3`)

    expect(getFindAndCountAllOptions().offset).toBe(0)
  })

  // FR: BR-04 — empty list
  it("returns empty questions with total 0 and totalPages 1 (BR-04)", async () => {
    Question.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })

    const res = await request(app).get(GLOBAL_QUESTIONS_URL)

    expect(res.status).toBe(200)
    expect(res.body.questions).toEqual([])
    expect(res.body.total).toBe(0)
    expect(res.body.totalPages).toBe(1)
  })

  // FR: Error — DB failure
  it("returns 500 when Question.findAndCountAll throws", async () => {
    Question.findAndCountAll.mockRejectedValue(new Error("DB connection failed"))

    const res = await request(app).get(GLOBAL_QUESTIONS_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("DB connection failed")
  })
})
