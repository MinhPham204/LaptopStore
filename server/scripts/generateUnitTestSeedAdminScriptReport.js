/**
 * Generates docs/reports/system/UnitTest_SeedAdminScript.xlsx
 * Usage: node scripts/generateUnitTestSeedAdminScriptReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Load dotenv",
    input: "require seedAdmin",
    condition: "BR-04",
    expected: 'dotenv.config({ path: "./.env" })',
    type: "Positive",
    fr: "BR-04",
    test: "loads dotenv from ./.env (BR-04)",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 2,
    feature: "Kết nối DB",
    input: "sequelize.authenticate",
    condition: "§5 step 1",
    expected: "authenticate được gọi",
    type: "Positive",
    fr: "§5",
    test: "calls sequelize.authenticate on startup",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 3,
    feature: "Tạo role admin",
    input: "Role.findOne null",
    condition: "§5 step 2",
    expected: "Role.create admin + description",
    type: "Positive",
    fr: "§5",
    test: "creates admin role when missing",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 4,
    feature: "Role admin đã có",
    input: "findOne trả role",
    condition: "§5 step 2",
    expected: "không Role.create",
    type: "Positive",
    fr: "§5",
    test: "skips Role.create when admin role already exists",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 5,
    feature: "Tạo user admin mới",
    input: "email chưa tồn tại",
    condition: "BR-08 BR-09",
    expected: "User.create constants; addRole(adminRole)",
    type: "Positive",
    fr: "BR-08",
    test: "creates new admin user with constants and calls addRole",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 6,
    feature: "User đã tồn tại",
    input: "findOne theo ADMIN_EMAIL",
    condition: "BR-06 BR-07",
    expected: "setRoles([adminRole]); không User.create",
    type: "Positive",
    fr: "BR-06",
    test: "re-assigns admin role for existing user by email without User.create",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 7,
    feature: "Đóng connection",
    input: "finally block",
    condition: "§8",
    expected: "sequelize.close + log closed",
    type: "Positive",
    fr: "§8",
    test: "always calls sequelize.close in finally after successful run",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 8,
    feature: "Authenticate thất bại",
    input: "authenticate reject",
    condition: "§5 / §8",
    expected: "authenticate ngoài try → close không gọi",
    type: "Negative",
    fr: "§8",
    test: "when authenticate fails before try, sequelize.close is not reached (same structure as seedAdmin.js)",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 9,
    feature: "User.create lỗi",
    input: "User.create throw",
    condition: "BR-11",
    expected: "console.error message; close trong finally",
    type: "Negative",
    fr: "BR-11",
    test: "logs error and still calls sequelize.close when User.create throws",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 10,
    feature: "setRoles lỗi",
    input: "setRoles throw",
    condition: "BR-11",
    expected: "console.error; close trong finally",
    type: "Negative",
    fr: "BR-11",
    test: "logs error and still calls sequelize.close when setRoles throws",
    result: "Pass",
    layer: "Script",
  },
  {
    id: 11,
    feature: "Hardcoded credentials",
    input: "N/A — documented",
    condition: "GAP-01",
    expected: "ADMIN_PASSWORD plaintext trong source",
    type: "Ref",
    fr: "GAP-01",
    test: "(Ref) FR §13 GAP-01 — credentials hardcoded in seedAdmin.js",
    result: "Documented",
    layer: "Security",
  },
  {
    id: 12,
    feature: "Exit code không báo lỗi",
    input: "N/A — documented",
    condition: "GAP-04",
    expected: "catch không process.exit(1)",
    type: "Ref",
    fr: "GAP-04",
    test: "(Ref) FR §13 GAP-04 — script exit 0 even on seed failure",
    result: "Documented",
    layer: "Script",
  },
  {
    id: 13,
    feature: "Bcrypt hook User model",
    input: "N/A — cross-ref",
    condition: "BR-08",
    expected: "password_hash plaintext → beforeCreate hash",
    type: "Ref",
    fr: "BR-08",
    test: "(Ref) FR §5 BR-08 — bcrypt hashing in server/models/User.js beforeCreate hook (not unit-tested here)",
    result: "Documented",
    layer: "Model",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/system")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_SeedAdmin")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/system/FR_SeedAdminScript.md | server/__tests__/system/seedAdmin.test.js"
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
    "Layer",
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
      r.layer,
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
    { width: 16 },
  ]

  const outPath = path.join(outDir, "UnitTest_SeedAdminScript.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
