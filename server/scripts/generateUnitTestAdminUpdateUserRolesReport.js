/**
 * Generates docs/reports/admin/UnitTest_AdminUpdateUserRoles.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateUserRolesReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Gán roles (admin)",
    input: "PUT role_ids JWT admin",
    condition: "§4 / AC",
    expected: "200; user.roles array",
    type: "Positive",
    fr: "§4",
    test: "returns 200 User roles updated successfully with roles array for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Gán roles (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 User roles updated successfully for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Replace roles",
    input: "role_ids [2,4]",
    condition: "BR-01",
    expected: "findAll + setRoles replace",
    type: "Positive",
    fr: "BR-01",
    test: "calls Role.findAll with role_ids and setRoles replaces all roles (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Gỡ hết roles",
    input: "role_ids []",
    condition: "BR-03",
    expected: "setRoles([])",
    type: "Positive",
    fr: "BR-03",
    test: "calls setRoles with empty array when role_ids is empty",
    result: "Pass",
  },
  {
    id: 5,
    feature: "role_id không hợp lệ",
    input: "role_ids [2, 999]",
    condition: "BR-02",
    expected: "chỉ set roles tìm được",
    type: "Positive",
    fr: "BR-02",
    test: "sets only roles found in DB when role_ids contains invalid ids (BR-02)",
    result: "Pass",
  },
  {
    id: 6,
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
    id: 7,
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
    id: 8,
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
    id: 9,
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
    id: 10,
    feature: "Caller inactive",
    input: "admin is_active false",
    condition: "§4",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "§4",
    test: "returns 403 when caller is inactive",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Lỗi setRoles",
    input: "setRoles throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when setRoles throws",
    result: "Pass",
  },
  {
    id: 12,
    feature: "FE sai path",
    input: "PUT /users/5/role",
    condition: "GAP-02",
    expected: "404 route không tồn tại",
    type: "Negative",
    fr: "GAP-02",
    test: "returns 404 for FE wrong path PUT /users/:user_id/role (GAP-02)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateUserRoles")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminUpdateUserRoles.md | server/__tests__/admin/adminUpdateUserRoles.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateUserRoles.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
