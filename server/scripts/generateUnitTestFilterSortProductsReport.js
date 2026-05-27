/**
 * Generates docs/reports/UnitTest_FilterSortProducts.xlsx
 * Usage: node scripts/generateUnitTestFilterSortProductsReport.js
 */
const path = require("path")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Lọc 1 brand",
    input: "GET ?brand_id=1",
    condition: "AC1, BR-01",
    expected: "where.brand_id = 1",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: "filters by single brand_id (AC1, BR-01)",
    result: "Pass",
  },
  {
    id: 2,
    feature: "Lọc nhiều brand OR",
    input: "GET ?brand_id=1,2",
    condition: "AC1, BR-01",
    expected: "where.brand_id Op.in [1,2]",
    type: "Positive",
    fr: "AC1 / BR-01",
    test: "filters by multiple brand_id values with Op.in (AC1, BR-01)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "Lọc CPU variation",
    input: "GET ?processor=Intel",
    condition: "AC2, BR-02",
    expected: "variations required:true; processor IN",
    type: "Positive",
    fr: "AC2 / BR-02",
    test: "requires variations join when processor filter is set (AC2, BR-02)",
    result: "Pass",
  },
  {
    id: 4,
    feature: "Sort giá tăng",
    input: "sort_by=price_asc",
    condition: "AC3",
    expected: "order base_price ASC",
    type: "Positive",
    fr: "AC3",
    test: "orders by base_price ASC when sort_by=price_asc (AC3)",
    result: "Pass",
  },
  {
    id: 5,
    feature: "Sort price_desc / newest",
    input: "sort_by param",
    condition: "AC3",
    expected: "order đúng preset",
    type: "Positive",
    fr: "AC3",
    test: "orders correctly when sort_by=%s (AC3)",
    result: "Pass",
  },
  {
    id: 6,
    feature: "Sort best_selling",
    input: "sort_by=best_selling",
    condition: "AC3",
    expected: "sold_qty DESC + created_at DESC",
    type: "Positive",
    fr: "AC3",
    test: "orders by sold_qty DESC when sort_by=best_selling (AC3)",
    result: "Pass",
  },
  {
    id: 7,
    feature: "Sort mặc định Phổ biến",
    input: "sort_by rỗng",
    condition: "BR-06",
    expected: "order created_at DESC",
    type: "Positive",
    fr: "BR-06",
    test: "defaults order to created_at DESC when sort_by is empty (BR-06)",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Lọc khoảng giá",
    input: "min_price & max_price",
    condition: "AC1",
    expected: "where.base_price gte/lte",
    type: "Positive",
    fr: "AC1",
    test: "filters base_price with min_price and max_price",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Tìm theo tên",
    input: "search=laptop",
    condition: "BR-03",
    expected: "product_name iLike %laptop%",
    type: "Positive",
    fr: "BR-03",
    test: "filters product_name with iLike when search is provided",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Phân trang",
    input: "page=2&limit=30",
    condition: "AC6",
    expected: "limit 30 offset 30; pagination object",
    type: "Positive",
    fr: "AC6",
    test: "applies page and limit to findAndCountAll (AC6)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "AND category + brand",
    input: "category_id=5&brand_id=2",
    condition: "BR-03",
    expected: "where có cả hai",
    type: "Positive",
    fr: "BR-03",
    test: "combines category_id and brand_id in where clause (BR-03)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Multi processor OR",
    input: "processor=Intel,AMD",
    condition: "BR-02",
    expected: "processor Op.in",
    type: "Positive",
    fr: "BR-02",
    test: "filters multiple processor values with Op.in (BR-02)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Filter siết → rỗng",
    input: "brand+processor+search",
    condition: "§12",
    expected: "200 products []",
    type: "Positive",
    fr: "§12",
    test: "returns 200 with empty products when no rows match filters (§12)",
    result: "Pass",
  },
  {
    id: 14,
    feature: "Lỗi DB",
    input: "findAndCountAll throw",
    condition: "errorHandler",
    expected: "500",
    type: "Negative",
    fr: "Error",
    test: "returns 500 when findAndCountAll throws",
    result: "Pass",
  },
  {
    id: 15,
    feature: "Reset page khi đổi filter",
    input: "HomePage setLocalFilters page:1",
    condition: "AC4 FE",
    expected: "N/A — FE",
    type: "Ref",
    fr: "AC4",
    test: "—",
    result: "N/A",
  },
  {
    id: 16,
    feature: "Applied chips xóa filter",
    input: "HomePage appliedChips",
    condition: "AC5 FE",
    expected: "N/A — FE",
    type: "Ref",
    fr: "AC5",
    test: "—",
    result: "N/A",
  },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_FilterSortProducts")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/catalog/FR_FilterSortProducts.md | server/__tests__/catalog/filterSortProducts.test.js"
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
    { width: 26 },
    { width: 34 },
    { width: 22 },
    { width: 44 },
    { width: 12 },
    { width: 18 },
    { width: 58 },
    { width: 14 },
  ]

  const outPath = path.join(
    __dirname,
    "../../docs/reports/UnitTest_FilterSortProducts.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
