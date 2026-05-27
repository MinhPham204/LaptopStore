/**
 * Generates docs/reports/UnitTest_ViewProductListLegacy.xlsx
 * Usage: node scripts/generateUnitTestViewProductListLegacyReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Pagination mặc định",
    input: "GET /api/products",
    condition: "page=1 limit=12",
    expected: "limit=12 offset=0; distinct true",
    type: "Positive",
    fr: "AC1",
    test: "uses page=1 and limit=12 with offset 0 by default",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Sort view_count DESC",
    input: "sort=view_count&order=DESC",
    condition: "whitelist",
    expected: "order [['view_count','DESC']]",
    type: "Positive",
    fr: "AC2",
    test: "orders by view_count DESC when sort and order are provided",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Sort invalid fallback",
    input: "sort=not_a_column",
    condition: "whitelist",
    expected: "created_at + order từ query",
    type: "Positive",
    fr: "AC2",
    test: "falls back to created_at DESC when sort is not in whitelist",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Category single",
    input: "category_id=1",
    condition: "where",
    expected: "category_id=1; is_active true",
    type: "Positive",
    fr: "Filter",
    test: "filters by single category_id",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Category CSV",
    input: "category_id=1,2",
    condition: "Op.in",
    expected: "category_id IN [1,2]",
    type: "Positive",
    fr: "Filter",
    test: "filters by multiple category_id values from CSV",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Brand filter",
    input: "brand_id=5 và 10,20",
    condition: "single + CSV",
    expected: "brand_id equality / IN",
    type: "Positive",
    fr: "Filter",
    test: "filters by brand_id single and multiple",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Search tên SP",
    input: "search=dell",
    condition: "AC3",
    expected: "product_name iLike %dell%",
    type: "Positive",
    fr: "AC3",
    test: "filters product_name with iLike when search is provided",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Khoảng giá",
    input: "min_price & max_price",
    condition: "base_price",
    expected: "Op.gte / Op.lte",
    type: "Positive",
    fr: "Filter",
    test: "filters base_price with min_price and max_price",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Chỉ sản phẩm active",
    input: "GET với filters",
    condition: "code thực tế",
    expected: "where.is_active === true",
    type: "Positive",
    fr: "Legacy rule",
    test: "always includes is_active true in where clause",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Response shape",
    input: "page=2 limit=10 count=25",
    condition: "AC4",
    expected: "products, pagination, total, totalPages",
    type: "Positive",
    fr: "AC4",
    test: "returns products, pagination.total, and totalPages",
    result: "Pass",
  },
  {
    id: 11,
    feature: "DB error",
    input: "findAndCountAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAndCountAll throws",
    result: "Pass",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewProductListLegacy")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewProductListLegacy.md | server/__tests__/catalog/viewProductListLegacy.test.js"
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
    ])
  })

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 36 },
    { width: 28 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 54 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewProductListLegacy.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
