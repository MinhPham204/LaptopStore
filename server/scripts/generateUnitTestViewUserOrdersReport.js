/**
 * Generates docs/reports/order/UnitTest_ViewUserOrders.xlsx
 * Usage: node scripts/generateUnitTestViewUserOrdersReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Danh sách mặc định",
    input: "GET /api/orders tab=all",
    condition: "§5",
    expected: "200; orders; pagination",
    type: "Positive",
    fr: "§5",
    test: "returns 200 with orders and pagination for default tab all (§5)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "items_preview",
    input: "đơn 3 items",
    condition: "§6",
    expected: "preview 2 dòng; items_count=3",
    type: "Positive",
    fr: "§6",
    test: "maps items_preview to at most two lines and items_count from all items (§6)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Thumbnail preview",
    input: "images[0] + thumbnail_url",
    condition: "§6",
    expected: "ưu tiên image_url",
    type: "Positive",
    fr: "§6",
    test: "prefers product.images[0].image_url for items_preview thumbnail (§6)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "reserve_expires_at",
    input: "mock có field",
    condition: "§5",
    expected: "reserve_expires_at trong order",
    type: "Positive",
    fr: "§5",
    test: "includes reserve_expires_at on each order in the list (§5)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Lọc user_id",
    input: "JWT user",
    condition: "AC §11",
    expected: "where.user_id = req.userId",
    type: "Positive",
    fr: "AC §11",
    test: "scopes findAndCountAll to authenticated user_id (AC §11)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Tab all",
    input: "tab=all",
    condition: "§6",
    expected: "payment optional; không filter status",
    type: "Positive",
    fr: "§6",
    test: "uses optional payment include for tab all (§6)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Tab awaiting_payment",
    input: "tab=awaiting_payment",
    condition: "§6",
    expected: "AWAITING_PAYMENT + VNPAY pending",
    type: "Positive",
    fr: "§6",
    test: "filters awaiting_payment with VNPAY pending payment (§6)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Tab to_ship",
    input: "tab=to_ship",
    condition: "§6",
    expected: "processing + payment OR COD/VNPAY",
    type: "Positive",
    fr: "§6",
    test: "filters to_ship as processing with COD pending or VNPAY completed (§6)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Tab shipping",
    input: "tab=shipping",
    condition: "§6",
    expected: "status shipping + payment required",
    type: "Positive",
    fr: "§6",
    test: "filters shipping tab with same payment rules as to_ship (§6)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Tab completed",
    input: "tab=completed",
    condition: "§6",
    expected: "delivered + payment completed",
    type: "Positive",
    fr: "§6",
    test: "filters completed as delivered with payment completed (§6)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Tab cancelled",
    input: "tab=cancelled",
    condition: "§6",
    expected: "status IN cancelled, FAILED",
    type: "Positive",
    fr: "§6",
    test: "filters cancelled tab with status in cancelled or FAILED (§6)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Tab failed",
    input: "tab=failed",
    condition: "§6",
    expected: "status FAILED",
    type: "Positive",
    fr: "§6",
    test: "filters failed tab with status FAILED (§6)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Tìm kiếm q",
    input: "q=ORD-LAPTOP",
    condition: "§6",
    expected: "Op.or order_code và product_name",
    type: "Positive",
    fr: "§6",
    test: "adds Op.or search on order_code and product_name when q is set (§6)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Phân trang",
    input: "page=2&limit=5",
    condition: "§4",
    expected: "limit=5; offset=5",
    type: "Positive",
    fr: "§4",
    test: "applies page and limit to findAndCountAll offset and limit (§4)",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Sắp xếp",
    input: "sort=created_at:asc",
    condition: "§4",
    expected: "order created_at ASC",
    type: "Positive",
    fr: "§4",
    test: "orders by created_at ASC when sort=created_at:asc (§4)",
    result: "Pass",
  },
  {
    id: 16,
    feature: "Query join shape",
    input: "GET list",
    condition: "§6",
    expected: "distinct; subQuery false; items required",
    type: "Positive",
    fr: "§6",
    test: "uses distinct true, subQuery false and required items include (§6)",
    result: "Pass",
  },
  {
    id: 17,
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
    id: 18,
    feature: "User inactive",
    input: "is_active=false",
    condition: "PRE-01",
    expected: "403",
    type: "Negative",
    fr: "PRE-01",
    test: "returns 403 when user is inactive (PRE-01)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ViewUserOrders")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_ViewUserOrders.md | server/__tests__/orders/viewUserOrders.test.js"
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

  const outPath = path.join(outDir, "UnitTest_ViewUserOrders.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
