/**
 * Generates docs/reports/UnitTest_ListBrands.xlsx
 * Usage: node scripts/generateUnitTestListBrandsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách thương hiệu",
    input: "GET /api/products/brands; mock 2 rows",
    condition: "AC1, AC4, BR-01",
    expected: "200; brands.length=2; brand_id, brand_name, slug",
    type: "Positive",
    fr: "AC1 / AC4 / BR-01",
    test: "returns 200 with brands including brand_id, brand_name, and slug (AC1, AC4, BR-01)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Sắp xếp brand_name",
    input: "spy Brand.findAll",
    condition: "BR-02",
    expected: "order: [['brand_name', 'ASC']]",
    type: "Positive",
    fr: "BR-02",
    test: "loads brands ordered by brand_name ASC (BR-02)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Không có brand",
    input: "findAll []",
    condition: "§10 edge",
    expected: "200 { brands: [] }",
    type: "Positive",
    fr: "§10",
    test: "returns 200 with empty brands array when none exist (§10)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Public API",
    input: "GET không Authorization",
    condition: "AC2, BR-03",
    expected: "200; không yêu cầu JWT",
    type: "Positive",
    fr: "AC2 / BR-03",
    test: "returns 200 without Authorization header (AC2, BR-03)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Lỗi DB",
    input: "Brand.findAll throw",
    condition: "§5",
    expected: "500",
    type: "Negative",
    fr: "§5",
    test: "returns 500 when Brand.findAll throws (§5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "HomePage filter thương hiệu",
    input: "ProductFilter + brands hook",
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
  const sheet = workbook.addWorksheet("UnitTest_ListBrands")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ListBrands.md | server/__tests__/catalog/listBrands.test.js"
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
    "../../docs/reports/UnitTest_ListBrands.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
