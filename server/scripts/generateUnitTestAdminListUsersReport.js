/**
 * Generates docs/reports/admin/UnitTest_AdminListUsers.xlsx
 * Usage: node scripts/generateUnitTestAdminListUsersReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách users (admin)",
    input: "GET JWT admin",
    condition: "§4 / AC",
    expected: "200 users + pagination",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with users and pagination for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Danh sách users (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 with users and pagination for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Exclude password + Roles",
    input: "GET hợp lệ",
    condition: "§5 / AC",
    expected: "exclude password_hash; include Role",
    type: "Positive",
    fr: "§5",
    test: "calls User.findAndCountAll excluding password_hash and including Roles",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Pagination",
    input: "page=2&limit=10",
    condition: "§4",
    expected: "offset, totalPages đúng",
    type: "Positive",
    fr: "§4",
    test: "applies page, limit, offset and computes totalPages",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Sort whitelist",
    input: "sort user_id|username|created_at|last_login|email",
    condition: "BR-03",
    expected: "order theo field hợp lệ",
    type: "Positive",
    fr: "BR-03",
    test: "sorts by whitelisted field %s",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sort invalid",
    input: "sort=password_hash",
    condition: "BR-03",
    expected: "fallback created_at",
    type: "Positive",
    fr: "BR-03",
    test: "falls back to created_at when sort is not in whitelist",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Order ASC",
    input: "order=asc",
    condition: "§4",
    expected: "ASC",
    type: "Positive",
    fr: "§4",
    test: "uses ASC order when order=asc",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Order DESC",
    input: "order=DESC",
    condition: "§4",
    expected: "DESC",
    type: "Positive",
    fr: "§4",
    test: "uses DESC order when order=DESC",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Order invalid",
    input: "order=invalid",
    condition: "§4",
    expected: "fallback DESC",
    type: "Positive",
    fr: "§4",
    test: "falls back to DESC when order is invalid",
    result: "Pass",
  },
  {
    id: 10,
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
    id: 11,
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
    id: 12,
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
    id: 13,
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
    id: 14,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when User.findAndCountAll throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminListUsers")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/user_and_role/FR_AdminListUsers.md | server/__tests__/admin/adminListUsers.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminListUsers.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
