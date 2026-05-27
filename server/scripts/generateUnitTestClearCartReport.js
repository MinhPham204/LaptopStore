/**
 * Generates docs/reports/UnitTest_ClearCart.xlsx
 * Usage: node scripts/generateUnitTestClearCartReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xóa toàn bộ dòng giỏ",
    input: "DELETE /api/cart Bearer JWT",
    condition: "Cart có cart_id; CartItem.destroy all",
    expected:
      "destroy({ cart_id }); 200; items=[]; item_count=0; subtotals=0",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: "destroys all cart items and returns 200 with empty cart",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Giữ bản ghi carts",
    input: "DELETE /api/cart",
    condition: "clearCart controller",
    expected: "Cart.destroy KHÔNG được gọi",
    type: "Positive",
    fr: "AC2 / BR-01",
    test: "does not call Cart.destroy when clearing cart items",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Giỏ đã trống",
    input: "DELETE /api/cart",
    condition: "findAll []",
    expected: "200; items=[]",
    type: "Positive",
    fr: "§10 edge",
    test: "returns 200 with empty cart when cart already has no items",
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
    input: "DELETE /api/cart",
    condition: "CartItem.destroy throw",
    expected: "500",
    type: "Negative",
    fr: "Optional",
    test: "returns 500 when CartItem.destroy throws",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Confirm modal Xóa tất cả",
    input: "(Không test server)",
    condition: "CartPage confirmState clear",
    expected: "User confirm → mới gọi API",
    type: "N/A",
    fr: "AC3",
    test: "N/A — frontend only (clear confirm modal)",
    result: "N/A",
  },
  {
    id: 8,
    feature: "selectedIds reset",
    input: "(Không test server)",
    condition: "doClearCart setSelectedIds(new Set())",
    expected: "Tick selection rỗng sau clear",
    type: "N/A",
    fr: "AC4",
    test: "N/A — frontend only (selectedIds reset)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ClearCart")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/cart/D_FR_ClearCart.md | server/__tests__/cart/clearCart.test.js"
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

  const outPath = path.join(__dirname, "../../docs/reports/UnitTest_ClearCart.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
