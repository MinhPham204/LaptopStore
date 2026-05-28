/**
 * Generates docs/report/qa/UnitTest_AdminUpdateAnswer.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateAnswerReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật answer thành công",
    input: "updateAnswer body answer_text có khoảng trắng",
    condition: "§4, AC",
    expected: '200 "Answer updated successfully"; answer_text trim; answer.update gọi',
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with Answer updated successfully and trimmed answer in response (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Composite lookup",
    input: "answer_id=10, question_id=42",
    condition: "BR-03",
    expected: "Answer.findOne where answer_id + question_id",
    type: "Positive",
    fr: "BR-03",
    test: "looks up answer by composite answer_id and question_id (BR-03)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Không đổi question flag",
    input: "PUT hợp lệ",
    condition: "BR-02",
    expected: "KHÔNG Question.findByPk / Question.update",
    type: "Positive",
    fr: "BR-02",
    test: "does not call Question.findByPk or Question.update (BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "answer_text rỗng",
    input: "thiếu / \"\" / whitespace",
    condition: "§4",
    expected: '400 "Answer text is required"; không findOne',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when answer_text is missing answer_text (§4)",
    result: "Pass",
  },
  {
    id: 5,
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
    id: 6,
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
    id: 7,
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
    id: 8,
    feature: "Sai question_id",
    input: "answer_id=10, question_id=99",
    condition: "BR-03",
    expected: '404 "Answer not found"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 404 when answer_id does not belong to question_id in path (BR-03)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Lỗi update",
    input: "answer.update throw",
    condition: "Error",
    expected: "next(error); không res.json",
    type: "Negative",
    fr: "Error",
    test: "calls next when answer.update throws",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Route chưa mount",
    input: "PUT /api/admin/questions/42/answers/10 Bearer admin",
    condition: "GAP-01",
    expected: "404 Express; Answer.findOne không gọi",
    type: "Negative",
    fr: "GAP-01",
    test: "returns 404 for PUT with admin JWT because route is not registered (GAP-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminUpdateAnswer")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_AdminUpdateAnswer.md | server/__tests__/qa/adminUpdateAnswer.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateAnswer.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
