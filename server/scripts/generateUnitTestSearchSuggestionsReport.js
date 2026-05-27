/**
 * Generates docs/reports/UnitTest_SearchSuggestions.xlsx
 * Usage: node scripts/generateUnitTestSearchSuggestionsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Gợi ý theo từ khóa",
    input: "GET ?q=ma",
    condition: "AC2",
    expected:
      "findAll is_active:true; product_name iLike %ma%; limit 5; variations limit 1; images is_primary",
    type: "Positive",
    fr: "AC2",
    test: "queries active products by product_name when q has at least 2 characters (AC2)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "q rỗng",
    input: "GET không có q",
    condition: "AC1",
    expected: "200 { products: [] }; findAll không gọi",
    type: "Positive",
    fr: "AC1",
    test: "returns empty products without calling findAll when q is omitted (AC1)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "q chỉ khoảng trắng",
    input: "GET ?q='   '",
    condition: "§9 edge",
    expected: "trim → []; findAll không gọi",
    type: "Positive",
    fr: "§9",
    test: "returns empty products when q is only spaces after trim (§9)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Giới hạn 5 SP",
    input: "mock 3 products; ?q=mac",
    condition: "AC2 limit",
    expected: "200; products.length <= 5",
    type: "Positive",
    fr: "AC2",
    test: "returns at most five products from findAll results (AC2)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "q một ký tự",
    input: "GET ?q=m",
    condition: "AC1",
    expected: "200 { products: [] }; findAll không gọi",
    type: "Negative",
    fr: "AC1",
    test: "returns empty products when q is a single character (AC1)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Lỗi DB",
    input: "findAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAll throws",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Không có kết quả",
    input: "findAll []",
    condition: "§9 empty",
    expected: "200 { products: [] }",
    type: "Negative",
    fr: "§9",
    test: "returns 200 with empty products when findAll returns no rows",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Click suggestion → detail",
    input: "Header navigate slug",
    condition: "AC3",
    expected: "N/A — FE test riêng",
    type: "Ref",
    fr: "AC3",
    test: "—",
    result: "N/A",
  },
  {
    id: 9,
    feature: "Submit search → HomePage v2",
    input: "form ?search=",
    condition: "AC4",
    expected: "N/A — FE test riêng",
    type: "Ref",
    fr: "AC4",
    test: "—",
    result: "N/A",
  },
  {
    id: 10,
    feature: "Hook không gọi API khi len<2",
    input: "useSearchSuggestions enabled",
    condition: "AC5",
    expected: "N/A — FE test riêng",
    type: "Ref",
    fr: "AC5",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_SearchSuggestions")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_SearchSuggestions.md | server/__tests__/catalog/searchSuggestions.test.js"
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
    { width: 32 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 14 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_SearchSuggestions.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
