/**
 * Generates docs/reports/UnitTest_SearchProductsByKeyword.xlsx
 * Usage: node scripts/generateUnitTestSearchProductsByKeywordReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tìm theo tên v2",
    input: "GET /v2?search=dell",
    condition: "AC1, BR-01, BR-02",
    expected: "where product_name Op.iLike '%dell%'; không is_active",
    type: "Positive",
    fr: "AC1 / BR-01 / BR-02",
    test: "filters product_name with iLike when search=dell (AC1, BR-01, BR-02)",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 2,
    feature: "Search + brand",
    input: "GET /v2?search=laptop&brand_id=1",
    condition: "AC3, BR-04",
    expected: "where brand_id=1 AND product_name iLike",
    type: "Positive",
    fr: "AC3 / BR-04",
    test: "combines search with brand_id in where clause (AC3, BR-04)",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 3,
    feature: "Search rỗng",
    input: "GET /v2 (no search)",
    condition: "§10 edge",
    expected: "where không có product_name",
    type: "Positive",
    fr: "§10",
    test: "does not add product_name filter when search is empty (§10)",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 4,
    feature: "Search chỉ spaces",
    input: "GET /v2?search='   '",
    condition: "§10 edge",
    expected: "trim → không product_name filter",
    type: "Positive",
    fr: "§10",
    test: "does not add product_name filter when search is only whitespace (§10)",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 5,
    feature: "Không có kết quả v2",
    input: "search=nonexistent; count=0",
    condition: "AC2",
    expected: "200 products []",
    type: "Positive",
    fr: "AC2",
    test: "returns 200 with empty products when count is zero (AC2)",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 6,
    feature: "Lỗi DB v2",
    input: "findAndCountAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAndCountAll throws",
    result: "Pass",
    api: "GET /api/products/v2",
  },
  {
    id: 7,
    feature: "Suggestions q>=2",
    input: "GET /search-suggestions?q=ab",
    condition: "AC4",
    expected: "findAll is_active + iLike; limit 5",
    type: "Positive",
    fr: "AC4",
    test: "queries suggestions with is_active and iLike when q length is at least 2 (AC4)",
    result: "Pass",
    api: "GET /api/products/search-suggestions",
  },
  {
    id: 8,
    feature: "Suggestions q<2",
    input: "GET ?q=a",
    condition: "AC4",
    expected: "200 { products: [] }; findAll không gọi",
    type: "Positive",
    fr: "AC4",
    test: "returns empty products without calling findAll when q is shorter than 2 (AC4)",
    result: "Pass",
    api: "GET /api/products/search-suggestions",
  },
  {
    id: 9,
    feature: "Lỗi DB suggestions",
    input: "findAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAll throws for suggestions",
    result: "Pass",
    api: "GET /api/products/search-suggestions",
  },
  {
    id: 10,
    feature: "Header submit → URL search",
    input: "navigate /?search=...",
    condition: "AC1 FE",
    expected: "N/A — FE / E2E",
    type: "Ref",
    fr: "AC1",
    test: "—",
    result: "N/A",
    api: "FE",
  },
  {
    id: 11,
    feature: "Share link ?search=",
    input: "/?search=macbook",
    condition: "AC5 FE",
    expected: "N/A — FE / E2E",
    type: "Ref",
    fr: "AC5",
    test: "—",
    result: "N/A",
    api: "FE",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_SearchByKeyword")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_SearchProductsByKeyword.md | server/__tests__/catalog/searchProductsByKeyword.test.js"
  sheet.getCell("A1").font = { bold: true }

  const headers = [
    "ID",
    "Tính năng",
    "Đầu vào",
    "Điều kiện kiểm thử",
    "Kết quả mong đợi",
    "Loại",
    "Mã FR",
    "Tên test Jest",
    "Kết quả thực tế",
    "API",
  ]
  sheet.addRow(headers)
  sheet.getRow(2).font = { bold: true }

  rows.forEach((r) => {
    sheet.addRow([
      r.id,
      r.feature,
      r.input,
      r.condition,
      r.expected,
      r.type,
      r.fr,
      r.test,
      r.result,
      r.api,
    ])
  })

  sheet.columns = [
    { width: 6 },
    { width: 24 },
    { width: 36 },
    { width: 24 },
    { width: 44 },
    { width: 12 },
    { width: 20 },
    { width: 58 },
    { width: 14 },
    { width: 34 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_SearchProductsByKeyword.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
