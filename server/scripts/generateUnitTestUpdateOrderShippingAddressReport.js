/**
 * Generates docs/report/order/UnitTest_UpdateOrderShippingAddress.xlsx
 * Usage: node scripts/generateUnitTestUpdateOrderShippingAddressReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cập nhật địa chỉ thành công",
    input: "PUT đầy đủ shipping fields",
    condition: "AC §12",
    expected: "200; message; order patch trong response",
    type: "Positive",
    fr: "AC §12",
    test: "returns 200 with message and updated order fields (AC §12)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Partial merge",
    input: "chỉ shipping_name",
    condition: "§6",
    expected: "order.update giữ field cũ",
    type: "Positive",
    fr: "§6",
    test: "merges partial body with existing order fields (§6)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Tính lại phí ship",
    input: "đổi ward_id",
    condition: "BR-01",
    expected: "quoteShipping(subtotal); final_amount mới",
    type: "Positive",
    fr: "BR-01",
    test: "calls quoteShipping with subtotal and updates final_amount (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Đồng bộ payment.amount",
    input: "COD pending",
    condition: "BR-03",
    expected: "payment.update amount = final_amount",
    type: "Positive",
    fr: "BR-03",
    test: "syncs payment.amount when payment is not completed (BR-03)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "VNPAY completed ship không đổi",
    input: "VNPAY completed; ship fee giữ nguyên",
    condition: "BR-02",
    expected: "200; không payment.update",
    type: "Positive",
    fr: "BR-02",
    test: "returns 200 for VNPAY completed when shipping fee does not change (BR-02)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Thiếu JWT",
    input: "không Authorization",
    condition: "PRE-01",
    expected: "401",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 401 without bearer token (PRE-01)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "User inactive",
    input: "is_active=false",
    condition: "PRE-01",
    expected: "403",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Order not found",
    input: "Order.findOne null",
    condition: "§5",
    expected: "404",
    type: "Negative",
    fr: "§5",
    test: "returns 404 when order is not found (§5)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Status shipping",
    input: "status=shipping",
    condition: "PRE-02",
    expected: "400 Cannot change shipping address",
    type: "Negative",
    fr: "PRE-02",
    test: "returns 400 when order status is shipping (PRE-02)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Status delivered",
    input: "status=delivered",
    condition: "PRE-02",
    expected: "400 Cannot change shipping address",
    type: "Negative",
    fr: "PRE-02",
    test: "returns 400 when order status is delivered (PRE-02)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Status cancelled",
    input: "status=cancelled",
    condition: "PRE-02",
    expected: "400 Cannot change shipping address",
    type: "Negative",
    fr: "PRE-02",
    test: "returns 400 when order status is cancelled (PRE-02)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Thiếu province_id",
    input: "order và body không có province_id",
    condition: "PRE-03",
    expected: "400 province_id is required",
    type: "Negative",
    fr: "PRE-03",
    test: "returns 400 when province_id is missing after merge (PRE-03)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "VNPAY completed ship đổi",
    input: "VNPAY completed; newShipFee khác old",
    condition: "BR-02",
    expected: "400 message tiếng Việt",
    type: "Negative",
    fr: "BR-02",
    test: "returns 400 Vietnamese message when VNPAY completed and shipping fee changes (BR-02)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_UpdateShippingAddr")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_UpdateOrderShippingAddress.md | server/__tests__/orders/updateOrderShippingAddress.test.js"
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

  sheet.columns.forEach((col) => {
    col.width = 22
  })
  sheet.getColumn(8).width = 58

  const outPath = path.join(outDir, "UnitTest_UpdateOrderShippingAddress.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
