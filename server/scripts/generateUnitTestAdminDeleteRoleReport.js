/**
 * Generates docs/reports/admin/UnitTest_AdminDeleteRole.xlsx
 * Usage: node scripts/generateUnitTestAdminDeleteRoleReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa role (admin)",
    input: "DELETE JWT admin, countUsers=0",
    condition: "§4 / AC",
    expected: "200 Role deleted successfully; destroy",
    type: "Positive",
    fr: "§4",
    test: "returns 200 Role deleted successfully and calls destroy when countUsers is 0 for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xóa role (manager)",
    input: "JWT manager, countUsers=0",
    condition: "§2",
    expected: "200; destroy",
    type: "Positive",
    fr: "§2",
    test: "returns 200 Role deleted successfully for manager when countUsers is 0",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Role không tồn tại",
    input: "findByPk null",
    condition: "§4",
    expected: "404 Role not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when role is not found",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Role còn user",
    input: "countUsers > 0",
    condition: "§5 / BR-01",
    expected: "400; destroy NOT called",
    type: "Negative",
    fr: "BR-01",
    test: "returns 400 Cannot delete role with assigned users when countUsers > 0",
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
    test: "returns 500 when role.destroy throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminDeleteRole")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminDeleteRole.md | server/__tests__/admin/adminDeleteRole.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminDeleteRole.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
