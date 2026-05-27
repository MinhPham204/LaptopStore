/**
 * Generates docs/reports/UnitTest_RemoveCartItem.xlsx
 * Usage: node scripts/generateUnitTestRemoveCartItemReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa dòng giỏ hợp lệ",
    input: "DELETE /api/cart/10 Bearer JWT",
    condition: "CartItem thuộc cart user; còn 1 dòng khác",
    expected: "destroy({ cart_id, cart_item_id: 10 }); 200 + full cart",
    type: "Positive",
    fr: "AC1 / BR-03",
    test: "destroys cart item and returns 200 with updated cart",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xóa dòng cuối cùng",
    input: "DELETE /api/cart/10",
    condition: "findAll trả [] sau destroy",
    expected: "200; items=[]; item_count=0; subtotals=0",
    type: "Positive",
    fr: "§10 edge",
    test: "returns empty cart when the last item is removed",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Silent delete — id không thuộc cart",
    input: "DELETE /api/cart/999",
    condition: "destroy 0 rows",
    expected: "200 + getCart (không 404)",
    type: "Silent",
    fr: "§4 API",
    test: "returns 200 with cart when destroy matches zero rows",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Thiếu Bearer",
    input: "DELETE không Authorization",
    condition: "authenticateToken",
    expected: "401 Access token required",
    type: "Negative",
    fr: "Auth",
    test: "returns 401 when Authorization header is missing",
    result: "Pass",
  },
  {
    id: 5,
    feature: "User inactive",
    input: "DELETE Bearer hợp lệ",
    condition: "is_active=false",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "Auth",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Lỗi DB destroy",
    input: "DELETE /api/cart/10",
    condition: "CartItem.destroy throw",
    expected: "500 Internal server error message",
    type: "Negative",
    fr: "Optional",
    test: "returns 500 when CartItem.destroy throws",
    result: "Pass",
  },
  {
    id: 7,
    feature: "selectedIds bỏ id đã xóa",
    input: "(Không test server)",
    condition: "CartPage doRemoveItem",
    expected: "selectedIds.delete(id) trước mutate",
    type: "N/A",
    fr: "AC2 / BR-02",
    test: "N/A — frontend only (selectedIds sync)",
    result: "N/A",
  },
  {
    id: 8,
    feature: "Header badge giảm",
    input: "(Không test server)",
    condition: "useGetCart invalidate",
    expected: "Badge = tổng quantity sau setCart",
    type: "N/A",
    fr: "AC3",
    test: "N/A — frontend only (header cart badge)",
    result: "N/A",
  },
  {
    id: 9,
    feature: "Hủy confirm không gọi API",
    input: "(Không test server)",
    condition: "Confirm modal Hủy",
    expected: "Không DELETE",
    type: "N/A",
    fr: "AC4",
    test: "N/A — frontend only (cancel confirm)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_RemoveCartItem")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/cart/D_FR_RemoveCartItem.md | server/__tests__/cart/removeCartItem.test.js"
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
    { width: 34 },
    { width: 32 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 52 },
    { width: 14 },
  ]

  const outPath = path.join(__dirname, "../../docs/reports/UnitTest_RemoveCartItem.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
