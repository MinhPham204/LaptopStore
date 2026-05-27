/**
 * Generates docs/reports/UnitTest_ViewProductDetail.xlsx
 * Usage: node scripts/generateUnitTestViewProductDetailReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Chi tiết theo product_id",
    input: "GET /api/products/42",
    condition: "AC2 numeric id",
    expected: "200; body.product; where product_id=42",
    type: "Positive",
    fr: "AC2",
    test: "returns 200 with product when id is numeric",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Chi tiết theo slug",
    input: "GET /api/products/my-slug",
    condition: "AC1 slug",
    expected: "where { slug: 'my-slug' }",
    type: "Positive",
    fr: "AC1",
    test: "returns 200 and queries by slug when id is not numeric",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Associations đầy đủ",
    input: "GET /api/products/42",
    condition: "AC4",
    expected: "variations, images, questions, Tags, category, brand",
    type: "Positive",
    fr: "AC4",
    test: "returns product with variations, images, questions, Tags, category, and brand",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Specs null → {}",
    input: "toJSON specs null",
    condition: "AC5",
    expected: "response.specs = {}",
    type: "Positive",
    fr: "AC5",
    test: "normalizes null specs to empty object in response",
    result: "Pass",
  },
  {
    id: 5,
    feature: "primaryVariationId",
    input: "variation is_primary=true",
    condition: "§7",
    expected: "primaryVariationId=10",
    type: "Positive",
    fr: "AC5 / §7",
    test: "sets primaryVariationId from primary variation when missing",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Tăng view_count",
    input: "GET success",
    condition: "increment('view_count')",
    expected: "increment gọi 1 lần (ref FR_IncrementProductViewCount)",
    type: "Positive",
    fr: "AC6 / BR-02",
    test: "calls product.increment for view_count on successful load",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Không tìm thấy SP",
    input: "findOne null",
    condition: "AC3",
    expected: "404 Product not found",
    type: "Negative",
    fr: "AC3",
    test: "returns 404 when product is not found",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Lỗi DB",
    input: "findOne throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findOne throws",
    result: "Pass",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewProductDetail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewProductDetail.md | server/__tests__/catalog/viewProductDetail.test.js"
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
    { width: 32 },
    { width: 24 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 52 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewProductDetail.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
