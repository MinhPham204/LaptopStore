/**
 * Generates docs/reports/admin/UnitTest_AdminCreateCategory.xlsx
 * Usage: node scripts/generateUnitTestAdminCreateCategoryReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tạo danh mục thành công",
    input: "POST multipart admin JWT",
    condition: "AC §10",
    expected: "201 Category created successfully; category object",
    type: "Positive",
    fr: "AC §10",
    test: "returns 201 Category created successfully for admin (§10)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Manager được tạo",
    input: "POST JWT manager",
    condition: "§4 auth",
    expected: "201",
    type: "Positive",
    fr: "§4",
    test: "returns 201 for manager role",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Kiểm tra slug trước create",
    input: "category_name Office Laptops",
    condition: "BR-01",
    expected: "Category.findOne({ where: { slug } }) trước create",
    type: "Positive",
    fr: "BR-01",
    test: "checks slug uniqueness with Category.findOne before create (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Payload create mặc định",
    input: "không display_order, không file",
    condition: "§5",
    expected: "slug generated; display_order 0; icon_url null",
    type: "Positive",
    fr: "§5",
    test: "creates category with slug, description, display_order default 0 and icon_url null when no file",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Upload icon",
    input: "req.files.thumbnail",
    condition: "§5",
    expected: "icon_url = file path",
    type: "Positive",
    fr: "§5",
    test: "sets icon_url from req.files.thumbnail when file is uploaded",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Slug trùng",
    input: "findOne trả existing",
    condition: "§4",
    expected: "400 Slug already exists...",
    type: "Negative",
    fr: "§4",
    test: "returns 400 when slug already exists (Category.findOne returns existing)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "UNIQUE DB",
    input: "Category.create unique error",
    condition: "§4",
    expected: "409 Duplicate entry",
    type: "Negative",
    fr: "§4",
    test: "returns 409 when Category.create throws SequelizeUniqueConstraintError",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu JWT",
    input: "POST không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Role customer",
    input: "JWT customer",
    condition: "§4",
    expected: "403",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for customer role",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Role staff",
    input: "JWT staff",
    condition: "§4",
    expected: "403",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for staff role",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Lỗi DB",
    input: "Category.create throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Category.create throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminCreateCategory")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/category/FR_AdminCreateCategory.md | server/__tests__/admin/adminCreateCategory.test.js"
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
    { width: 36 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminCreateCategory.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
