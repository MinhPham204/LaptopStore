/**
 * Generates docs/reports/admin/UnitTest_AdminListBrands.xlsx
 * Usage: node scripts/generateUnitTestAdminListBrandsReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách brand (admin)",
    input: "GET /api/admin/brands JWT admin",
    condition: "AC §11",
    expected: "200; body.brands array đầy đủ",
    type: "Positive",
    fr: "AC §11",
    test: "returns 200 with brands array for admin (AC §11)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Danh sách brand (manager)",
    input: "GET JWT manager",
    condition: "AC §11",
    expected: "200; brands array",
    type: "Positive",
    fr: "AC §11",
    test: "returns 200 with brands array for manager (AC §11)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Sắp xếp brand_name",
    input: "spy Brand.findAll",
    condition: "BR-02",
    expected: "order: [['brand_name', 'ASC']]",
    type: "Positive",
    fr: "BR-02",
    test: "loads brands ordered by brand_name ASC (BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Danh sách rỗng",
    input: "findAll []",
    condition: "BR-02",
    expected: "200 { brands: [] }",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 with empty brands array when none exist",
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
    test: "returns 401 without bearer token (§4)",
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
    test: "returns 403 for customer role (§4)",
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
    test: "returns 403 for staff role (§4)",
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
    test: "returns 403 when user is inactive (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Lỗi DB",
    input: "Brand.findAll throw",
    condition: "§4",
    expected: "500",
    type: "Negative",
    fr: "§4",
    test: "returns 500 when Brand.findAll throws (§4)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Public catalog brands",
    input: "GET /api/products/brands",
    condition: "catalog/FR_ListBrands",
    expected: "N/A — test riêng listBrands.test.js",
    type: "N/A",
    fr: "FR_ListBrands",
    test: "N/A — catalog GET /products/brands (not admin API)",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminListBrands")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/brand/FR_AdminListBrands.md | server/__tests__/admin/adminListBrands.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminListBrands.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
