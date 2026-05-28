/**
 * Generates docs/report/qa/UnitTest_StaffAnswerOnProductPage.xlsx
 * Usage: node scripts/generateUnitTestStaffAnswerOnProductPageReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Staff trả lời lần 1",
    input: "POST .../answers Bearer staff + answer_text",
    condition: "§4, AC",
    expected: "201; answer body; Answer.create trim; q.update is_answered",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 201 for staff with answer in body and trimmed Answer.create (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Admin trả lời PDP",
    input: "Bearer admin",
    condition: "§4",
    expected: "201",
    type: "Positive",
    fr: "§4",
    test: "returns 201 for admin role (§4)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thông báo người hỏi",
    input: "question.user_id có giá trị",
    condition: "§5",
    expected: "createNotification gọi với userId owner",
    type: "Positive",
    fr: "§5",
    test: "calls createNotification when question has user_id (§5)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Đã answered",
    input: "is_answered=true",
    condition: "§5",
    expected: "không question.update",
    type: "Positive",
    fr: "§5",
    test: "does not call question.update when is_answered is already true (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu answer_text",
    input: "body rỗng",
    condition: "§4",
    expected: '400 "answer_text is required"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when answer_text is missing (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Manager role",
    input: "Bearer manager",
    condition: "BR-01, §4",
    expected: '403 "Only staff can answer"',
    type: "Negative",
    fr: "BR-01 / §4",
    test: "returns 403 for manager role with Only staff can answer (BR-01, §4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Customer role",
    input: "Bearer customer",
    condition: "§4",
    expected: '403 "Only staff can answer"',
    type: "Negative",
    fr: "§4",
    test: "returns 403 for customer role (§4)",
    result: "Pass",
  },
  {
    id: 8,
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
    id: 9,
    feature: "Đã có answer",
    input: "Answer.findOne tồn tại",
    condition: "§4",
    expected: '409 "This question already has an answer"',
    type: "Negative",
    fr: "§4",
    test: "returns 409 when answer already exists for question (§4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Unique constraint DB",
    input: "Answer.create SequelizeUniqueConstraintError",
    condition: "BR-04",
    expected: '409 "This question already has an answer"',
    type: "Negative",
    fr: "BR-04",
    test: "returns 409 when Answer.create raises SequelizeUniqueConstraintError (BR-04)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "§4",
    expected: "401 Access token required",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token (§4)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_StaffAnswerPDP")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_StaffAnswerOnProductPage.md | server/__tests__/qa/staffAnswerOnProductPage.test.js"
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

  const outPath = path.join(outDir, "UnitTest_StaffAnswerOnProductPage.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
