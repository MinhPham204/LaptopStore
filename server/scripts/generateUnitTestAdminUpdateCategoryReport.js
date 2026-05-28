/**
 * Generates docs/reports/admin/UnitTest_AdminUpdateCategory.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateCategoryReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật danh mục (admin)",
    input: "PUT multipart admin JWT",
    condition: "§4",
    expected: "200 Category updated successfully",
    type: "Positive",
    fr: "§4",
    test: "returns 200 Category updated successfully for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Cập nhật (manager)",
    input: "PUT JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 for manager role",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Chỉ description/display_order",
    input: "category_name không đổi",
    condition: "BR-01",
    expected: "slug/name không trong updateData",
    type: "Positive",
    fr: "BR-01",
    test: "keeps slug and category_name unchanged when only description and display_order change (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Đổi category_name",
    input: "Gaming Pro",
    condition: "§5",
    expected: "slug mới; findOne exclude self category_id",
    type: "Positive",
    fr: "§5",
    test: "updates slug and checks findOne excluding current category_id when name changes",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Upload icon",
    input: "req.files.thumbnail",
    condition: "§5",
    expected: "icon_url trong updateData",
    type: "Positive",
    fr: "§5",
    test: "sets icon_url when req.files.thumbnail is present",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Không upload icon",
    input: "không thumbnail",
    condition: "BR-03",
    expected: "icon_url không trong update",
    type: "Positive",
    fr: "BR-03",
    test: "does not include icon_url in update when thumbnail is not uploaded (BR-03)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Category không tồn tại",
    input: "findByPk null",
    condition: "§4",
    expected: "404 Category not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when category is not found",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Slug trùng",
    input: "findOne conflict",
    condition: "§4",
    expected: "400 Slug already exists...",
    type: "Negative",
    fr: "§4",
    test: "returns 400 when slug conflicts with another category",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Thiếu JWT",
    input: "PUT không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 10,
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
    id: 11,
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
    id: 12,
    feature: "Lỗi DB update",
    input: "category.update throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when category.update throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminUpdateCategory")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/category/FR_AdminUpdateCategory.md | server/__tests__/admin/adminUpdateCategory.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateCategory.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
