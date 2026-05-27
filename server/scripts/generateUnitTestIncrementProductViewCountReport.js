/**
 * Generates docs/reports/UnitTest_IncrementProductViewCount.xlsx
 * Usage: node scripts/generateUnitTestIncrementProductViewCountReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tăng view_count",
    input: "GET /api/products/1; product found",
    condition: "AC1, BR-01",
    expected: "200; increment('view_count') gọi đúng 1 lần",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: 'calls product.increment("view_count") once when product is found (AC1, BR-01)',
    result: "Pass",
  },
  {
    id: 2,
    feature: "Increment theo slug",
    input: "GET /api/products/test-slug",
    condition: "AC1, BR-01",
    expected: "200; increment gọi",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: "calls increment when detail is loaded by slug (AC1, BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Public không auth",
    input: "GET không Authorization",
    condition: "BR-05",
    expected: "200; increment vẫn gọi",
    type: "Positive",
    fr: "BR-05",
    test: "increments view_count for unauthenticated requests (BR-05)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Không await increment",
    input: "increment pending promise",
    condition: "AC3, BR-03",
    expected: "200 trả về trước khi increment resolve",
    type: "Positive",
    fr: "AC3 / BR-03",
    test: "returns 200 before increment promise resolves (AC3, BR-03)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Increment lỗi im lặng",
    input: "increment reject",
    condition: "AC4, BR-04",
    expected: "GET vẫn 200; body.product có",
    type: "Positive",
    fr: "AC4 / BR-04",
    test: "returns 200 when increment rejects (AC4, BR-04)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "404 không tăng view",
    input: "findOne null",
    condition: "AC2, BR-02",
    expected: "404; increment không gọi",
    type: "Negative",
    fr: "AC2 / BR-02",
    test: "returns 404 and does not call increment when product is not found (AC2, BR-02)",
    result: "Pass",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_IncrementViewCount")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_IncrementProductViewCount.md | server/__tests__/catalog/incrementProductViewCount.test.js"
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
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_IncrementProductViewCount.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
