/**
 * Generates docs/reports/admin/UnitTest_MapPickerAddressConfirmation.xlsx
 * Usage: node scripts/generateUnitTestMapPickerAddressConfirmationReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const rows = [
  {
    id: 1,
    feature: "Default center HCMC",
    input: "MapPicker value=null",
    condition: "§4",
    expected: "MapContainer center [10.776, 106.7]; zoom 15",
    type: "Positive",
    fr: "§4",
    test: "uses HCMC default center when value is null (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 2,
    feature: "Center theo value",
    input: "value { lat, lng }",
    condition: "§4",
    expected: "MapContainer + Marker position khớp value",
    type: "Positive",
    fr: "§4",
    test: "centers MapContainer on value when provided (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 3,
    feature: "Click map",
    input: "simulate map click",
    condition: "§4",
    expected: "onChange(latlng); hiện marker",
    type: "Positive",
    fr: "§4",
    test: "calls onChange when map is clicked (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 4,
    feature: "Drag marker",
    input: "simulate dragend",
    condition: "§4",
    expected: "onChange tọa độ mới",
    type: "Positive",
    fr: "§4",
    test: "calls onChange when marker is dragged (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 5,
    feature: "Nút xác nhận",
    input: "value có; click Xác nhận vị trí",
    condition: "§4",
    expected: "onConfirm(value)",
    type: "Positive",
    fr: "§4",
    test: "calls onConfirm with current value when confirm is clicked (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 6,
    feature: "RecenterOnLocation",
    input: "đổi value prop",
    condition: "§4",
    expected: "map.setView([lat,lng], 17)",
    type: "Positive",
    fr: "§4",
    test: "recenters map when value changes (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 7,
    feature: "Confirm disabled",
    input: "value=null",
    condition: "§4",
    expected: "nút disabled",
    type: "Negative",
    fr: "§4",
    test: "disables confirm button when value is missing (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 8,
    feature: "onConfirm không gọi",
    input: "click confirm khi !value",
    condition: "§4",
    expected: "onConfirm không được gọi",
    type: "Negative",
    fr: "§4",
    test: "does not call onConfirm when value is missing (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 9,
    feature: "onConfirm optional",
    input: "không truyền onConfirm",
    condition: "§4",
    expected: "click không throw",
    type: "Negative",
    fr: "§4",
    test: "does not throw when onConfirm is omitted and confirm is clicked (§4)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 10,
    feature: "Checkout submit + geo",
    input: "confirm map → Đặt hàng",
    condition: "§5, AC",
    expected: "mutateAsync có geo_lat, geo_lng",
    type: "Positive",
    fr: "§5 / AC",
    test: "enables submit and sends geo_lat/geo_lng after map confirm (§5, AC)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 11,
    feature: "Banner success",
    input: "onConfirm checkout",
    condition: "§5",
    expected: "banner Đã xác nhận vị trí + tọa độ",
    type: "Positive",
    fr: "§5",
    test: "shows success banner with coordinates after map confirm (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 12,
    feature: "Submit gate",
    input: "đủ form; chưa confirm map",
    condition: "§5",
    expected: "Đặt hàng disabled; không createOrder",
    type: "Negative",
    fr: "§5",
    test: "keeps submit disabled when map is not confirmed (§5)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 13,
    feature: "Reset sau onChange",
    input: "confirm rồi map onChange",
    condition: "§7",
    expected: "submit disabled lại",
    type: "Negative",
    fr: "§7",
    test: "disables submit again after marker onChange following confirm (§7)",
    result: "Pass",
    layer: "Client",
  },
  {
    id: 14,
    feature: "Thiếu geo",
    input: "POST /orders geo_lat/lng null",
    condition: "§8",
    expected: "400 Vui lòng xác nhận vị trí trên bản đồ",
    type: "Negative",
    fr: "§8",
    test: "returns 400 when geo coordinates are missing (§5) — createOrder.test.js",
    result: "Pass",
    layer: "Server",
  },
  {
    id: 15,
    feature: "Props center/zoom/flyTo",
    input: "CheckoutPage truyền center, zoom",
    condition: "GAP-01",
    expected: "MapPicker không đọc props; geocode không fly map",
    type: "Ref",
    fr: "GAP-01",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 16,
    feature: "Hai nút xác nhận dialog",
    input: "EditShippingAddressDialog",
    condition: "GAP-02",
    expected: "MapPicker + nút ngoài; dễ nhầm",
    type: "Ref",
    fr: "GAP-02",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 17,
    feature: "onConfirm noop dialog",
    input: "MapPicker không onConfirm trong dialog",
    condition: "GAP-03",
    expected: "Nút nội bộ không set locationConfirmed",
    type: "Ref",
    fr: "GAP-03",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 18,
    feature: "Không reverse geocode drag",
    input: "kéo marker",
    condition: "GAP-04",
    expected: "address text có thể lệch marker",
    type: "Ref",
    fr: "GAP-04",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 19,
    feature: "Không validate bbox VN",
    input: "tọa độ bất kỳ",
    condition: "GAP-05",
    expected: "BE/FE không kiểm bounding box",
    type: "Ref",
    fr: "GAP-05",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
  {
    id: 20,
    feature: "geoFallbackToWardCenter",
    input: "GET /geo/wards/:id/centroid",
    condition: "GAP-06",
    expected: "Dead code; API không tồn tại",
    type: "Ref",
    fr: "GAP-06",
    test: "—",
    result: "N/A",
    layer: "Ref",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/reports/admin")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_MapPickerConfirm")

  sheet.mergeCells("A1:J1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/shipping/FR_MapPickerAddressConfirmation.md | MapPicker.test.jsx | CheckoutPage.mapConfirm.test.jsx | Server ref: createOrder.test.js"
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
    { width: 28 },
    { width: 40 },
    { width: 18 },
    { width: 44 },
    { width: 12 },
    { width: 14 },
    { width: 58 },
    { width: 14 },
    { width: 10 },
  ]

  const outPath = path.join(outDir, "UnitTest_MapPickerAddressConfirmation.xlsx")
  await workbook.xlsx.writeFile(outPath)
  console.log("Wrote", outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
