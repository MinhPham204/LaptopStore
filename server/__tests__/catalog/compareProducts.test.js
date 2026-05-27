const request = require("supertest")
const express = require("express")
const { Op } = require("sequelize")

jest.mock("../../models", () => ({
  sequelize: { query: jest.fn() },
  Product: { findAll: jest.fn() },
  ProductVariation: {},
  ProductImage: {},
  Category: {},
  Brand: {},
  Tag: {},
  Order: {},
  OrderItem: {},
  Question: {},
  Answer: {},
  User: {},
  Role: {},
}))

const { Product } = require("../../models")
const { compareProducts } = require("../../controllers/productController")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.post("/api/products/compare", compareProducts)
app.use(errorHandler)

const mockProduct = (id, specs) => ({
  product_id: id,
  product_name: `Laptop ${id}`,
  thumbnail_url: `/img-${id}.png`,
  base_price: 10000000 * id,
  discount_percentage: 5 * id,
  specs,
})

const displaySpecs = (size) => ({
  display: [{ label: "Kích thước", value: size }],
})

const invokeGetCompare = async (idsQuery) => {
  const req = { body: {}, query: { ids: idsQuery } }
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  const next = jest.fn()
  await compareProducts(req, res, next)
  return { res, next }
}

describe("compareProducts API", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: §8 POST — ids [1,2] → products summary + compare matrix
  it("returns 200 with products and compare matrix for POST ids [1,2]", async () => {
    Product.findAll.mockResolvedValue([
      mockProduct(1, displaySpecs('15.6"')),
      mockProduct(2, displaySpecs('14"')),
    ])

    const res = await request(app)
      .post("/api/products/compare")
      .send({ ids: [1, 2] })

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(2)
    expect(res.body.products[0]).toEqual({
      id: 1,
      name: "Laptop 1",
      thumbnail_url: "/img-1.png",
      base_price: 10000000,
      discount_percentage: 5,
    })
    expect(res.body.compare).toEqual([
      {
        group: "display",
        rows: [
          {
            label: "Kích thước",
            values: ['15.6"', '14"'],
          },
        ],
      },
    ])

    expect(Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: { [Op.in]: [1, 2] } },
        attributes: expect.arrayContaining([
          "product_id",
          "product_name",
          "thumbnail_url",
          "base_price",
          "discount_percentage",
          "specs",
        ]),
      })
    )
  })

  // FR: §8 — empty ids → 400
  it("returns 400 when ids array is empty (POST)", async () => {
    const res = await request(app).post("/api/products/compare").send({ ids: [] })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/ids is required/i)
    expect(Product.findAll).not.toHaveBeenCalled()
  })

  // FR: §8 — empty query ids via controller (route GET /compare may be swallowed by /:id)
  it('returns 400 when query ids is empty via controller invoke', async () => {
    const { res, next } = await invokeGetCompare("")

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/ids is required/i)
    expect(Product.findAll).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §8 GET — comma-separated ids via controller
  it('loads products for query ids "1,2,3" via controller (GET)', async () => {
    Product.findAll.mockResolvedValue([
      mockProduct(1, displaySpecs("15.6")),
      mockProduct(2, displaySpecs("14")),
      mockProduct(3, {
        display: [{ label: "Kích thước", value: "13.3" }],
        performance: [{ label: "CPU", value: "Ryzen 7" }],
      }),
    ])

    const { res, next } = await invokeGetCompare("1,2,3")

    expect(res.statusCode).toBe(200)
    expect(Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: { [Op.in]: ["1", "2", "3"] } },
      })
    )
    expect(res.body.products).toHaveLength(3)
    expect(res.body.compare).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ group: "display" }),
        expect.objectContaining({ group: "performance" }),
      ])
    )
    expect(
      res.body.compare
        .find((g) => g.group === "display")
        .rows.find((r) => r.label === "Kích thước").values
    ).toEqual(["15.6", "14", "13.3"])
    expect(
      res.body.compare
        .find((g) => g.group === "performance")
        .rows.find((r) => r.label === "CPU").values
    ).toEqual(["—", "—", "Ryzen 7"])
    expect(next).not.toHaveBeenCalled()
  })

  // FR: §8 — missing label in one product fills with em dash
  it("fills compare matrix values with em dash when label missing on a product", async () => {
    Product.findAll.mockResolvedValue([
      mockProduct(1, {
        display: [
          { label: "Kích thước", value: "15.6" },
          { label: "Độ phân giải", value: "FHD" },
        ],
      }),
      mockProduct(2, {
        display: [{ label: "Kích thước", value: "14" }],
      }),
    ])

    const res = await request(app)
      .post("/api/products/compare")
      .send({ ids: [1, 2] })

    const displayGroup = res.body.compare.find((g) => g.group === "display")
    const resolutionRow = displayGroup.rows.find(
      (r) => r.label === "Độ phân giải"
    )
    expect(resolutionRow.values).toEqual(["FHD", "—"])
  })

  // FR: Error — DB failure → 500
  it("returns 500 when Product.findAll throws", async () => {
    Product.findAll.mockRejectedValue(new Error("DB down"))

    const res = await request(app)
      .post("/api/products/compare")
      .send({ ids: [1] })

    expect(res.status).toBe(500)
  })
})
