/**
 * Generates docs/reports/UnitTest_ChangeCartItemVariation.xlsx
 * Usage: node scripts/generateUnitTestChangeCartItemVariationReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Cùng variation — không gọi API",
    input: "Áp dụng với cấu hình hiện tại",
    condition: "chosen.variation_id === oldVarId",
    expected: "Modal đóng; add/remove không gọi",
    type: "Positive",
    fr: "BR-04 / AC4",
    test: "closes modal without calling add or remove when variation is unchanged",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 2,
    feature: "SKU hết hàng",
    input: "Chọn 8GB/256GB/Silver",
    condition: "stock=0, is_available=false",
    expected: "Cấu hình này đã hết hàng; không POST",
    type: "Negative",
    fr: "AC3",
    test: "shows out-of-stock error and does not add when chosen variation is unavailable",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 3,
    feature: "Không match variation",
    input: "Combo 16GB+1TB+Black không tồn tại",
    condition: "matchVariation null",
    expected: "Không tìm thấy cấu hình; không POST",
    type: "Negative",
    fr: "AC3",
    test: "shows match error and does not add when no variation matches selection",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 4,
    feature: "Đổi SKU thành công",
    input: "POST add 102 qty=2 → DELETE 10",
    condition: "add onSuccess → remove oldItemId",
    expected: "mutate add {variation_id:102, quantity:2}; remove(10)",
    type: "Positive",
    fr: "AC1 / AC2 / BR-01",
    test: "adds new variation then removes old cart line with same quantity",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 5,
    feature: "Add fail — giữ dòng cũ",
    input: "add onError",
    condition: "BR-02",
    expected: "remove không gọi; hiện lỗi đổi cấu hình",
    type: "Negative",
    fr: "BR-02",
    test: "does not remove old item when addToCart fails",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 6,
    feature: "Hủy modal",
    input: "Click Hủy",
    condition: "AC4",
    expected: "Không add/remove",
    type: "Positive",
    fr: "AC4",
    test: "does not call add or remove when user cancels the modal",
    result: "Pass",
    layer: "FE",
  },
  {
    id: 7,
    feature: "Flow POST + DELETE",
    input: "POST /cart {variation_id:102, qty:3}; DELETE /cart/10",
    condition: "JWT; mocks findOrCreate + destroy",
    expected: "Cả hai 200; cart cuối rỗng",
    type: "Positive",
    fr: "AC1 / AC2 / BR-01",
    test: "completes add-new-variation then remove-old-item sequence with 200 responses",
    result: "Pass",
    layer: "BE",
  },
  {
    id: 8,
    feature: "POST fail — không DELETE",
    input: "POST variation không tồn tại",
    condition: "findByPk null",
    expected: "404; destroy không gọi",
    type: "Negative",
    fr: "BR-02",
    test: "does not proceed to delete when POST addToCart fails",
    result: "Pass",
    layer: "BE",
  },
  {
    id: 9,
    feature: "POST thiếu stock",
    input: "POST qty=3, stock=1",
    condition: "insufficient stock",
    expected: "400; findOrCreate không gọi",
    type: "Negative",
    fr: "AC3 / BR-02",
    test: "returns 400 on POST when new variation has insufficient stock",
    result: "Pass",
    layer: "BE",
  },
  {
    id: 10,
    feature: "Add OK delete fail — 2 dòng tạm",
    input: "(Gap BR-03)",
    condition: "Không test unit",
    expected: "Integration / manual",
    type: "N/A",
    fr: "BR-03",
    test: "N/A — integration gap (add success, delete fails)",
    result: "N/A",
    layer: "Integration",
  },
  {
    id: 11,
    feature: "Merge SKU đã có trong giỏ",
    input: "(Edge §6)",
    condition: "POST upsert cộng qty",
    expected: "Verify manual / future test",
    type: "N/A",
    fr: "§6 edge",
    test: "N/A — merge when target SKU already in cart",
    result: "N/A",
    layer: "Integration",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_ChangeVariation")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/cart/D_FR_ChangeCartItemVariation.md | FE: CartPage.changeVariation.test.jsx | BE: changeCartItemVariation.flow.test.js"
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
    "Layer (FE/BE)",
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
    { width: 36 },
    { width: 30 },
    { width: 44 },
    { width: 12 },
    { width: 20 },
    { width: 54 },
    { width: 14 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ChangeCartItemVariation.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
