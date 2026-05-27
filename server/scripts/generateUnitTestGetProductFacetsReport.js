/**
 * Generates docs/reports/UnitTest_GetProductFacets.xlsx
 * Usage: node scripts/generateUnitTestGetProductFacetsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Đủ 6 facet keys",
    input: "GET /api/products/facets",
    condition: "AC1",
    expected:
      "200; facets có processor, ram, storage, graphics_card, screen_size, weight",
    type: "Positive",
    fr: "AC1",
    test: "returns 200 with all six facet keys (AC1)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Sort localeCompare",
    input: "processor values unsorted",
    condition: "AC2",
    expected: "mảng sorted A→Z",
    type: "Positive",
    fr: "AC2",
    test: "sorts variation facet values with localeCompare (AC2)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Lọc null/empty",
    input: "ram có null và ''",
    condition: "AC2, BR-01",
    expected: "chỉ non-empty strings",
    type: "Positive",
    fr: "AC2 / BR-01",
    test: "filters out null and empty variation values (AC2, BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Weight từ specs",
    input: "sequelize.query rows",
    condition: "AC3",
    expected: "facets.weight mapped và sorted",
    type: "Positive",
    fr: "AC3",
    test: "maps weight facet values from sequelize query rows (AC3)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Weight query lỗi",
    input: "sequelize.query throw",
    condition: "AC5",
    expected: "200; weight []; variation facets vẫn có",
    type: "Positive",
    fr: "AC5",
    test: "returns 200 with empty weight when sequelize.query throws (AC5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Variation DB lỗi",
    input: "ProductVariation.findAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when ProductVariation.findAll throws",
    result: "Pass",
  },
  {
    id: 7,
    feature: "FE filter → v2",
    input: "HomePage specFilters",
    condition: "AC4 integration",
    expected: "N/A — integration / E2E",
    type: "Ref",
    fr: "AC4",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_GetProductFacets")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_GetProductFacets.md | server/__tests__/catalog/getProductFacets.test.js"
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
    { width: 34 },
    { width: 24 },
    { width: 48 },
    { width: 12 },
    { width: 16 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_GetProductFacets.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
