/**
 * Generates docs/reports/system/UnitTest_JWTAuthenticationMiddleware.xlsx
 * Usage: node scripts/generateUnitTestJWTAuthenticationMiddlewareReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "JWT hợp lệ",
    input: "Authorization Bearer session token",
    condition: "§5 / AC",
    expected: "next(); req.user, req.userId, req.userRoles",
    type: "Positive",
    fr: "§5",
    test: "calls next and sets req.user, req.userId, req.userRoles for valid Bearer token",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 2,
    feature: "Nhiều roles",
    input: "User.Roles customer + admin",
    condition: "BR-05 payload",
    expected: "req.userRoles array",
    type: "Positive",
    fr: "§5",
    test: "maps multiple Roles to req.userRoles array",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 3,
    feature: "User.findByPk query",
    input: "decoded.userId",
    condition: "§5",
    expected: "include Role; exclude password_hash",
    type: "Positive",
    fr: "§5",
    test: "loads user with Role include and excludes password_hash from query",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 4,
    feature: "Thiếu Authorization",
    input: "no header",
    condition: "BR-02",
    expected: "401 Access token required; next not called",
    type: "Negative",
    fr: "BR-02",
    test: "returns 401 Access token required when Authorization header is missing",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 5,
    feature: "Bearer rỗng",
    input: "Authorization: Bearer",
    condition: "BR-02",
    expected: "401; next not called",
    type: "Negative",
    fr: "BR-02",
    test: "returns 401 when Bearer token part is empty",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 6,
    feature: "JWT malformed",
    input: "Bearer not-a-valid-jwt",
    condition: "BR-03",
    expected: "401 Invalid or expired token",
    type: "Negative",
    fr: "BR-03",
    test: "returns 401 Invalid or expired token for malformed JWT",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 7,
    feature: "JWT hết hạn",
    input: "expiresIn -1s",
    condition: "BR-03",
    expected: "401",
    type: "Negative",
    fr: "BR-03",
    test: "returns 401 for expired JWT",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 8,
    feature: "Sai JWT_SECRET",
    input: "sign wrong secret",
    condition: "BR-03",
    expected: "401",
    type: "Negative",
    fr: "BR-03",
    test: "returns 401 when JWT signed with wrong secret",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 9,
    feature: "User không tồn tại",
    input: "findByPk null",
    condition: "BR-04",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 User not found or inactive when user is null",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 10,
    feature: "User inactive",
    input: "is_active false",
    condition: "BR-04",
    expected: "403; next not called",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 when user is_active is false",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 11,
    feature: "Route /me integration",
    input: "N/A — cross-ref",
    condition: "§11",
    expected: "GET /api/auth/me dùng authenticateToken",
    type: "Ref",
    fr: "§11",
    test: "(Ref) See server/__tests__/auth/getCurrentUser.test.js for /me route coverage",
    result: "Documented",
    layer: "Integration",
  },
  {
    id: 12,
    feature: "Purpose JWT không bị chặn",
    input: "N/A — documented",
    condition: "GAP-01",
    expected: "purpose token có thể verify nếu client gửi nhầm",
    type: "Ref",
    fr: "GAP-01",
    test: "(Ref) FR §13 GAP-01 — no purpose claim check on session middleware",
    result: "Documented",
    layer: "Middleware",
  },
  {
    id: 13,
    feature: "authorizeRoles tách FR",
    input: "N/A — cross-ref",
    condition: "§3 Out of Scope",
    expected: "Phân quyền role: FR_RoleBasedAuthorizationMiddleware",
    type: "Ref",
    fr: "§10",
    test: "(Ref) authorizeRoles tested separately — FR_RoleBasedAuthorizationMiddleware.md",
    result: "Documented",
    layer: "Middleware",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/system")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_JWTAuthMiddleware")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/system/FR_JWTAuthenticationMiddleware.md | server/__tests__/system/authenticateToken.test.js"
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

  const outPath = path.join(outDir, "UnitTest_JWTAuthenticationMiddleware.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
