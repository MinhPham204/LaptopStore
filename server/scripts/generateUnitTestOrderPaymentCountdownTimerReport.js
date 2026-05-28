/**
 * Generates docs/report/order/UnitTest_OrderPaymentCountdownTimer.xlsx
 * Usage: node scripts/generateUnitTestOrderPaymentCountdownTimerReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Badge danh sách đơn",
    input: "AWAITING_PAYMENT + reserve_expires_at còn hạn",
    condition: "AC §10, BR-01",
    expected: "Hiển thị badge dạng Xh Ym",
    type: "Positive",
    fr: "AC §10 / BR-01",
    test: "shows CountdownBadge as Xh Ym for AWAITING_PAYMENT with reserve_expires_at",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Badge ẩn khi hết hạn",
    input: "reserve_expires_at quá khứ",
    condition: "AC §10, BR-02",
    expected: "Không render badge (null)",
    type: "Positive",
    fr: "AC §10 / BR-02",
    test: "hides CountdownBadge when reserve_expires_at is in the past",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Không badge COD",
    input: "status=processing, provider=COD",
    condition: "§5 COD",
    expected: "Không có badge countdown",
    type: "Negative",
    fr: "§5",
    test: "does not show badge for COD processing order",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Không badge thiếu field",
    input: "AWAITING_PAYMENT, reserve_expires_at=null",
    condition: "§5",
    expected: "Không có badge",
    type: "Negative",
    fr: "§5",
    test: "does not show badge when reserve_expires_at is missing",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Badge cập nhật mỗi phút",
    input: "interval 60s",
    condition: "BR-03",
    expected: "Giá trị Xh Ym đổi sau advanceTimers 60s",
    type: "Positive",
    fr: "BR-03",
    test: "updates badge after 60s interval",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Đồng hồ chi tiết HH:MM:SS",
    input: "reserve_expires_at còn 65s",
    condition: "§6",
    expected: "Hiển thị 00:01:05",
    type: "Positive",
    fr: "§6",
    test: "shows PaymentCountdown as HH:MM:SS when reserve_expires_at is present",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Cảnh báo ≤10 phút",
    input: "còn 9 phút",
    condition: "§6",
    expected: "text-red-600 + copy cảnh báo",
    type: "Positive",
    fr: "§6",
    test: "shows red warning when 10 minutes or less remain",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Không cảnh báo >10 phút",
    input: "còn 11 phút",
    condition: "§6",
    expected: "Không có dòng cảnh báo đỏ",
    type: "Negative",
    fr: "§6",
    test: "does not show warning when more than 10 minutes remain",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Hết hạn detail + onExpired",
    input: "advanceTimers qua expiresAt",
    condition: "§6 onExpired",
    expected: "UI Đã hết thời gian; không còn HH:MM:SS",
    type: "Positive",
    fr: "§6",
    test: "runs expiry handler and shows expired message when timer reaches zero",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Detail không mount countdown",
    input: "order thiếu reserve_expires_at",
    condition: "GAP-01",
    expected: "Không có block Thời gian còn lại",
    type: "Negative",
    fr: "GAP-01",
    test: "does not mount PaymentCountdown when reserve_expires_at is absent",
    result: "Pass",
  },
  {
    id: 11,
    feature: "List API trả field",
    input: "GET /api/orders",
    condition: "§4",
    expected: "orders[].reserve_expires_at có giá trị ISO",
    type: "Positive",
    fr: "§4",
    test: "getUserOrdersV2 returns reserve_expires_at on each order",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Slim API thiếu field",
    input: "GET /api/orders/:id/slim",
    condition: "GAP-01",
    expected: "order.reserve_expires_at undefined",
    type: "Negative",
    fr: "GAP-01",
    test: "getOrderDetailSlim does not expose reserve_expires_at on order",
    result: "Pass",
  },
  {
    id: 13,
    feature: "createOrder COD",
    input: "payment_provider=COD",
    condition: "§4",
    expected: "reserve_expires_at: null",
    type: "Positive",
    fr: "§4 / FR_CreateOrder",
    test: "createOrder.test.js — creates COD order with processing status (reserve_expires_at null)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "createOrder VNPAY 24h",
    input: "payment_provider=VNPAY",
    condition: "§4",
    expected: "reserve_expires_at ~24h sau create",
    type: "Positive",
    fr: "§4 / FR_CreateOrder",
    test: "createOrder.test.js — creates VNPAY order with AWAITING_PAYMENT, reserve_expires_at",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_OrderPaymentCountdown")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_OrderPaymentCountdownTimer.md | client/__tests__/orders/orderPaymentCountdownTimer.test.jsx | server/__tests__/orders/orderPaymentCountdownBe.test.js"
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
  sheet.getColumn(8).width = 48

  const outPath = path.join(outDir, "UnitTest_OrderPaymentCountdownTimer.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
