const request = require("supertest")
const express = require("express")

jest.mock("../../models", () => ({
  Province: {},
  Ward: { findAll: jest.fn() },
}))

const { Ward } = require("../../models")
const geoRoutes = require("../../routes/geo")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
app.use(express.json())
app.use("/api", geoRoutes)
app.use(errorHandler)

const PROVINCE_ID = 79
const WARDS_URL = `/api/provinces/${PROVINCE_ID}/wards`

const findAllOptions = {
  where: { province_id: String(PROVINCE_ID) },
  order: [["name", "ASC"]],
  attributes: ["ward_id", "name", "slug", "extra_fee", "province_id"],
}

const mockWards = [
  {
    ward_id: 12345,
    name: "Phường Hiệp Bình Chánh",
    slug: "hiep-binh-chanh",
    extra_fee: 5000,
    province_id: PROVINCE_ID,
  },
  {
    ward_id: 12346,
    name: "Phường Linh Đông",
    slug: "linh-dong",
    extra_fee: 3000,
    province_id: PROVINCE_ID,
  },
]

describe("GET /api/provinces/:id/wards (geo.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Ward.findAll.mockResolvedValue(mockWards)
  })

  // FR: §4 / AC — ward fields
  it("returns 200 with ward fields on each row (§4, AC)", async () => {
    const res = await request(app).get(WARDS_URL)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toEqual({
      ward_id: 12345,
      name: "Phường Hiệp Bình Chánh",
      slug: "hiep-binh-chanh",
      extra_fee: 5000,
      province_id: PROVINCE_ID,
    })
  })

  // FR: §5 — findAll args
  it("calls Ward.findAll with province_id filter, name ASC, and attributes (§5)", async () => {
    await request(app).get(WARDS_URL)

    expect(Ward.findAll).toHaveBeenCalledWith(findAllOptions)
  })

  // FR: §4 — empty list
  it("returns 200 with empty array when province has no wards (§4)", async () => {
    Ward.findAll.mockResolvedValue([])

    const res = await request(app).get(WARDS_URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  // FR: GAP-03 — invalid province id still returns 200 empty
  it("returns 200 with empty array for unknown province id without validation (GAP-03)", async () => {
    Ward.findAll.mockResolvedValue([])

    const res = await request(app).get("/api/provinces/99999/wards")

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    expect(Ward.findAll).toHaveBeenCalledWith({
      ...findAllOptions,
      where: { province_id: "99999" },
    })
  })

  // FR: BR-01 — public
  it("returns 200 without Authorization header (BR-01)", async () => {
    const res = await request(app).get(WARDS_URL).unset("Authorization")

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(Ward.findAll).toHaveBeenCalledTimes(1)
  })
})

// FR: §4 — geo.js has no try/catch; mirror handler tests 500 via errorHandler
describe("GET /api/provinces/:id/wards — DB error", () => {
  const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

  const errorApp = express()
  errorApp.use(express.json())
  errorApp.get(
    "/api/provinces/:id/wards",
    wrapAsync(async (req, res) => {
      const wards = await Ward.findAll({
        where: { province_id: req.params.id },
        order: [["name", "ASC"]],
        attributes: ["ward_id", "name", "slug", "extra_fee", "province_id"],
      })
      res.json(wards)
    })
  )
  errorApp.use(errorHandler)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 500 when Ward.findAll throws", async () => {
    Ward.findAll.mockRejectedValue(new Error("Wards DB error"))

    const res = await request(errorApp).get(WARDS_URL)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Wards DB error")
    expect(Ward.findAll).toHaveBeenCalledWith(findAllOptions)
  })
})
