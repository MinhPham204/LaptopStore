/**
 * Generates docs/report/qa/UnitTest_CreateProductQuestion.xlsx
 * Usage: node scripts/generateUnitTestCreateProductQuestionReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Câu gốc theo product_id",
    input: "POST /api/products/10/questions + question_text",
    condition: "§4, AC",
    expected: "201; Question.create đúng fields; notify staff",
    type: "Positive",
    fr: "§4 / AC",
    test: "returns 201 for root question with numeric product id (§4, AC)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Câu gốc theo slug",
    input: "POST /api/products/acer-swift-3/questions",
    condition: "§5",
    expected: "201; Product.findOne where slug",
    type: "Positive",
    fr: "§5",
    test: "returns 201 for root question with product slug (§5)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Follow-up hợp lệ",
    input: "parent root, same product, parent có answer",
    condition: "§4.2, BR-01, BR-02",
    expected: "201; Answer.findOne; create với parent_question_id",
    type: "Positive",
    fr: "§4.2",
    test: "returns 201 for valid follow-up when parent is root, same product, and has answer (§4.2)",
    result: "Pass",
  },
  {
    id: 4,
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
    id: 5,
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
    id: 6,
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
    id: 7,
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
    id: 8,
    feature: "Parent không tồn tại",
    input: "Question.findByPk null",
    condition: "§4",
    expected: '404 "Parent question not found"',
    type: "Negative",
    fr: "§4",
    test: "returns 404 when parent question is not found (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Chỉ 1 cấp follow-up",
    input: "parent đã là follow-up",
    condition: "BR-01",
    expected: '400 "Only one follow-up level is allowed"',
    type: "Negative",
    fr: "BR-01",
    test: "returns 400 when parent is already a follow-up (BR-01)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Parent sai sản phẩm",
    input: "parent.product_id khác",
    condition: "§4",
    expected: '400 "Parent question does not belong to this product"',
    type: "Negative",
    fr: "§4",
    test: "returns 400 when parent question does not belong to this product (§4)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Parent chưa được trả lời",
    input: "Answer.findOne null",
    condition: "BR-02",
    expected: '400 "Parent must be answered before follow-up"',
    type: "Negative",
    fr: "BR-02",
    test: "returns 400 when parent has no answer yet (BR-02)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Follow-up trùng",
    input: "SequelizeUniqueConstraintError",
    condition: "BR-05",
    expected: '409 "This question already has a follow-up"',
    type: "Negative",
    fr: "BR-05",
    test: "returns 409 when Question.create raises SequelizeUniqueConstraintError (BR-05)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "BR-01, §4",
    expected: "401 Access token required",
    type: "Negative",
    fr: "BR-01 / §4",
    test: "returns 401 without bearer token (BR-01, §4)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/qa")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CreateProductQuestion")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/qa/FR_CreateProductQuestion.md | server/__tests__/qa/createProductQuestion.test.js"
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
    { width: 20 },
    { width: 48 },
    { width: 12 },
    { width: 16 },
    { width: 72 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_CreateProductQuestion.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
