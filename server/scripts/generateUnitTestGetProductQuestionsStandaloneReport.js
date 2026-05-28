/**
 * Generates docs/report/qa/UnitTest_GetProductQuestionsStandalone.xlsx
 * Usage: node scripts/generateUnitTestGetProductQuestionsStandaloneReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Resolve product_id số",
    input: "params.id=10",
    condition: "§4, AC",
    expected: "Product.findOne product_id; 200 questions + pagination",
    type: "Positive",
    fr: "§4 / AC",
    test: "resolves product by numeric id and returns 200 with questions and pagination (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Resolve slug",
    input: "params.id=acer-swift-3",
    condition: "§4",
    expected: "Product.findOne where slug",
    type: "Positive",
    fr: "§4",
    test: "resolves product by slug (§4)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Where flat list",
    input: "findAndCountAll",
    condition: "§5",
    expected: "where chỉ product_id; không parent_question_id",
    type: "Positive",
    fr: "§5",
    test: "queries questions by product_id only without filtering parent_question_id (§5)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Includes",
    input: "findAndCountAll options",
    condition: "§5",
    expected: "user + answers + answer.user",
    type: "Positive",
    fr: "§5",
    test: "includes user and answers with answer user (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Sort order",
    input: "order clause",
    condition: "§5",
    expected: "question created_at DESC; answers created_at ASC",
    type: "Positive",
    fr: "§5",
    test: "orders questions DESC and answers ASC (§5)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Pagination defaults",
    input: "không query page/limit",
    condition: "§4",
    expected: "page=1, limit=10, offset=0, totalPages=2",
    type: "Positive",
    fr: "§4",
    test: "uses default page=1 and limit=10 with correct offset and totalPages (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Flat list response",
    input: "mock root + follow-up rows",
    condition: "§4",
    expected: "questions.length=2; ids 10 và 11",
    type: "Positive",
    fr: "§4",
    test: "returns flat list containing both root and follow-up rows (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Custom pagination",
    input: "page=2&limit=5, count=25",
    condition: "§4",
    expected: "offset 5; totalPages 5",
    type: "Positive",
    fr: "§4",
    test: "applies custom page and limit in pagination response (§4)",
    result: "Pass",
  },
  {
    id: 9,
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
    id: 10,
    feature: "Limit max 50",
    input: "limit=100",
    condition: "§4",
    expected: "findAndCountAll limit 50",
    type: "Negative",
    fr: "§4",
    test: "caps limit at 50 when query limit exceeds max (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Limit min 1",
    input: "limit=0",
    condition: "§4",
    expected: "findAndCountAll limit 1",
    type: "Negative",
    fr: "§4",
    test: "enforces minimum limit of 1 (§4)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Page min 1",
    input: "page=0",
    condition: "§4",
    expected: "offset 0; page 1 trong response",
    type: "Negative",
    fr: "§4",
    test: "enforces minimum page of 1 (§4)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Page âm",
    input: "page=-2",
    condition: "§4",
    expected: "pagination.page = 1",
    type: "Negative",
    fr: "§4",
    test: "uses page 1 in pagination when page query is below minimum (§4)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "Error",
    expected: "next(error)",
    type: "Negative",
    fr: "Error",
    test: "calls next when Question.findAndCountAll throws",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Route chưa mount",
    input: "GET /api/products/10/questions",
    condition: "GAP-01",
    expected: "404 Express; findAndCountAll không gọi",
    type: "Negative",
    fr: "GAP-01",
    test: "returns 404 for GET /api/products/42/questions because route is not registered (GAP-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_GetProdQStandalone")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_GetProductQuestionsStandalone.md | server/__tests__/qa/getProductQuestionsStandalone.test.js"
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
    { width: 48 },
    { width: 12 },
    { width: 16 },
    { width: 72 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_GetProductQuestionsStandalone.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
