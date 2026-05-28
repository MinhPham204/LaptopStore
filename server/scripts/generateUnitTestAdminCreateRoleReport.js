/**
 * Generates docs/reports/admin/UnitTest_AdminCreateRole.xlsx
 * Usage: node scripts/generateUnitTestAdminCreateRoleReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tạo role (admin)",
    input: "POST role_name + description JWT admin",
    condition: "§4 / AC",
    expected: "201 Role created successfully + role",
    type: "Positive",
    fr: "§4",
    test: "returns 201 Role created successfully with role object for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Tạo role (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "201",
    type: "Positive",
    fr: "§2",
    test: "returns 201 Role created successfully for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Role.create",
    input: "body hợp lệ",
    condition: "§5",
    expected: "Role.create(role_name, description)",
    type: "Positive",
    fr: "§5",
    test: "calls Role.create with role_name and description from body",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Trùng role_name",
    input: "create unique constraint",
    condition: "BR-01",
    expected: "409 Duplicate entry",
    type: "Negative",
    fr: "BR-01",
    test: "returns 409 when Role.create throws SequelizeUniqueConstraintError (duplicate role_name)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Lỗi DB",
    input: "create throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Role.create throws",
    result: "Pass",
  },
  {
    id: 6,
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
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminCreateRole")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminCreateRole.md | server/__tests__/admin/adminCreateRole.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminCreateRole.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
