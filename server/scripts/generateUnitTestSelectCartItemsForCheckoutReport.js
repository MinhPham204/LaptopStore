/**
 * Generates docs/reports/UnitTest_SelectCartItemsForCheckout.xlsx
 * Usage: node scripts/generateUnitTestSelectCartItemsForCheckoutReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Subtotal theo item đã tick",
    input: "2 items; bỏ tick 1",
    condition: "selectedIds subset",
    expected: "Tổng tiền chỉ cộng item còn tick; sidebar không hiện item bỏ tick",
    type: "Positive",
    fr: "AC1",
    test: "computes subtotal only for checked items when one item is unchecked",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 2,
    feature: "Chọn tất cả",
    input: "Click checkbox Chọn tất cả off/on",
    condition: "isAllSelected + label x/y",
    expected: "0/2 rồi 2/2; item checkboxes đồng bộ",
    type: "Positive",
    fr: "AC2",
    test: "toggles select-all off then on with correct isAllSelected state",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 3,
    feature: "Validate stock item đã chọn",
    input: "1 item stock=0, is_available=false",
    condition: "hasInvalidSelected",
    expected: "Nút Thanh toán disabled + cảnh báo đỏ",
    type: "Positive",
    fr: "AC3",
    test: "disables checkout when a selected item is out of stock",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 4,
    feature: "Checkout subset đã login",
    input: "Tick 1/2 items; click Thanh toán",
    condition: "isAuthenticated=true",
    expected: 'navigate("/checkout", { state: { mode:"cart", items:[...] } })',
    type: "Positive",
    fr: "AC4",
    test: "navigates to checkout with only selected items when authenticated",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 5,
    feature: "Không chọn item",
    input: "Bỏ chọn tất cả; click Thanh toán",
    condition: "canCheckout false",
    expected: "Button disabled; không navigate",
    type: "Negative",
    fr: "BR-01",
    test: "does not navigate when no items are selected",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 6,
    feature: "Guest checkout",
    input: "Click Thanh toán khi chưa login",
    condition: "!isAuthenticated",
    expected: 'navigate("/login?redirect=/checkout")',
    type: "Negative",
    fr: "BR-05 / Guest",
    test: "navigates guest to login with checkout redirect",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 7,
    feature: "Items đổi → chọn lại all",
    input: "Rerender mockCartItems mới",
    condition: "useEffect [items]",
    expected: "selectedIds = all new cart_item_id",
    type: "Positive",
    fr: "BR-03",
    test: "re-selects all items when cart items change from the store",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 8,
    feature: "E2E CheckoutPage + POST /orders",
    input: "(Không test unit)",
    condition: "Integration full flow",
    expected: "Order tạo từ subset; cart clear server-side",
    type: "N/A",
    fr: "AC5",
    test: "N/A — integration (CheckoutPage + POST /orders)",
    result: "N/A",
    layer: "Integration",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_SelectCartCheckout")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/cart/FR_SelectCartItemsForCheckout.md | client/app/pages/CartPage.selectCheckout.test.jsx"
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
    "Layer (FE)",
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
      r.layer,
    ])
  })

  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 32 },
    { width: 28 },
    { width: 48 },
    { width: 12 },
    { width: 18 },
    { width: 52 },
    { width: 14 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_SelectCartItemsForCheckout.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
