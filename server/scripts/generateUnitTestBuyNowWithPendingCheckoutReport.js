/**
 * Generates docs/report/order/UnitTest_BuyNowWithPendingCheckout.xlsx
 * Usage: node scripts/generateUnitTestBuyNowWithPendingCheckoutReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Auth mua ngay → checkout",
    input: "Click Mua ngay (đã login)",
    condition: "AC1, BR-01",
    expected: "navigate /checkout state mode buy_now + items",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: "navigates to checkout with buy_now state when authenticated (AC1, BR-01)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Guest pendingCheckout",
    input: "Click Mua ngay (chưa login)",
    condition: "AC2, BR-04",
    expected: "localStorage pendingCheckout + /login?redirect=/checkout",
    type: "Positive",
    fr: "AC2 / BR-04",
    test: "saves pendingCheckout and redirects guest to login (AC2, BR-04)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Không gọi addToCart",
    input: "Mua ngay",
    condition: "BR-01",
    expected: "addToCart.mutate không được gọi",
    type: "Positive",
    fr: "BR-01",
    test: "does not call addToCart.mutate on buy now (BR-01)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Số lượng trong intent",
    input: "quantity=3",
    condition: "AC1",
    expected: "items[0].quantity = 3",
    type: "Positive",
    fr: "AC1",
    test: "uses selected quantity in checkout intent (AC1)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Hết hàng",
    input: "stock_quantity=0",
    condition: "PRE-03",
    expected: "nút disabled; không navigate",
    type: "Negative",
    fr: "PRE-03",
    test: "does not navigate when variation is out of stock (PRE-03)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Vượt tồn kho",
    input: "quantity > stock",
    condition: "PRE-03",
    expected: "nút disabled; không navigate",
    type: "Negative",
    fr: "PRE-03",
    test: "does not navigate when quantity exceeds stock (PRE-03)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Chưa chọn cấu hình",
    input: "Thiết lập lại",
    condition: "PRE-01",
    expected: "nút disabled; không navigate",
    type: "Negative",
    fr: "PRE-01",
    test: "does not navigate after reset when configuration is incomplete (PRE-01)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "SP ngừng kinh doanh",
    input: "is_active=false",
    condition: "PRE-02",
    expected: "nút disabled; không navigate",
    type: "Negative",
    fr: "PRE-02",
    test: "does not navigate when product is inactive (PRE-02)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Checkout hiển thị Mua ngay",
    input: "state mode buy_now",
    condition: "AC3",
    expected: 'UI text "Mua ngay"',
    type: "Positive",
    fr: "AC3",
    test: 'shows "Mua ngay" checkout mode for buy_now intent (AC3)',
    result: "Pass",
  },
  {
    id: 10,
    feature: "COD buy_now không xóa cart",
    input: "Đặt hàng COD",
    condition: "AC4, BR-02",
    expected: "items chỉ variation_id+qty; không removeMany",
    type: "Positive",
    fr: "AC4 / BR-02",
    test: "submits order with variation_id and quantity only and does not removeMany (AC4, BR-02)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "POST /orders createOrder",
    input: "CheckoutPage submit",
    condition: "FR_CreateOrder",
    expected: "N/A — đã có test FR_CreateOrder",
    type: "Ref",
    fr: "FR_CreateOrder",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_BuyNowPendingCheckout")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_BuyNowWithPendingCheckout.md"
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
    { width: 18 },
    { width: 72 },
    { width: 14 },
  ]

  const outPath = path.join(outDir, "UnitTest_BuyNowWithPendingCheckout.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
