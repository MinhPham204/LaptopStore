/**
 * Generates docs/reports/UnitTest_UpdateProfile.xlsx
 * Usage: node scripts/generateUnitTestUpdateProfileReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật profile đầy đủ",
    input: "PUT /api/auth/profile Bearer + 4 field body",
    condition: "User.findByPk active; user.update mock Object.assign",
    expected:
      '200 "Profile updated successfully"; user có user_id/username/email/4 profile fields; KHÔNG có roles',
    type: "Positive",
    fr: "AC1 / BR-04",
    test: "returns 200 with updated user fields and no roles in response",
    result: "Pass",
  },
  {
    id: 2,
    feature: "update() nhận 4 key",
    input: "PUT profile body đủ field",
    condition: "req.user.update",
    expected: "update gọi với full_name, phone_number, address, avatar_url từ body",
    type: "Positive",
    fr: "BR-01",
    test: "calls req.user.update with the four profile keys from request body",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Partial update",
    input: "PUT profile chỉ { full_name }",
    condition: "BR-02 partial",
    expected: "200; full_name mới; update với các field khác undefined",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 when only full_name is sent in body",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Body rỗng",
    input: "PUT profile {}",
    condition: "edge case FR §11",
    expected: "200 Profile updated successfully; update vẫn được gọi",
    type: "Positive",
    fr: "Edge",
    test: "returns 200 when request body is empty",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu Bearer",
    input: "PUT profile không Authorization",
    condition: "authenticateToken",
    expected: "401 Access token required",
    type: "Negative",
    fr: "AC2",
    test: "returns 401 when Authorization header is missing",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Token invalid",
    input: "PUT profile Bearer invalid-jwt",
    condition: "jwt.verify fail",
    expected: "401 Invalid or expired token",
    type: "Negative",
    fr: "AC2",
    test: "returns 401 when token is invalid",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Token expired",
    input: "PUT profile JWT exp=-1s",
    condition: "TokenExpiredError",
    expected: "401 Invalid or expired token",
    type: "Negative",
    fr: "AC2",
    test: "returns 401 when token is expired",
    result: "Pass",
  },
  {
    id: 8,
    feature: "User inactive",
    input: "PUT profile Bearer hợp lệ",
    condition: "is_active=false",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "AC3",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 9,
    feature: "DB update fail",
    input: "PUT profile body hợp lệ",
    condition: "user.update reject",
    expected: "500 qua errorHandler",
    type: "Negative",
    fr: "Edge",
    test: "returns 500 when user.update fails",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Đồng bộ sau GET /me",
    input: "(Không test server)",
    condition: "integration refetch /me",
    expected: "Theo FR: GET /me phản ánh sau update",
    type: "N/A",
    fr: "AC4",
    test: "N/A — integration (GET /me after update)",
    result: "N/A",
  },
  {
    id: 11,
    feature: "FE chưa có UI/API",
    input: "(Không test server)",
    condition: "ProfilePage read-only; no authAPI.updateProfile",
    expected: "Theo FR AC5: gap FE documented",
    type: "N/A",
    fr: "AC5",
    test: "N/A — frontend gap (no ProfilePage form / API wrapper)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateProfile")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/auth/D_FR_UpdateProfile.md | File test: server/__tests__/auth/updateProfile.test.js"
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
    "../../docs/reports/UnitTest_UpdateProfile.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
