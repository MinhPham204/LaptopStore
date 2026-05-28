/**
 * Generates docs/reports/admin/UnitTest_AdminListRoles.xlsx
 * Usage: node scripts/generateUnitTestAdminListRolesReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách roles (admin)",
    input: "GET JWT admin",
    condition: "§4 / AC",
    expected: "200 body.roles array",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with roles array for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Danh sách roles (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200 roles",
    type: "Positive",
    fr: "§2",
    test: "returns 200 with roles array for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Include Users",
    input: "GET hợp lệ",
    condition: "§5",
    expected: "Role.findAll include User through attributes []",
    type: "Positive",
    fr: "§5",
    test: "calls Role.findAll with User include and empty through attributes",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Nested Users trong response",
    input: "mock roles + Users",
    condition: "§4",
    expected: "roles[].Users trong JSON",
    type: "Positive",
    fr: "§4",
    test: "returns roles with nested Users in response",
    result: "Pass",
  },
  {
    id: 5,
    feature: "GAP password_hash lộ",
    input: "Users có password_hash",
    condition: "GAP-03",
    expected: "Response vẫn trả password_hash (BE không exclude)",
    type: "Gap",
    fr: "GAP-03",
    test: "passes through nested Users fields from DB without excluding password_hash (GAP-03)",
    result: "Pass (documented gap)",
  },
  {
    id: 6,
    feature: "Thiếu JWT",
    input: "GET không Authorization",
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
    feature: "User inactive",
    input: "is_active false",
    condition: "§4",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "§4",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Lỗi DB",
    input: "findAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Role.findAll throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminListRoles")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminListRoles.md | server/__tests__/admin/adminListRoles.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminListRoles.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
