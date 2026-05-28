/**
 * Generates docs/report/qa/UnitTest_AdminCreateAnswer.xlsx
 * Usage: node scripts/generateUnitTestAdminCreateAnswerReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Admin tạo answer",
    input: "POST /api/admin/questions/42/answers Bearer admin + answer_text",
    condition: "§4, AC",
    expected: '201; "Answer created successfully"; answer có user',
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 201 for admin with message and answer including user (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Manager tạo answer",
    input: "POST ... Bearer manager + answer_text",
    condition: "BR-05",
    expected: '201; "Answer created successfully"; answer.user manager',
    type: "Positive",
    fr: "BR-05",
    test: "returns 201 for manager with message and answer including user (BR-05)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Payload Answer.create",
    input: 'answer_text có khoảng trắng đầu/cuối',
    condition: "§5",
    expected: "Answer.create question_id, user_id, answer_text đã trim",
    type: "Positive",
    fr: "§5",
    test: "calls Answer.create with question_id, user_id, and trimmed answer_text (§5)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Cập nhật is_answered",
    input: "question.is_answered=true trước POST",
    condition: "BR-02",
    expected: "question.update({ is_answered: true })",
    type: "Positive",
    fr: "BR-02",
    test: "calls question.update({ is_answered: true }) even when question is already answered (BR-02)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Không check trùng answer",
    input: "POST hợp lệ",
    condition: "BR-01",
    expected: "Answer.findOne không được gọi",
    type: "Positive",
    fr: "BR-01",
    test: "does not call Answer.findOne before Answer.create (BR-01)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "answer_text rỗng",
    input: "thiếu / \"\" / whitespace",
    condition: "§4",
    expected: '400 "Answer text is required"; không create',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when answer_text is missing answer_text (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "answer_text rỗng",
    input: 'answer_text: ""',
    condition: "§4",
    expected: '400 "Answer text is required"',
    type: "Negative",
    fr: "§4",
    test: 'returns 400 when answer_text is empty string (§4)',
    result: "Pass",
  },
  {
    id: 8,
    feature: "answer_text rỗng",
    input: "answer_text chỉ khoảng trắng",
    condition: "§4",
    expected: '400 "Answer text is required"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when answer_text is whitespace only (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Question không tồn tại",
    input: "Question.findByPk null",
    condition: "§4",
    expected: '404 "Question not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when question is not found (§4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "§4",
    expected: '401 "Access token required"',
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Customer role",
    input: "Bearer customer",
    condition: "§4, BR-05",
    expected: '403 "Insufficient permissions"',
    type: "Negative",
    fr: "§4 / BR-05",
    test: "returns 403 for customer role (§4, BR-05)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Staff role",
    input: "Bearer staff",
    condition: "§4, BR-05",
    expected: '403 "Insufficient permissions"',
    type: "Negative",
    fr: "§4 / BR-05",
    test: "returns 403 for staff role (§4, BR-05)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "User inactive",
    input: "is_active=false",
    condition: "§4",
    expected: '403 "User not found or inactive"',
    type: "Negative",
    fr: "§4",
    test: "returns 403 when user is inactive (§4)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Lỗi DB create",
    input: "Answer.create throw",
    condition: "Error",
    expected: "500; message lỗi",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Answer.create throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminCreateAnswer")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_AdminCreateAnswer.md | server/__tests__/qa/adminCreateAnswer.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminCreateAnswer.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
