/**
 * Generates docs/reports/UnitTest_ResetPasswordVerifyRedirect.xlsx
 * Usage: node scripts/generateUnitTestResetPasswordVerifyRedirectReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Verify reset token thành công",
    input: "GET /api/auth/reset-password/verify?token=password_reset JWT",
    condition: "FRONTEND_URL=localhost:3000; không gọi DB",
    expected:
      "302 /login?mode=reset&token=... (cùng JWT); jwt.decode purpose=password_reset; User.findByPk không gọi",
    type: "Positive",
    fr: "AC1 / BR-02",
    test: "redirects to login reset mode with token when password_reset JWT is valid",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Thiếu token query",
    input: "GET /reset-password/verify không token",
    condition: "query rỗng",
    expected: "302 /login?mode=reset&error=missing",
    type: "Negative",
    fr: "AC3",
    test: "redirects to login with error=missing when token is absent",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Token hết hạn",
    input: "GET verify token exp=-1s",
    condition: "jwt.verify fail",
    expected: "302 /login?mode=reset&error=invalid",
    type: "Negative",
    fr: "AC2",
    test: "redirects to login with error=invalid when token is expired",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Token malformed",
    input: "GET verify token=not-a-jwt",
    condition: "jwt.verify fail",
    expected: "302 error=invalid",
    type: "Negative",
    fr: "AC2",
    test: "redirects to login with error=invalid when token is malformed",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Sai purpose email_verify",
    input: "GET verify token purpose=email_verify",
    condition: "decoded.purpose !== password_reset",
    expected: "302 error=invalid",
    type: "Negative",
    fr: "AC7",
    test: "redirects to login with error=invalid when purpose is email_verify",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Session JWT không purpose",
    input: "GET verify session JWT { userId }",
    condition: "thiếu purpose",
    expected: "302 error=invalid",
    type: "Negative",
    fr: "AC7",
    test: "redirects to login with error=invalid when token is a session JWT without purpose",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Không thay đổi DB",
    input: "GET verify các outcome (missing/valid/invalid)",
    condition: "BR-01 validate only",
    expected: "User.findByPk không được gọi trong mọi case",
    type: "Positive",
    fr: "AC4 / BR-01",
    test: "never calls User.findByPk on any verify redirect outcome",
    result: "Pass",
  },
  {
    id: 8,
    feature: "FE submit POST reset-password",
    input: "(Không test server GET)",
    condition: "E2E LoginPage + POST /reset-password",
    expected: "Theo FR AC5: POST 200 → login?reset=success",
    type: "N/A",
    fr: "AC5",
    test: "N/A — E2E (POST reset-password + FE flow)",
    result: "N/A",
  },
  {
    id: 9,
    feature: "Login password mới sau reset",
    input: "(Không test server GET)",
    condition: "E2E login",
    expected: "Theo FR AC6: password mới login OK; cũ fail",
    type: "N/A",
    fr: "AC6",
    test: "N/A — E2E (login after full reset flow)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ResetPwdVerify")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/auth/D_FR_ResetPasswordVerifyRedirect.md | File test: server/__tests__/auth/resetPasswordVerifyRedirect.test.js"
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
    { width: 18 },
    { width: 52 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ResetPasswordVerifyRedirect.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
