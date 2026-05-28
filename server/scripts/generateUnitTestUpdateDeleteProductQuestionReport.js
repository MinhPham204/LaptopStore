/**
 * Generates docs/report/qa/UnitTest_UpdateDeleteProductQuestion.xlsx
 * Usage: node scripts/generateUnitTestUpdateDeleteProductQuestionReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Owner cập nhật",
    input: "updateQuestion owner + question_text trim",
    condition: "§4, AC",
    expected: "200; question trong body; update trim",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 for owner with trimmed question_text (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Staff sửa câu người khác",
    input: "staff role, question.user_id khác",
    condition: "BR-01, §5",
    expected: "200; question.update",
    type: "Positive",
    fr: "BR-01 / §5",
    test: "returns 200 when staff updates another user's question (BR-01, §5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Owner xóa",
    input: "deleteQuestion owner",
    condition: "§4, BR-05",
    expected: "200 { ok: true }; Answer.destroy; q.destroy",
    type: "Positive",
    fr: "§4 / BR-05",
    test: "returns 200 for owner and destroys answers then question (§4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Staff xóa",
    input: "deleteQuestion staff",
    condition: "§5",
    expected: "200; Answer.destroy + q.destroy",
    type: "Positive",
    fr: "§5",
    test: "returns 200 for staff deleting another user's question (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu question_text",
    input: "update body rỗng",
    condition: "§4",
    expected: '400 "question_text is required"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when question_text is missing (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Update not found",
    input: "Question.findByPk null",
    condition: "§4",
    expected: '404 "Question not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when question is not found (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Customer khác",
    input: "update không phải owner/staff",
    condition: "§4",
    expected: '403 "Insufficient permissions"',
    type: "Negative",
    fr: "§4",
    test: "returns 403 when customer is not owner and not staff (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Manager sửa câu người khác",
    input: "manager role",
    condition: "BR-03",
    expected: '403 "Insufficient permissions"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 403 when manager updates another user's question (BR-03)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Delete not found",
    input: "delete findByPk null",
    condition: "§4",
    expected: '404 "Question not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when question is not found on delete (§4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Customer xóa câu người khác",
    input: "delete other owner",
    condition: "§4",
    expected: '403; không destroy',
    type: "Negative",
    fr: "§4",
    test: "returns 403 when customer deletes another user's question (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "PUT route missing",
    input: "PUT /api/products/questions/5",
    condition: "GAP-01",
    expected: "404 Express",
    type: "Negative",
    fr: "GAP-01",
    test: "returns 404 for PUT because update route is not registered (GAP-01)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "DELETE route missing",
    input: "DELETE /api/products/questions/5",
    condition: "GAP-01",
    expected: "404 Express",
    type: "Negative",
    fr: "GAP-01",
    test: "returns 404 for DELETE because delete route is not registered (GAP-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateDeleteQ")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_UpdateDeleteProductQuestion.md | server/__tests__/qa/updateDeleteProductQuestion.test.js"
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

  const outPath = path.join(outDir, "UnitTest_UpdateDeleteProductQuestion.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
