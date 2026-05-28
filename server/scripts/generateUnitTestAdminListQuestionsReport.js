/**
 * Generates docs/report/qa/UnitTest_AdminListQuestions.xlsx
 * Usage: node scripts/generateUnitTestAdminListQuestionsReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Admin list questions",
    input: "GET /api/admin/questions Bearer admin",
    condition: "§4, AC",
    expected: "200; questions + pagination",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 200 with questions and pagination for admin (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Manager list questions",
    input: "GET ... Bearer manager",
    condition: "BR-02",
    expected: "200; questions + pagination",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 with questions and pagination for manager (BR-02)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Filter answered",
    input: "answered=true",
    condition: "§4",
    expected: "where.is_answered = true",
    type: "Positive",
    fr: "§4",
    test: "filters is_answered true when answered=true (§4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Filter unanswered",
    input: "answered=false",
    condition: "§4",
    expected: "where.is_answered = false",
    type: "Positive",
    fr: "§4",
    test: "filters is_answered false when answered=false (§4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Filter có sản phẩm",
    input: "has_product=true",
    condition: "§4",
    expected: "where.product_id Op.ne null",
    type: "Positive",
    fr: "§4",
    test: "filters product_id Op.ne null when has_product=true (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Filter global Q&A",
    input: "has_product=false",
    condition: "§4",
    expected: "where.product_id = null",
    type: "Positive",
    fr: "§4",
    test: "filters product_id null when has_product=false (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Phân trang",
    input: "page=2&limit=10, count=47",
    condition: "§4",
    expected: "limit 10, offset 10, totalPages 5",
    type: "Positive",
    fr: "§4",
    test: "applies page, limit, offset and computes totalPages (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Sort whitelist",
    input: "sort_by=updated_at&sort_order=ASC",
    condition: "BR-03",
    expected: "order [[updated_at, ASC], [created_at, DESC]]",
    type: "Positive",
    fr: "BR-03",
    test: "uses whitelisted sort_by field in order (BR-03)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Sort fallback field",
    input: "sort_by invalid",
    condition: "BR-03",
    expected: "fallback created_at",
    type: "Positive",
    fr: "BR-03",
    test: "falls back to created_at when sort_by is invalid (BR-03)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Sort order DESC",
    input: "sort_by=question_id&sort_order=desc",
    condition: "§4",
    expected: "order question_id DESC",
    type: "Positive",
    fr: "§4",
    test: "accepts sort_order DESC (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Sort order fallback",
    input: "sort_order=INVALID",
    condition: "BR-03",
    expected: "fallback DESC",
    type: "Positive",
    fr: "BR-03",
    test: "falls back to DESC when sort_order is invalid (BR-03)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Includes",
    input: "GET list default",
    condition: "§5",
    expected: "user, product required:false, answers+user",
    type: "Positive",
    fr: "§5",
    test: "includes user, optional product, answers with user (§5)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Không lọc follow-up",
    input: "answered=true&has_product=true",
    condition: "BR-01",
    expected: "where không có parent_question_id",
    type: "Positive",
    fr: "BR-01",
    test: "does not filter parent_question_id in where clause (BR-01)",
    result: "Pass",
  },
  {
    id: 14,
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
    id: 15,
    feature: "Customer role",
    input: "Bearer customer",
    condition: "§4, BR-02",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4 / BR-02",
    test: "returns 403 for customer role (§4, BR-02)",
    result: "Pass",
  },
  {
    id: 16,
    feature: "Staff role",
    input: "Bearer staff",
    condition: "§4, BR-02",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4 / BR-02",
    test: "returns 403 for staff role (§4, BR-02)",
    result: "Pass",
  },
  {
    id: 17,
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
    id: 18,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "Error",
    expected: "500 message lỗi",
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
  const sheet = workbook.addWorksheet("UnitTest_AdminListQuestions")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_AdminListQuestions.md | server/__tests__/qa/adminListQuestions.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminListQuestions.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
