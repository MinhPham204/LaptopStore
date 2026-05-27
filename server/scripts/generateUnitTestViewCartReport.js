/**
 * Generates docs/reports/UnitTest_ViewCart.xlsx
 * Usage: node scripts/generateUnitTestViewCartReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Xem giỏ có sản phẩm",
    input: "GET /api/cart Bearer JWT",
    condition: "Cart.findOne có cart_id=1; CartItem.findAll 2 dòng qty 2+3",
    expected: "200; cart_id=1; items.length=2; item_count=5",
    type: "Positive",
    fr: "AC1 / AC3",
    test: "returns 200 with cart items and item_count equal to sum of quantities",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Tổng tiền snapshot vs sau giảm",
    input: "GET /api/cart với 2 items mock giá/discount",
    condition: "normalizeItem tính line_total",
    expected: "subtotal_snapshot = Σ price_at_add×qty; subtotal_after_discount = Σ line_total",
    type: "Positive",
    fr: "BR-04",
    test: "calculates subtotal_snapshot and subtotal_after_discount from line items",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Cấu trúc item chuẩn hóa",
    input: "GET /api/cart 1 item",
    condition: "variation + product nested",
    expected:
      "item có cart_item_id, variation_id, price_at_add, unit_price_after_discount, variation, product",
    type: "Positive",
    fr: "AC2 (API) / §5",
    test: "returns normalized item fields for frontend rendering",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Giỏ trống / lazy create",
    input: "GET /api/cart user chưa có cart",
    condition: "Cart.findOne null → Cart.create",
    expected: "200; cart_id mới; items=[]; item_count=0; subtotals=0",
    type: "Positive",
    fr: "AC4 / BR-02",
    test: "creates cart when missing and returns empty items with item_count 0",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu Bearer",
    input: "GET /api/cart không Authorization",
    condition: "authenticateToken",
    expected: "401 Access token required",
    type: "Negative",
    fr: "AC6",
    test: "returns 401 when Authorization header is missing",
    result: "Pass",
  },
  {
    id: 6,
    feature: "User inactive",
    input: "GET /api/cart Bearer hợp lệ",
    condition: "User.is_active=false",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "AC6",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 7,
    feature: "UI CartPage empty state",
    input: "(Không test server)",
    condition: "CartPage.jsx FE",
    expected: "Theo FR AC4: items.length=0 → empty UI",
    type: "N/A",
    fr: "AC4 (FE)",
    test: "N/A — frontend only (CartPage empty state)",
    result: "N/A",
  },
  {
    id: 8,
    feature: "Header badge quantity",
    input: "(Không test server)",
    condition: "Header useGetCart Redux",
    expected: "Theo FR AC5: badge = tổng quantity",
    type: "N/A",
    fr: "AC5",
    test: "N/A — frontend only (Header cart badge)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewCart")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/cart/D_FR_ViewCart.md | File test: server/__tests__/cart/viewCart.test.js"
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
    { width: 32 },
    { width: 34 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 52 },
    { width: 14 },
  ]

  const outPath = path.join(__dirname, "../../docs/reports/UnitTest_ViewCart.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
