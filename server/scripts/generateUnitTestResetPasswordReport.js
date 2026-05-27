/**
 * Generates docs/reports/UnitTest_ResetPassword.xlsx
 * Usage: node scripts/generateUnitTestResetPasswordReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Đặt mật khẩu mới thành công",
    input: "POST /api/auth/reset-password { token, password }",
    condition: "JWT password_reset hợp lệ; User.findByPk trả user; update mock",
    expected:
      '200 "Password updated successfully"; user.update({ password_hash }); response không có token',
    type: "Positive",
    fr: "AC1 / AC6 / BR-02 / BR-03",
    test: "returns 200 and updates password_hash when token and password are valid",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Sai purpose token",
    input: "POST body token purpose=email_verify",
    condition: "BR-01 purpose only password_reset",
    expected: '400 { message: "Invalid token" }; findByPk không gọi',
    type: "Positive",
    fr: "BR-01",
    test: "returns 400 Invalid token when purpose is email_verify",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thiếu token",
    input: "POST chỉ có password",
    condition: "resetPasswordValidation",
    expected: "400 errors[] Token is required",
    type: "Negative",
    fr: "AC4",
    test: "returns 400 with errors when token is missing",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Password quá ngắn",
    input: "POST password=12345",
    condition: "validator min 6",
    expected: "400 errors[] Password must be at least 6 characters",
    type: "Negative",
    fr: "AC4",
    test: "returns 400 with errors when password is too short",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Token hết hạn",
    input: "POST token JWT exp=-1s",
    condition: "jwt.verify fail",
    expected: '400 "Invalid or expired token"',
    type: "Negative",
    fr: "AC2",
    test: "returns 400 Invalid or expired token when JWT is expired",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Token sai secret",
    input: "POST token ký bằng secret khác",
    condition: "jwt.verify fail",
    expected: '400 "Invalid or expired token"',
    type: "Negative",
    fr: "AC2",
    test: "returns 400 Invalid or expired token when JWT secret does not match",
    result: "Pass",
  },
  {
    id: 7,
    feature: "User không tồn tại",
    input: "POST token hợp lệ",
    condition: "User.findByPk null",
    expected: '404 { message: "User not found" }',
    type: "Negative",
    fr: "AC3",
    test: "returns 404 when user is not found",
    result: "Pass",
  },
  {
    id: 8,
    feature: "FE validation confirm password",
    input: "(Không test server)",
    condition: "LoginPage.jsx client",
    expected: "Theo FR AC5: min 6, confirm match, token query",
    type: "N/A",
    fr: "AC5",
    test: "N/A — frontend only (LoginPage reset validation)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ResetPassword")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/auth/D_FR_ResetPassword.md | File test: server/__tests__/auth/resetPassword.test.js"
  sheet.getCell("A1").font = { bold: true }

  const headers = [
    "ID",
    "Tính năng",
    "Đầu vào",
    "Điều kiện kiểm thử",
    "Kết quả mong đợi",
    "Loại",
    "Mã FR",
    "Tên test Jest",
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
    { width: 32 },
    { width: 48 },
    { width: 12 },
    { width: 22 },
    { width: 52 },
    { width: 14 },
  ]

  const outPath = path.join(__dirname, "../../docs/reports/UnitTest_ResetPassword.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
