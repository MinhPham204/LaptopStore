/**
 * Generates docs/reports/UnitTest_VerifyEmail.xlsx (run after Jest pass).
 * Usage: node scripts/generateUnitTestVerifyEmailReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xác minh email thành công",
    input: "GET /api/auth/verify-email?token=email_verify JWT",
    condition: "User.findByPk inactive; FRONTEND_URL=localhost:3000",
    expected:
      "302 /oauth/success?token=sessionJwt; user.update({ is_active: true }); session JWT { userId: 42 }",
    type: "Positive",
    fr: "AC1 / AC2 / BR-01",
    test: "redirects to oauth success and activates inactive user on valid email_verify token",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Verify idempotent — user đã active",
    input: "GET verify-email token hợp lệ",
    condition: "user.is_active=true",
    expected: "302 oauth/success; user.update KHÔNG gọi",
    type: "Positive",
    fr: "BR-02",
    test: "redirects to oauth success without update when user is already active",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thiếu token query",
    input: "GET /verify-email không có token",
    condition: "query token rỗng",
    expected: "302 /login?verify=missing",
    type: "Negative",
    fr: "AC3",
    test: "redirects to login with verify=missing when token is absent",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Token hết hạn",
    input: "GET verify-email token exp=-1s",
    condition: "jwt.verify fail",
    expected: "302 /login?verify=invalid",
    type: "Negative",
    fr: "AC3",
    test: "redirects to login with verify=invalid when token is expired",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Token malformed",
    input: "GET verify-email token=not-a-jwt",
    condition: "jwt.verify fail",
    expected: "302 /login?verify=invalid",
    type: "Negative",
    fr: "AC3",
    test: "redirects to login with verify=invalid when token is malformed",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sai purpose token",
    input: "GET verify-email purpose=password_reset",
    condition: "decoded.purpose !== email_verify",
    expected: "302 /login?verify=invalid",
    type: "Negative",
    fr: "§12",
    test: "redirects to login with verify=invalid when purpose is not email_verify",
    result: "Pass",
  },
  {
    id: 7,
    feature: "User không tồn tại",
    input: "GET verify-email token hợp lệ",
    condition: "User.findByPk null",
    expected: "302 /login?verify=notfound",
    type: "Negative",
    fr: "AC4",
    test: "redirects to login with verify=notfound when user does not exist",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Lỗi DB",
    input: "GET verify-email token hợp lệ",
    condition: "User.findByPk reject",
    expected: "302 /login?verify=error",
    type: "Negative",
    fr: "Edge",
    test: "redirects to login with verify=error when database lookup throws",
    result: "Pass",
  },
  {
    id: 9,
    feature: "GET /auth/me sau verify",
    input: "(Không test server)",
    condition: "OAuthSuccess + useMe",
    expected: "Theo FR: user roles từ DB sau session",
    type: "N/A",
    fr: "AC5",
    test: "N/A — integration / frontend (GET /auth/me after verify)",
    result: "N/A",
  },
  {
    id: 10,
    feature: "pendingCheckout sau verify",
    input: "(Không test server)",
    condition: "OAuthSuccess.jsx",
    expected: "Theo FR: redirect checkout nếu có pendingCheckout",
    type: "N/A",
    fr: "AC6",
    test: "N/A — frontend only (OAuthSuccess pendingCheckout)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_VerifyEmail")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/auth/FR_VerifyEmail.md | File test: server/__tests__/auth/verifyEmail.test.js"
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
    "../../docs/reports/UnitTest_VerifyEmail.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
