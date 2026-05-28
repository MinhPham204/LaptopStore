/**
 * Generates docs/reports/admin/UnitTest_AdminListCategories.xlsx
 * Usage: node scripts/generateUnitTestAdminListCategoriesReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách danh mục (admin)",
    input: "GET /api/admin/categories JWT admin",
    condition: "§4",
    expected: "200; body.categories array",
    type: "Positive",
    fr: "§4",
    test: "returns 200 with categories array for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Danh sách danh mục (manager)",
    input: "GET JWT manager",
    condition: "§2",
    expected: "200; categories array",
    type: "Positive",
    fr: "§2",
    test: "returns 200 with categories array for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Sắp xếp display_order",
    input: "spy Category.findAll",
    condition: "§5",
    expected: "order: [['display_order', 'ASC']]",
    type: "Positive",
    fr: "§5",
    test: "loads categories ordered by display_order ASC",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Danh sách rỗng",
    input: "findAll []",
    condition: "§3",
    expected: "200 { categories: [] }",
    type: "Positive",
    fr: "§3",
    test: "returns 200 with empty categories array when none exist",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu JWT",
    input: "GET không Authorization",
    condition: "§4",
    expected: "401 Access token required",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Role customer",
    input: "JWT customer",
    condition: "§4",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for customer role",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Role staff",
    input: "JWT staff",
    condition: "§4",
    expected: "403 Insufficient permissions",
    type: "Negative",
    fr: "§4",
    test: "returns 403 for staff role",
    result: "Pass",
  },
  {
    id: 8,
    feature: "User inactive",
    input: "JWT admin is_active=false",
    condition: "§4",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "§4",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Lỗi DB",
    input: "Category.findAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Category.findAll throws",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Public catalog categories",
    input: "GET /api/products/categories",
    condition: "FR catalog",
    expected: "N/A — test riêng public route",
    type: "N/A",
    fr: "§1 public",
    test: "N/A — not GET /products/categories (catalog FR)",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminListCategories")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/category/FR_AdminListCategories.md | server/__tests__/admin/adminListCategories.test.js"
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
    { width: 56 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_AdminListCategories.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
