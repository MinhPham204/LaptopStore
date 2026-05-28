/**
 * Generates docs/reports/admin/UnitTest_AdminCreateProductWithImages.xlsx
 * Usage: node scripts/generateUnitTestAdminCreateProductWithImagesReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tạo SP thành công (admin)",
    input: "POST multipart JWT admin",
    condition: "§4 / AC",
    expected: "201 Product created successfully",
    type: "Positive",
    fr: "§4",
    test: "returns 201 Product created successfully for admin",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Tạo SP (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "201",
    type: "Positive",
    fr: "§2",
    test: "returns 201 Product created successfully for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Product.create",
    input: "có thumbnail file",
    condition: "BR-01",
    expected: "is_active true, thumbnail_url",
    type: "Positive",
    fr: "BR-01",
    test: "calls Product.create with is_active true and thumbnail_url when thumbnail file exists",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Variations bulkCreate",
    input: "variations JSON hợp lệ",
    condition: "§5",
    expected: "bulkCreate với product_id",
    type: "Positive",
    fr: "§5",
    test: "calls ProductVariation.bulkCreate with product_id from created product",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Gallery images",
    input: "product_images[]",
    condition: "BR-02",
    expected: "is_primary false, display_order",
    type: "Positive",
    fr: "BR-02",
    test: "calls ProductImage.bulkCreate with is_primary false and display_order for gallery files",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Transaction commit",
    input: "create thành công",
    condition: "BR-05",
    expected: "transaction.commit",
    type: "Positive",
    fr: "BR-05",
    test: "commits transaction on successful create",
    result: "Pass",
  },
  {
    id: 7,
    feature: "JSON variations lỗi",
    input: "variations: not-json",
    condition: "§4",
    expected: "400 Invalid variations data; rollback",
    type: "Negative",
    fr: "§4",
    test: "returns 400 Invalid variations data when variations JSON is invalid",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Không có variation",
    input: "variations: []",
    condition: "§4",
    expected: "400 At least one variation is required",
    type: "Negative",
    fr: "§4",
    test: "returns 400 At least one variation is required when variations array is empty",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Sai số primary",
    input: "0 primary",
    condition: "§4",
    expected: "400 Exactly one variation must be marked as primary",
    type: "Negative",
    fr: "§4",
    test: "returns 400 Exactly one variation must be marked as primary when none or multiple primary",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Hai primary",
    input: "2 is_primary true",
    condition: "§4",
    expected: "400 Exactly one variation must be marked as primary",
    type: "Negative",
    fr: "§4",
    test: "returns 400 when two variations are marked primary",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Thiếu JWT",
    input: "POST không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 12,
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
    id: 13,
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
    id: 14,
    feature: "Lỗi DB",
    input: "Product.create throw",
    condition: "BR-05",
    expected: "rollback + 500",
    type: "Negative",
    fr: "BR-05",
    test: "rolls back transaction and returns 500 when Product.create throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AdminCreateProduct")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/product_and_variation/FR_AdminCreateProductWithImages.md | server/__tests__/admin/adminCreateProductWithImages.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminCreateProductWithImages.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
