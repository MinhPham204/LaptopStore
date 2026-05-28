/**
 * Generates docs/reports/admin/UnitTest_AdminUpdateUserActiveStatus.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateUserActiveStatusReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Khóa user (admin)",
    input: "PUT is_active false JWT admin",
    condition: "§4 / AC",
    expected: "200; user.update({ is_active: false })",
    type: "Positive",
    fr: "§4",
    test: "returns 200 and deactivates user for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Khóa user (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 and deactivates user for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Kích hoạt user",
    input: "PUT is_active true",
    condition: "§4 / AC",
    expected: "200; update true",
    type: "Positive",
    fr: "§4",
    test: "returns 200 and activates user when is_active is true",
    result: "Pass",
  },
  {
    id: 4,
    feature: "GAP password_hash trong response",
    input: "user instance có password_hash",
    condition: "GAP-01",
    expected: "JSON user vẫn có password_hash",
    type: "Gap",
    fr: "GAP-01",
    test: "returns user object that may include password_hash from instance (GAP-01)",
    result: "Pass (documented gap)",
  },
  {
    id: 5,
    feature: "User không tồn tại",
    input: "findByPk target null",
    condition: "§4",
    expected: "404 User not found",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when target user is not found",
    result: "Pass",
  },
  {
    id: 6,
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
    feature: "Caller inactive",
    input: "admin is_active false",
    condition: "§4 / BR-03",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "BR-03",
    test: "returns 403 when caller is inactive",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Lỗi DB update",
    input: "user.update throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when user.update throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateUserStatus")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminUpdateUserActiveStatus.md | server/__tests__/admin/adminUpdateUserActiveStatus.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateUserActiveStatus.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
