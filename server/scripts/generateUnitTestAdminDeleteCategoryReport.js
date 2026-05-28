/**
 * Generates docs/reports/admin/UnitTest_AdminDeleteCategory.xlsx
 * Usage: node scripts/generateUnitTestAdminDeleteCategoryReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa danh mục (admin)",
    input: "DELETE /api/admin/categories/:id JWT admin",
    condition: "countProducts=0",
    expected: "200 Category deleted successfully; destroy called",
    type: "Positive",
    fr: "AC §10",
    test: "returns 200 and calls destroy when countProducts is 0 for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xóa danh mục (manager)",
    input: "DELETE JWT manager",
    condition: "countProducts=0",
    expected: "200; destroy called",
    type: "Positive",
    fr: "AC §10",
    test: "returns 200 and calls destroy when countProducts is 0 for manager",
    result: "Pass",
  },
  {
    id: 3,
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
    id: 4,
    feature: "Còn sản phẩm",
    input: "countProducts=3",
    condition: "BR-02",
    expected: "400 Cannot delete...; destroy NOT called",
    type: "Negative",
    fr: "BR-02",
    test: "returns 400 and does not destroy when countProducts > 0",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu JWT",
    input: "DELETE không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 6,
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
    id: 7,
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
    id: 8,
    feature: "Lỗi DB destroy",
    input: "destroy throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when destroy throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminDeleteCategory")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/category/FR_AdminDeleteCategory.md | server/__tests__/admin/adminDeleteCategory.test.js"
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
    { width: 56 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminDeleteCategory.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
