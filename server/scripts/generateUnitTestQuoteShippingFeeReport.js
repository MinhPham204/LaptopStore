/**
 * Generates docs/reports/admin/UnitTest_QuoteShippingFee.xlsx
 * Usage: node scripts/generateUnitTestQuoteShippingFeeReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Province không tồn tại",
    input: "Province.findByPk null",
    condition: "§4 step 1",
    expected: "shipping_fee 0; reason NO_PROVINCE",
    type: "Positive",
    fr: "§4",
    test: "returns shipping_fee 0 and reason NO_PROVINCE when province is missing (§4)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Freeship tỉnh",
    input: "is_free_shipping=true; có ward_id",
    condition: "§4 step 2",
    expected: "0 FREE_BY_PROVINCE; không cộng ward",
    type: "Positive",
    fr: "§4",
    test: "returns FREE_BY_PROVINCE without adding ward extra_fee (§4)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Base + phụ phí phường",
    input: "base 30k + ward 5k",
    condition: "§4 step 3",
    expected: "shipping_fee 35000",
    type: "Positive",
    fr: "§4",
    test: "returns base_shipping_fee plus ward extra_fee when no freeship rules apply (§4)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "HCM subtotal freeship",
    input: "is_hcm; subtotal >= 1M",
    condition: "§4 step 4",
    expected: "0 HCM_SUBTOTAL_FREE",
    type: "Positive",
    fr: "§4",
    test: "returns HCM_SUBTOTAL_FREE when is_hcm and subtotal >= 1_000_000 (§4)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Cap max_shipping_fee",
    input: "tổng > max",
    condition: "§4 step 5",
    expected: "fee = max_shipping_fee",
    type: "Positive",
    fr: "§4",
    test: "caps fee at max_shipping_fee when total exceeds cap (§4)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Math.round",
    input: "base/ward thập phân",
    condition: "§4 step 6",
    expected: "Math.round; >= 0",
    type: "Positive",
    fr: "§4",
    test: "rounds fee with Math.round and never returns negative (§4)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Ward không tồn tại",
    input: "ward_id có; Ward.findByPk null",
    condition: "§4",
    expected: "chỉ base_shipping_fee",
    type: "Positive",
    fr: "§4",
    test: "uses only base_shipping_fee when ward_id is provided but ward is missing (§4)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Phí thường",
    input: "không rule đặc biệt",
    condition: "§4 step 6",
    expected: "shipping_fee; không reason",
    type: "Positive",
    fr: "§4",
    test: "returns rounded shipping_fee without reason for standard province fee (§4)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "GET /api/quote HCM free",
    input: "province_id, ward_id, subtotal",
    condition: "§5",
    expected: "200; body khớp quoteShipping",
    type: "Positive",
    fr: "§5",
    test: "returns 200 with shipping_fee and reason from quoteShipping (§5)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "GET /api/quote tính phí",
    input: "subtotal < 1M HCM",
    condition: "§5",
    expected: "200; shipping_fee 35000",
    type: "Positive",
    fr: "§5",
    test: "returns 200 with computed fee when HCM subtotal freeship does not apply (§5)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "GET quote thiếu ward_id",
    input: "không ward_id query",
    condition: "§5",
    expected: "200; không load ward",
    type: "Positive",
    fr: "§5",
    test: "returns 200 when ward_id is omitted and does not load ward (§5)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "GET quote subtotal mặc định",
    input: "không subtotal",
    condition: "§5",
    expected: "subtotal=0; 200",
    type: "Positive",
    fr: "§5",
    test: "defaults subtotal to 0 when query param is missing (§5)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Public API",
    input: "GET không JWT",
    condition: "§5",
    expected: "200",
    type: "Positive",
    fr: "§5",
    test: "returns 200 without Authorization header (§5)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Lỗi quote",
    input: "quoteShipping throw",
    condition: "§5",
    expected: "500 { error: QUOTE_FAILED }",
    type: "Negative",
    fr: "§5",
    test: "returns 500 with error QUOTE_FAILED when quoteShipping throws (§5)",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Preview thiếu ward",
    input: "preview vs create",
    condition: "GAP-01",
    expected: "preview có thể thiếu ward_id; create bắt buộc",
    type: "Ref",
    fr: "GAP-01",
    test: "— (previewOrder.test.js)",
    result: "N/A",
  },
  {
    id: 16,
    feature: "NO_PROVINCE fee 0",
    input: "province invalid",
    condition: "GAP-02",
    expected: "có thể hiểu nhầm freeship",
    type: "Ref",
    fr: "GAP-02",
    test: "—",
    result: "N/A",
  },
  {
    id: 17,
    feature: "Checkout không GET /quote",
    input: "useOrderPreview POST",
    condition: "GAP-03",
    expected: "Checkout dùng preview không useShippingQuote",
    type: "Ref",
    fr: "GAP-03",
    test: "—",
    result: "N/A",
  },
  {
    id: 18,
    feature: "Không auth /quote",
    input: "public endpoint",
    condition: "GAP-04",
    expected: "có thể spam nhẹ",
    type: "Ref",
    fr: "GAP-04",
    test: "—",
    result: "N/A",
  },
  {
    id: 19,
    feature: "reason không hiện UI",
    input: "checkout",
    condition: "GAP-05",
    expected: "reason không hiển thị checkout",
    type: "Ref",
    fr: "GAP-05",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_QuoteShippingFee")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/shipping/FR_QuoteShippingFee.md | server/__tests__/shipping/quoteShipping.test.js | server/__tests__/shipping/getQuote.test.js"
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

  const outPath = path.join(outDir, "UnitTest_QuoteShippingFee.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} rows)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
