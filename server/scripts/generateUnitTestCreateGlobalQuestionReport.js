/**
 * Generates docs/report/qa/UnitTest_CreateGlobalQuestion.xlsx
 * Usage: node scripts/generateUnitTestCreateGlobalQuestionReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Customer tạo câu hỏi global",
    input: "POST /api/products/questions Bearer customer + question_text",
    condition: "§4, AC",
    expected: "201; body.question có user",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 201 with question for authenticated customer (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Payload Question.create",
    input: "question_text có khoảng trắng",
    condition: "§5",
    expected: "product_id/parent null; is_answered false; user_id req.user; text trim",
    type: "Positive",
    fr: "§5",
    test: "calls Question.create with global question fields and trimmed text (§5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Bỏ qua body linkage",
    input: "body có product_id, parent_question_id",
    condition: "BR-02",
    expected: "Question.create vẫn null cho 2 field",
    type: "Positive",
    fr: "BR-02",
    test: "ignores product_id and parent_question_id from request body (BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Staff tạo global",
    input: "Bearer staff",
    condition: "BR-03",
    expected: "201",
    type: "Positive",
    fr: "BR-03",
    test: "returns 201 for staff role (BR-03)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Admin tạo global",
    input: "Bearer admin",
    condition: "BR-03",
    expected: "201",
    type: "Positive",
    fr: "BR-03",
    test: "returns 201 for admin role (BR-03)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "question_text rỗng",
    input: "thiếu / \"\" / whitespace",
    condition: "§4",
    expected: '400 "question_text is required"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when question_text is missing question_text (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "question_text rỗng",
    input: 'question_text: ""',
    condition: "§4",
    expected: '400 "question_text is required"',
    type: "Negative",
    fr: "§4",
    test: 'returns 400 when question_text is empty string (§4)',
    result: "Pass",
  },
  {
    id: 8,
    feature: "question_text rỗng",
    input: "whitespace only",
    condition: "§4",
    expected: '400 "question_text is required"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when question_text is whitespace only (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "BR-01, §4",
    expected: "401 Access token required",
    type: "Negative",
    fr: "BR-01 / §4",
    test: "returns 401 without bearer token (BR-01, §4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "User inactive",
    input: "is_active=false",
    condition: "§4",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "§4",
    test: "returns 403 when user is inactive (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Lỗi DB create",
    input: "Question.create throw",
    condition: "Error",
    expected: "500 message lỗi",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Question.create throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CreateGlobalQuestion")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_CreateGlobalQuestion.md | server/__tests__/qa/createGlobalQuestion.test.js"
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

  const outPath = path.join(outDir, "UnitTest_CreateGlobalQuestion.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
