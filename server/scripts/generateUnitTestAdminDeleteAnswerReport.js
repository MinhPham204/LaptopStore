/**
 * Generates docs/report/qa/UnitTest_AdminDeleteAnswer.xlsx
 * Usage: node scripts/generateUnitTestAdminDeleteAnswerReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa answer thành công",
    input: "deleteAnswer params question_id + answer_id",
    condition: "§4, AC",
    expected: '200 json "Answer deleted successfully"; destroy gọi 1 lần',
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with Answer deleted successfully and calls answer.destroy (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Composite lookup",
    input: "answer_id=10, question_id=42",
    condition: "§5",
    expected: "Answer.findOne where answer_id + question_id",
    type: "Positive",
    fr: "§5",
    test: "looks up answer by composite answer_id and question_id (§5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Còn answer khác",
    input: "sau destroy Answer.count=2",
    condition: "BR-01",
    expected: "KHÔNG gọi Question.update",
    type: "Positive",
    fr: "BR-01",
    test: "does not call Question.update when remaining answer count is greater than 0 (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Xóa answer cuối",
    input: "sau destroy Answer.count=0",
    condition: "BR-02",
    expected: "Question.update({ is_answered: false }, { where: question_id })",
    type: "Positive",
    fr: "BR-02",
    test: "calls Question.update with is_answered false when count is 0 (BR-02)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Answer không tồn tại",
    input: "Answer.findOne null",
    condition: "§4",
    expected: '404 "Answer not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when answer is not found (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sai question_id",
    input: "answer_id=10, question_id=99 không khớp",
    condition: "AC",
    expected: '404 "Answer not found"',
    type: "Negative",
    fr: "AC",
    test: "returns 404 when answer_id does not belong to question_id in path (AC)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Lỗi destroy",
    input: "answer.destroy throw",
    condition: "Error",
    expected: "next(error); không res.json",
    type: "Negative",
    fr: "Error",
    test: "calls next when answer.destroy throws",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Route chưa mount",
    input: "DELETE /api/admin/questions/42/answers/10 Bearer admin",
    condition: "GAP-01",
    expected: "404 Express; Answer.findOne không gọi",
    type: "Negative",
    fr: "GAP-01",
    test: "returns 404 for DELETE with admin JWT because route is not registered (GAP-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminDeleteAnswer")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_AdminDeleteAnswer.md | server/__tests__/qa/adminDeleteAnswer.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminDeleteAnswer.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
