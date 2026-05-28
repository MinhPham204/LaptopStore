const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  Province: { findAll: jest.fn() },
  Ward: {},
}))

const { Province } = require("../../models")
const geoRoutes = require("../../routes/geo")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api", geoRoutes)
app.use(errorHandler)

const PROVINCES_URL = "/api/provinces"

const mockProvinces = [
  {
    province_id: 79,
    name: "Thành phố Hồ Chí Minh",
    slug: "ho-chi-minh",
    is_hcm: true,
    base_shipping_fee: 30000,
    is_free_shipping: false,
    max_shipping_fee: 150000,
  },
  {
    province_id: 1,
    name: "An Giang",
    slug: "an-giang",
    is_hcm: false,
    base_shipping_fee: 40000,
    is_free_shipping: false,
    max_shipping_fee: 120000,
  },
]

describe("GET /api/provinces (geo.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Province.findAll.mockResolvedValue(mockProvinces)
  })

  // FR: §4 / AC — full shipping fields
  it("returns 200 with all shipping fields on each province (§4, AC)", async () => {
    const res = await request(app).get(PROVINCES_URL)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toEqual({
      province_id: 79,
      name: "Thành phố Hồ Chí Minh",
      slug: "ho-chi-minh",
      is_hcm: true,
      base_shipping_fee: 30000,
      is_free_shipping: false,
      max_shipping_fee: 150000,
    })
    expect(res.body[1]).toMatchObject({
      province_id: 1,
      name: "An Giang",
      slug: "an-giang",
      is_hcm: false,
      base_shipping_fee: 40000,
      is_free_shipping: false,
      max_shipping_fee: 120000,
    })
  })

  // FR: §5 — findAll options
  it("calls Province.findAll with name ASC order and shipping attributes (§5)", async () => {
    await request(app).get(PROVINCES_URL)

    expect(Province.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
      attributes: [
        "province_id",
        "name",
        "slug",
        "is_hcm",
        "base_shipping_fee",
        "is_free_shipping",
        "max_shipping_fee",
      ],
    })
  })

  // FR: §4 — empty list
  it("returns 200 with empty array when no provinces exist (§4)", async () => {
    Province.findAll.mockResolvedValue([])

    const res = await request(app).get(PROVINCES_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  // FR: BR-01 — public endpoint
  it("returns 200 without Authorization header (BR-01)", async () => {
    const res = await request(app).get(PROVINCES_URL).unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(Province.findAll).toHaveBeenCalledTimes(1)
  })

  // FR: GAP-02 — fields query ignored
  it("returns full attributes when fields query param is sent (GAP-02)", async () => {
    const res = await request(app).get(`${PROVINCES_URL}?fields=province_id,name`)

    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty("base_shipping_fee", 30000)
    expect(res.body[0]).toHaveProperty("is_hcm", true)
    expect(res.body[0]).toHaveProperty("max_shipping_fee", 150000)
    expect(res.body[0]).toHaveProperty("slug", "ho-chi-minh")
  })

})

// FR: BR-03 — geo.js has no try/catch; mirror handler + errorHandler tests intended 500 behavior
describe("GET /api/provinces — DB error (BR-03)", () => {
  const findAllOptions = {
    order: [["name", "ASC"]],
    attributes: [
      "province_id",
      "name",
      "slug",
      "is_hcm",
      "base_shipping_fee",
      "is_free_shipping",
      "max_shipping_fee",
    ],
  }

  const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

  const errorApp = express()
  errorApp.use(express.json())
  errorApp.get(
    "/api/provinces",
    wrapAsync(async (req, res) => {
      const provinces = await Province.findAll(findAllOptions)
      res.json(provinces)
    })
  )
  errorApp.use(errorHandler)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 500 when Province.findAll throws (BR-03)", async () => {
    Province.findAll.mockRejectedValue(new Error("Provinces DB error"))

    const res = await request(errorApp).get(PROVINCES_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Provinces DB error")
    expect(Province.findAll).toHaveBeenCalledWith(findAllOptions)
  })
})
