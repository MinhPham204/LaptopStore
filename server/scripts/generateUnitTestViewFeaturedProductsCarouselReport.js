/**
 * Generates docs/reports/UnitTest_ViewFeaturedProductsCarousel.xlsx
 * Usage: node scripts/generateUnitTestViewFeaturedProductsCarouselReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Featured API success",
    input: "GET /api/products/v2?page=1&limit=12&sort_by=best_selling",
    condition: "AC1, AC2",
    expected: "200; products[]; pagination page=1 limit=12",
    type: "Positive",
    fr: "AC1 / AC2",
    test: "returns 200 with products for featured query page=1 limit=12 sort_by=best_selling (AC1, AC2)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 2,
    feature: "Best selling sort",
    input: "sort_by=best_selling",
    condition: "BR-01",
    expected: "order sold_qty DESC; tie-break created_at DESC",
    type: "Positive",
    fr: "BR-01",
    test: "orders by sold_qty DESC when sort_by=best_selling (BR-01)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 3,
    feature: "Limit 12",
    input: "limit=12 page=1",
    condition: "BR-02",
    expected: "findAndCountAll limit 12 offset 0",
    type: "Positive",
    fr: "BR-02",
    test: "caps fetch at limit 12 for featured carousel (BR-02)",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 4,
    feature: "Empty best sellers",
    input: "count=0",
    condition: "§8 data",
    expected: "200 products []",
    type: "Positive",
    fr: "AC1",
    test: "returns 200 with empty products when no best sellers exist",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 5,
    feature: "Inactive products allowed",
    input: "v2 featured query",
    condition: "BR-04",
    expected: "where không có is_active",
    type: "Positive",
    fr: "BR-04",
    test: "does not include is_active in where clause for featured v2 query",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 6,
    feature: "DB error",
    input: "findAndCountAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAndCountAll throws",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 7,
    feature: "Featured filters hook",
    input: "HomePage mount",
    condition: "AC2",
    expected: "useProductsV2({ page:1, limit:12, sortBy:'best_selling' })",
    type: "Positive",
    fr: "AC2",
    test: "calls useProductsV2 with page 1 limit 12 sortBy best_selling (AC2)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "Render featured cards",
    input: "mock 3 products",
    condition: "AC1",
    expected: "section SẢN PHẨM NỔI BẬT; 3 ProductCard",
    type: "Positive",
    fr: "AC1",
    test: "renders featured ProductCard entries when hook returns 3 products (AC1)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "Empty UI copy",
    input: "featured []",
    condition: "§8",
    expected: '"Chưa có sản phẩm nổi bật."',
    type: "Positive",
    fr: "AC1",
    test: "shows empty message when featured products list is empty",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Auto interval 1s",
    input: "FeaturedTimerProbe + fake timers",
    condition: "AC3",
    expected: "onTick index sau mỗi 1000ms",
    type: "Positive",
    fr: "AC3",
    test: "auto-advances featured index every 1 second (AC3)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "Carousel controls",
    input: "HomePage featured section",
    condition: "AC4",
    expected: "aria-label Previous/Next featured products",
    type: "Positive",
    fr: "AC4",
    test: "exposes prev and next carousel controls (AC4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "Hover pause timer",
    input: "mouseEnter carousel track",
    condition: "AC3",
    expected: "clearInterval gọi",
    type: "Positive",
    fr: "AC3",
    test: "clears featured timer on mouse enter over carousel track (AC3)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "Index modulo next/prev",
    input: "featuredNextIndex / featuredPrevIndex",
    condition: "AC4 logic",
    expected: "wrap circular 0..count-1",
    type: "Positive",
    fr: "AC4",
    test: "featuredNextIndex / featuredPrevIndex wraps modulo product count (AC4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 14,
    feature: "Scroll offset formula",
    input: "index=2 itemW=240 gap=16",
    condition: "§5",
    expected: "scrollLeft = 512",
    type: "Positive",
    fr: "§5",
    test: "scrollFeaturedLeft uses item width plus 16px gap",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 15,
    feature: "ProductCard deep link",
    input: "click card",
    condition: "AC5",
    expected: "N/A — ProductCard test riêng",
    type: "Ref",
    fr: "AC5",
    test: "—",
    result: "N/A",
    layer: "Client",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_FeaturedCarousel")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_ViewFeaturedProductsCarousel.md"
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
    "Layer",
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
    { width: 26 },
    { width: 40 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 16 },
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_ViewFeaturedProductsCarousel.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
