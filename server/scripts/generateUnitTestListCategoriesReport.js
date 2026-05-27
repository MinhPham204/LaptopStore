/**
 * Generates docs/reports/UnitTest_ListCategories.xlsx
 * Usage: node scripts/generateUnitTestListCategoriesReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách danh mục",
    input: "GET /api/products/categories; mock 2 rows",
    condition: "AC1, AC2, BR-01",
    expected:
      "200; categories[]; category_id, category_name, slug, parent_id, icon_url",
    type: "Positive",
    fr: "AC1 / AC2 / BR-01",
    test: "returns 200 with categories including required fields (AC1, AC2, BR-01)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Sắp xếp display_order",
    input: "spy Category.findAll",
    condition: "BR-01",
    expected: "order: [['display_order', 'ASC']]",
    type: "Positive",
    fr: "BR-01",
    test: "loads categories ordered by display_order ASC (BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Không có danh mục",
    input: "findAll []",
    condition: "§10 edge",
    expected: "200 { categories: [] }",
    type: "Positive",
    fr: "§10",
    test: "returns 200 with empty categories array when none exist (§10)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Public API",
    input: "GET không Authorization",
    condition: "AC4, BR-04",
    expected: "200; không yêu cầu JWT",
    type: "Positive",
    fr: "AC4 / BR-04",
    test: "returns 200 without Authorization header (AC4, BR-04)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Lỗi DB",
    input: "Category.findAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Category.findAll throws",
    result: "Pass",
  },
  {
    id: 6,
    feature: "HomePage filter danh mục",
    input: "ProductFilter + categories hook",
    condition: "AC3 FE",
    expected: "N/A — FE integration test riêng",
    type: "Ref",
    fr: "AC3",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ListCategories")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ListCategories.md | server/__tests__/catalog/listCategories.test.js"
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
    { width: 26 },
    { width: 36 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ListCategories.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
