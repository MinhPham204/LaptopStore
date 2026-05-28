/**
 * Generates docs/reports/admin/UnitTest_AdminUpdateProductWithVariations.xlsx
 * Usage: node scripts/generateUnitTestAdminUpdateProductWithVariationsReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật SP thành công",
    input: "PUT multipart JWT admin",
    condition: "§4 / AC",
    expected: "200 + product variations/images",
    type: "Positive",
    fr: "§4",
    test: "returns 200 Product updated successfully with product including variations and images",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Cập nhật SP (manager)",
    input: "JWT manager",
    condition: "§2",
    expected: "200",
    type: "Positive",
    fr: "§2",
    test: "returns 200 Product updated successfully for manager",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Đồng bộ variations",
    input: "update + create + delete diff",
    condition: "§5",
    expected: "update/bulkCreate/destroy",
    type: "Positive",
    fr: "§5",
    test: "syncs variations: update existing, create new, delete removed",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Xóa ảnh gallery",
    input: "deleted_image_ids",
    condition: "§5",
    expected: "ProductImage.destroy",
    type: "Positive",
    fr: "§5",
    test: "destroys product images when deleted_image_ids is provided",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Upload ảnh mới",
    input: "thumbnail + product_images",
    condition: "BR-05/BR-06",
    expected: "thumbnail_url + bulkCreate",
    type: "Positive",
    fr: "BR-06",
    test: "updates thumbnail_url and bulkCreates new gallery images from uploaded files",
    result: "Pass",
  },
  {
    id: 6,
    feature: "is_active",
    input: "is_active trong body",
    condition: "§5",
    expected: "product.update is_active",
    type: "Positive",
    fr: "§5",
    test: "passes is_active from request body to product.update",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Bỏ qua sync variations rỗng",
    input: "variations: []",
    condition: "BR-02",
    expected: "không findAll/destroy variations",
    type: "Positive",
    fr: "BR-02",
    test: "skips variation sync when variations array is empty (BR-02)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "JSON variations lỗi",
    input: "variations not-json",
    condition: "§4",
    expected: "400 Invalid variations data; rollback",
    type: "Negative",
    fr: "§4",
    test: "returns 400 Invalid variations data when JSON parse fails",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Không có primary",
    input: "0 is_primary true",
    condition: "BR-03",
    expected: "400 Exactly one variation must be marked as primary",
    type: "Negative",
    fr: "BR-03",
    test: "returns 400 when no variation is marked primary",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Hai primary",
    input: "2 is_primary true",
    condition: "BR-03",
    expected: "400",
    type: "Negative",
    fr: "BR-03",
    test: "returns 400 when two variations are marked primary",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Product không tồn tại",
    input: "findByPk null",
    condition: "§4",
    expected: "404; rollback",
    type: "Negative",
    fr: "§4",
    test: "returns 404 when product is not found",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Thiếu JWT",
    input: "PUT không Authorization",
    condition: "§4",
    expected: "401",
    type: "Negative",
    fr: "§4",
    test: "returns 401 without bearer token",
    result: "Pass",
  },
  {
    id: 13,
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
    id: 14,
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
    id: 15,
    feature: "Lỗi giữa transaction",
    input: "product.update throw",
    condition: "BR-05",
    expected: "rollback + 500",
    type: "Negative",
    fr: "BR-05",
    test: "rolls back transaction and returns 500 when product.update throws",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateProduct")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/admin/product_and_variation/FR_AdminUpdateProductWithVariations.md | server/__tests__/admin/adminUpdateProductWithVariations.test.js"
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

  const outPath = path.join(outDir, "UnitTest_AdminUpdateProductWithVariations.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
