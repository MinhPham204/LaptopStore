/**
 * Generates docs/report/qa/UnitTest_ListProductQuestionsEmbedded.xlsx
 * Usage: node scripts/generateUnitTestListProductQuestionsEmbeddedReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Include questions",
    input: "GET /api/products/42",
    condition: "§5",
    expected:
      "questions where parent null; required false; user, answers+user, children+user+answers",
    type: "Positive",
    fr: "§5",
    test: "includes questions with root filter, nested user/answers/children, and required:false (§5)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Order Q&A",
    input: "findOne order clause",
    condition: "§5",
    expected: "root DESC; answers ASC; children ASC; children answers ASC",
    type: "Positive",
    fr: "§5",
    test: "orders root questions DESC, answers ASC, children ASC, and children answers ASC (§5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Nested response",
    input: "mock root + answers + children",
    condition: "§4, BR-01",
    expected: "200; product.questions nested đúng",
    type: "Positive",
    fr: "§4 / BR-01",
    test: "returns 200 with nested questions including answers and children (§4, BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Không có Q&A",
    input: "questions: []",
    condition: "BR-02",
    expected: "200; questions []",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 with empty questions array when product has no Q&A (BR-02)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Product không tồn tại",
    input: "Product.findOne null",
    condition: "§4",
    expected: '404 "Product not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when product is not found (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Lỗi DB",
    input: "findOne throw",
    condition: "Error",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Product.findOne throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ListProdQEmbedded")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_ListProductQuestionsEmbedded.md | server/__tests__/qa/listProductQuestionsEmbedded.test.js"
  sheet.getCell("A1").font = { bold: true }

  const headers = [
    "ID",
    "Tính năng",
    "Đầu vào",
    "Điều kiện kiểm thử",
    "Kết quả mong đợi",
    "Loại",
    "Mã FR",
    "Tên test",
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
    { width: 42 },
    { width: 18 },
    { width: 52 },
    { width: 12 },
    { width: 16 },
    { width: 72 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_ListProductQuestionsEmbedded.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
