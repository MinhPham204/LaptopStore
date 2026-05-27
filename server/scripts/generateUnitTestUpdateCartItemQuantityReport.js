/**
 * Generates docs/reports/UnitTest_UpdateCartItemQuantity.xlsx
 * Usage: node scripts/generateUnitTestUpdateCartItemQuantityReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật số lượng hợp lệ",
    input: "PUT /api/cart/10 { quantity: 3 } Bearer JWT",
    condition: "CartItem tồn tại; stock_quantity=10",
    expected: "cartItem.save(); 200 + full cart (getCart)",
    type: "Positive",
    fr: "AC1 / BR-01 / BR-02",
    test: "updates quantity and returns 200 with full cart when stock is sufficient",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Xóa dòng qua quantity=0",
    input: "PUT /api/cart/10 { quantity: 0 }",
    condition: "quantity <= 0",
    expected: "cartItem.destroy(); 200 cart rỗng",
    type: "Positive",
    fr: "AC2",
    test: "removes cart item via destroy when quantity is zero",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Xóa dòng qua quantity âm",
    input: "PUT /api/cart/10 { quantity: -1 }",
    condition: "quantity < 0",
    expected: "destroy(); 200",
    type: "Positive",
    fr: "AC2",
    test: "removes cart item when quantity is negative",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Qty bằng tồn kho",
    input: "PUT { quantity: 5 } stock_quantity=5",
    condition: "quantity === stock",
    expected: "200; save thành công",
    type: "Positive",
    fr: "BR-02",
    test: "allows quantity equal to stock_quantity",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Thiếu quantity",
    input: "PUT body {}",
    condition: "quantity == null",
    expected: '400 "quantity is required"',
    type: "Negative",
    fr: "API contract",
    test: "returns 400 when quantity is missing in body",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Cart item không tồn tại",
    input: "PUT /api/cart/999 { quantity: 2 }",
    condition: "CartItem.findOne null",
    expected: '404 "Cart item not found"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 404 when cart item is not found",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Vượt tồn kho",
    input: "PUT { quantity: 5 } stock=4",
    condition: "quantity > stock_quantity",
    expected: '400 "Insufficient stock"',
    type: "Negative",
    fr: "AC3 / BR-02",
    test: "returns 400 Insufficient stock when quantity exceeds stock_quantity",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu Bearer",
    input: "PUT không Authorization",
    condition: "authenticateToken",
    expected: "401 Access token required",
    type: "Negative",
    fr: "Auth",
    test: "returns 401 when Authorization header is missing",
    result: "Pass",
  },
  {
    id: 9,
    feature: "User inactive",
    input: "PUT Bearer hợp lệ",
    condition: "is_active=false",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "Auth",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Nút + disabled tại max stock",
    input: "(Không test server)",
    condition: "CartPage.jsx",
    expected: "quantity >= stock → + disabled",
    type: "N/A",
    fr: "AC4",
    test: "N/A — frontend only (+ button disabled at max stock)",
    result: "N/A",
  },
  {
    id: 11,
    feature: "Sidebar tổng tiền local",
    input: "(Không test server)",
    condition: "CartPage sidebar",
    expected: "Tổng cập nhật theo qty local",
    type: "N/A",
    fr: "AC5",
    test: "N/A — frontend only (sidebar totals)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateCartItemQty")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "Nguồn FR: docs/feature_requirements/cart/D_FR_UpdateCartItemQuantity.md | server/__tests__/cart/updateCartItemQuantity.test.js"
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
    { width: 44 },
    { width: 12 },
    { width: 20 },
    { width: 56 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_UpdateCartItemQuantity.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
