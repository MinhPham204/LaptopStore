/**
 * Generates docs/report/qa/UnitTest_ListGlobalQuestions.xlsx
 * Usage: node scripts/generateUnitTestListGlobalQuestionsReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Public list",
    input: "GET /api/products/questions không Authorization",
    condition: "§4, AC",
    expected: "200; global + product-linked root questions",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 without Authorization header (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Where root only",
    input: "findAndCountAll",
    condition: "BR-01",
    expected: "where parent_question_id null; không filter product_id",
    type: "Positive",
    fr: "BR-01",
    test: "filters only parent_question_id null without product_id IS NULL (BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Defaults",
    input: "không query",
    condition: "§4",
    expected: "limit 3; offset 0",
    type: "Positive",
    fr: "§4",
    test: "uses default limit 3 and page-based offset 0 when no query params (§4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Includes và order",
    input: "findAndCountAll options",
    condition: "§5",
    expected: "user, product required:false, answers+user; DESC/ASC; distinct:true",
    type: "Positive",
    fr: "§5",
    test: "includes user, optional product, answers+user with order and distinct:true (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Response shape",
    input: "page=2&limit=10",
    condition: "§4",
    expected: "questions,total,page,limit,offset,totalPages; charset utf-8",
    type: "Positive",
    fr: "§4",
    test: "returns questions, total, page, limit, offset, totalPages with utf-8 Content-Type (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Offset ưu tiên",
    input: "offset=5&page=99",
    condition: "§4",
    expected: "findAndCountAll offset=5",
    type: "Positive",
    fr: "§4",
    test: "uses explicit offset instead of page-based offset when offset query is provided (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Limit max 50",
    input: "limit=100",
    condition: "§4",
    expected: "limit 50",
    type: "Negative",
    fr: "§4",
    test: "caps limit at 50 when query limit exceeds max (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Limit min 1",
    input: "limit=0",
    condition: "§4",
    expected: "limit 1",
    type: "Negative",
    fr: "§4",
    test: "enforces minimum limit of 1 (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Page min 1",
    input: "page=0",
    condition: "§4",
    expected: "offset 0",
    type: "Negative",
    fr: "§4",
    test: "uses page 1 for offset calculation when page query is below minimum (§4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Offset min 0",
    input: "offset=-5",
    condition: "§4",
    expected: "offset 0",
    type: "Negative",
    fr: "§4",
    test: "enforces minimum offset of 0 when offset query is negative (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Danh sách rỗng",
    input: "count=0, rows=[]",
    condition: "BR-04",
    expected: "questions []; total 0; totalPages 1",
    type: "Negative",
    fr: "BR-04",
    test: "returns empty questions with total 0 and totalPages 1 (BR-04)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "Error",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Question.findAndCountAll throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ListGlobalQuestions")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_ListGlobalQuestions.md | server/__tests__/qa/listGlobalQuestions.test.js"
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

  const outPath = path.join(outDir, "UnitTest_ListGlobalQuestions.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
