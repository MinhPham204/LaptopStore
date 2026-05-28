/**
 * Generates docs/report/qa/UnitTest_AdminViewQuestionDetail.xlsx
 * Usage: node scripts/generateUnitTestAdminViewQuestionDetailReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Admin xem chi tiết",
    input: "GET /api/admin/questions/42 Bearer admin",
    condition: "§4, AC",
    expected: "200; body.question đầy đủ",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with question body for admin (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Manager xem chi tiết",
    input: "GET ... Bearer manager",
    condition: "BR-02",
    expected: "200; body.question",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 with question body for manager (BR-02)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Include findByPk",
    input: "GET detail",
    condition: "§5, BR-02, BR-03",
    expected: "user+email, product, answers+user ASC; không children",
    type: "Positive",
    fr: "§5 / BR-02 / BR-03",
    test: "loads question with user (email), product, answers+user ordered ASC and no children include (§5, BR-02, BR-03)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Global Q&A",
    input: "product_id null, product null",
    condition: "BR-01",
    expected: "200; question.product null",
    type: "Positive",
    fr: "BR-01",
    test: "returns 200 for global question with product null (BR-01)",
    result: "Pass",
  },
  {
    id: 5,
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
    id: 6,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "§4",
    expected: "401 Access token required",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Customer role",
    input: "Bearer customer",
    condition: "§4",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for customer role (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Staff role",
    input: "Bearer staff",
    condition: "§4",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for staff role (§4)",
    result: "Pass",
  },
  {
    id: 9,
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
    id: 10,
    feature: "Lỗi DB",
    input: "findByPk throw",
    condition: "Error",
    expected: "500 message lỗi",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Question.findByPk throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminViewQuestionDetail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_AdminViewQuestionDetail.md | server/__tests__/qa/adminViewQuestionDetail.test.js"
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
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 20 },
    { width: 72 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminViewQuestionDetail.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
