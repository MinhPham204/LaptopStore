/**
 * Generates docs/report/order/UnitTest_CreateOrder.xlsx
 * Usage: node scripts/generateUnitTestCreateOrderReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Tạo đơn COD",
    input: "validCodBody",
    condition: "AC §13",
    expected: "201 processing; redirect null; items_breakdown; decrement",
    type: "Positive",
    fr: "AC §13",
    test: "creates COD order with 201, processing status, items_breakdown and stock decrement (AC §13)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Tạo đơn VNPAY",
    input: "validVnpayBody + VNP_* env",
    condition: "AC §13",
    expected: "201 AWAITING_PAYMENT; reserve 24h; redirect",
    type: "Positive",
    fr: "AC §13",
    test: "creates VNPAY order with AWAITING_PAYMENT, reserve_expires_at and redirect (AC §13)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Xóa cart items đã chọn",
    input: "items[] + cart",
    condition: "BR-CART",
    expected: "CartItem.destroy variation_id IN",
    type: "Positive",
    fr: "BR-CART",
    test: "destroys selected cart items when items array is provided (BR-CART)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Giỏ rỗng",
    input: "no items, no cart",
    condition: "BR-ITEMS",
    expected: "400 Cart is empty",
    type: "Negative",
    fr: "BR-ITEMS",
    test: "returns 400 when cart is empty and no items in body (BR-ITEMS)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Cart không có dòng",
    input: "CartItem.findAll []",
    condition: "BR-ITEMS",
    expected: "400 Cart is empty",
    type: "Negative",
    fr: "BR-ITEMS",
    test: "returns 400 when cart has no cart items (BR-ITEMS)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Provider không hỗ trợ",
    input: "payment_provider PAYPAL",
    condition: "§5",
    expected: "400 Unsupported payment_provider",
    type: "Negative",
    fr: "§5",
    test: "returns 400 for unsupported payment_provider (§5)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Method không hợp lệ",
    input: "VNPAY + COD method",
    condition: "§5",
    expected: "400 Invalid payment_method",
    type: "Negative",
    fr: "§5",
    test: "returns 400 for invalid payment_method (§5)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu tỉnh/xã",
    input: "province_id null",
    condition: "§5",
    expected: "400 Tỉnh/Thành và Phường/Xã",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when province or ward is missing (§5)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Thiếu geo",
    input: "geo_lat/lng undefined",
    condition: "§5",
    expected: "400 xác nhận vị trí bản đồ",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when geo coordinates are missing (§5)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Variation không tồn tại",
    input: "findByPk null",
    condition: "§5",
    expected: "400 Variation not found",
    type: "Negative",
    fr: "§5",
    test: "returns 400 when variation is not found (§5)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Không đủ tồn",
    input: "stock < quantity",
    condition: "§5",
    expected: "400 Insufficient stock",
    type: "Negative",
    fr: "§5",
    test: "returns 400 for insufficient stock before reserve (§5)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Reserve không lock được",
    input: "findOne null",
    condition: "EC-01",
    expected: "400 not found during reserve",
    type: "Negative",
    fr: "EC-01",
    test: "returns 400 when variation not found during reserve (EC-01)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Hết hàng lúc reserve",
    input: "stock 0 at reserve",
    condition: "EC-06",
    expected: "400 Out of stock during reserve",
    type: "Negative",
    fr: "EC-06",
    test: "returns 400 for out of stock during reserve (EC-06)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "VNPAY config lỗi",
    input: "env VNP_* missing",
    condition: "EC-02",
    expected: "502 rollback",
    type: "Negative",
    fr: "EC-02",
    test: "returns 502 and rolls back when VNPAY env is missing (EC-02)",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Thiếu JWT",
    input: "no Authorization",
    condition: "PRE-01",
    expected: "401",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 401 without bearer token (PRE-01)",
    result: "Pass",
  },
  {
    id: 16,
    feature: "User inactive",
    input: "is_active false",
    condition: "PRE-01",
    expected: "403",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
  {
    id: 17,
    feature: "Lỗi DB",
    input: "Order.create throw",
    condition: "Error",
    expected: "500 rollback",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when Order.create throws",
    result: "Pass",
  },
  {
    id: 18,
    feature: "POST /orders/preview",
    input: "previewOrder",
    condition: "FR_PreviewOrder",
    expected: "N/A — preview tests riêng",
    type: "Ref",
    fr: "FR_PreviewOrder",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_CreateOrder")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_CreateOrder.md | server/__tests__/orders/createOrder.test.js"
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
    { width: 30 },
    { width: 36 },
    { width: 22 },
    { width: 48 },
    { width: 12 },
    { width: 14 },
    { width: 68 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_CreateOrder.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
