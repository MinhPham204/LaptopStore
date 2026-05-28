/**
 * Generates docs/reports/system/UnitTest_RoleBasedAuthorizationMiddleware.xlsx
 * Usage: node scripts/generateUnitTestRoleBasedAuthorizationMiddlewareReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Role admin",
    input: "req.user.Roles [{ role_name: admin }]",
    condition: "BR-03",
    expected: "next()",
    type: "Positive",
    fr: "BR-03",
    test: "calls next when user has admin role",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 2,
    feature: "Role manager",
    input: "req.user.Roles [{ role_name: manager }]",
    condition: "BR-03",
    expected: "next()",
    type: "Positive",
    fr: "BR-03",
    test: "calls next when user has manager role",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 3,
    feature: "OR logic nhiều role",
    input: "customer + admin",
    condition: "BR-03",
    expected: "next() khi có ít nhất một role khớp",
    type: "Positive",
    fr: "BR-03",
    test: "calls next when user has admin and customer roles (OR logic BR-03)",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 4,
    feature: "Thiếu req.user",
    input: "req không có user",
    condition: "BR-05",
    expected: "401 Authentication required; next không gọi",
    type: "Negative",
    fr: "BR-05",
    test: "returns 401 Authentication required when req.user is missing (BR-05)",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 5,
    feature: "Chỉ customer",
    input: "role_name customer",
    condition: "BR-04",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 Insufficient permissions for customer-only role (BR-04)",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 6,
    feature: "Role staff",
    input: "role_name staff",
    condition: "BR-04",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 for staff role not in whitelist",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 7,
    feature: "So khớp case-sensitive",
    input: 'role_name "Admin"',
    condition: "BR-02",
    expected: "403 (không khớp admin)",
    type: "Negative",
    fr: "BR-02",
    test: "returns 403 when role_name casing does not match admin (BR-02)",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 8,
    feature: "Roles rỗng",
    input: "Roles: []",
    condition: "BR-04",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "BR-04",
    test: "returns 403 when user has empty Roles array",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 9,
    feature: "Roles undefined",
    input: "req.user không có Roles",
    condition: "GAP-02",
    expected: "TypeError từ Roles.map",
    type: "Negative",
    fr: "GAP-02",
    test: "throws when req.user.Roles is undefined (GAP-02)",
    result: "Pass",
    layer: "Middleware",
  },
  {
    id: 10,
    feature: "Tích hợp admin routes",
    input: "N/A — cross-ref",
    condition: "§6",
    expected: "supertest adminRoutes + JWT",
    type: "Ref",
    fr: "§6",
    test: "(Ref) See server/__tests__/admin/adminListCategories.test.js for /api/admin route integration",
    result: "Documented",
    layer: "Integration",
  },
  {
    id: 11,
    feature: "401 không JWT",
    input: "N/A — cross-ref",
    condition: "§13 AC",
    expected: "authenticateToken chặn trước authorizeRoles",
    type: "Ref",
    fr: "§13",
    test: "(Ref) See server/__tests__/system/authenticateToken.test.js — 401 without valid Bearer",
    result: "Documented",
    layer: "Middleware",
  },
  {
    id: 12,
    feature: "FE manager paradox",
    input: "N/A — documented",
    condition: "GAP-03",
    expected: "API 200 manager; AdminRoute.jsx chỉ admin",
    type: "Ref",
    fr: "GAP-03",
    test: "(Ref) FR §10 GAP-03 — client AdminRoute checks admin only, not manager",
    result: "Documented",
    layer: "Frontend",
  },
  {
    id: 13,
    feature: "Permission model unused",
    input: "N/A — documented",
    condition: "GAP-01",
    expected: "Chỉ role_name; không role_permissions",
    type: "Ref",
    fr: "GAP-01",
    test: "(Ref) FR §14 GAP-01 — permissions table not wired to authorizeRoles",
    result: "Documented",
    layer: "Middleware",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/system")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_RoleBasedAuth")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/system/FR_RoleBasedAuthorizationMiddleware.md | server/__tests__/system/authorizeRoles.test.js"
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

  const outPath = path.join(outDir, "UnitTest_RoleBasedAuthorizationMiddleware.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
