/**
 * Generates docs/reports/UnitTest_AddToCart.xlsx
 * Usage: node scripts/generateUnitTestAddToCartReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Thêm dòng mới vào giỏ",
    input: "POST { variation_id: 42, quantity: 2 }",
    condition: "variation OK; findOrCreate created=true",
    expected: "200; findOrCreate defaults qty + price_at_add; getCart",
    type: "Positive",
    fr: "AC1 / BR-01 / BR-02",
    test: "creates a new cart line and returns 200 with full cart via getCart",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Cộng dồn quantity cùng SKU",
    input: "POST qty=3 khi đã có dòng qty=2",
    condition: "findOrCreate created=false",
    expected: "quantity=5; save(); 200 + getCart",
    type: "Positive",
    fr: "AC2",
    test: "merges quantity into existing cart line when variation already exists",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Quantity mặc định",
    input: "POST chỉ variation_id",
    condition: "body không có quantity",
    expected: "defaults quantity=1",
    type: "Positive",
    fr: "§4",
    test: "defaults quantity to 1 when body omits quantity",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Variation không tồn tại",
    input: "POST variation_id=999",
    condition: "findByPk null",
    expected: '404 "Product variation not found"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 404 when variation_id does not exist",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Variation không bán",
    input: "POST is_available=false",
    condition: "BR-03",
    expected: '400 "Product not available or insufficient stock"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 400 when variation is not available",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Stock < quantity lần đầu",
    input: "POST qty=3, stock=1",
    condition: "add mới",
    expected: '400 "Product not available or insufficient stock"',
    type: "Negative",
    fr: "BR-03",
    test: "returns 400 when initial quantity exceeds stock",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Merge vượt stock",
    input: "POST qty=3, dòng cũ qty=8, stock=10",
    condition: "created=false",
    expected: '400 "Insufficient stock"; không save',
    type: "Negative",
    fr: "AC3",
    test: "returns 400 Insufficient stock when merged quantity exceeds stock",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Thiếu Bearer",
    input: "POST không Authorization",
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
    input: "POST Bearer hợp lệ",
    condition: "is_active=false",
    expected: "403 User not found or inactive",
    type: "Negative",
    fr: "Auth",
    test: "returns 403 when user is inactive",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Guest PDP không POST cart",
    input: "(Không test server)",
    condition: "ProductDetailPage guest",
    expected: "redirect login; không POST /cart",
    type: "N/A",
    fr: "AC4",
    test: "N/A — frontend only (guest add to cart flow)",
    result: "N/A",
  },
  {
    id: 11,
    feature: "Redux + header badge sau add",
    input: "(Không test server)",
    condition: "useAddToCart onSuccess",
    expected: "setCart + invalidate cart query",
    type: "N/A",
    fr: "AC5",
    test: "N/A — frontend only (Redux and header badge)",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_AddToCart")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/cart/D_FR_AddToCart.md | server/__tests__/cart/addToCart.test.js"
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
    { width: 22 },
    { width: 56 },
    { width: 14 },
  ]

  const outPath = path.join(__dirname, "../../docs/reports/UnitTest_AddToCart.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
