/**
 * Generates docs/reports/admin/UnitTest_AdminDeleteProduct.xlsx
 * Usage: node scripts/generateUnitTestAdminDeleteProductReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa SP (admin)",
    input: "DELETE JWT admin",
    condition: "§4 / AC",
    expected: "200 Product deleted successfully",
    type: "Positive",
    fr: "§4",
    test: "returns 200 Product deleted successfully for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xóa SP (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 Product deleted successfully for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Soft delete",
    input: "DELETE hợp lệ",
    condition: "BR-01 / §5",
    expected: "update is_active false; không destroy",
    type: "Positive",
    fr: "BR-01",
    test: "soft-deletes via product.update({ is_active: false }) and does not destroy (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Idempotent",
    input: "DELETE lần 2 cùng product",
    condition: "BR-05",
    expected: "vẫn 200 nếu row còn",
    type: "Positive",
    fr: "BR-05",
    test: "returns 200 on second DELETE when product row still exists (BR-05 idempotent)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Product không tồn tại",
    input: "findByPk null",
    condition: "§4",
    expected: "404 Product not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when product is not found",
    result: "Pass",
  },
  {
    id: 6,
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
    id: 7,
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
    id: 8,
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
    id: 9,
    feature: "Lỗi DB update",
    input: "product.update throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when product.update throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminDeleteProduct")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/product_and_variation/FR_AdminDeleteProduct.md | server/__tests__/admin/adminDeleteProduct.test.js"
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
    { width: 62 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminDeleteProduct.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
