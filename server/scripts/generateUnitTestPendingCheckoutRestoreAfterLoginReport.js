/**
 * Generates docs/report/order/UnitTest_PendingCheckoutRestoreAfterLogin.xlsx
 * Usage: node scripts/generateUnitTestPendingCheckoutRestoreAfterLoginReport.js
 */
const path = require("path")
const fs = require("fs")
const ExcelJS = require("exceljs")

const NA = "N/A (FE-only)"

const rows = [
  {
    id: 1,
    feature: "OAuth đăng nhập thành công",
    input: "token + /auth/me OK, không pending",
    condition: "§6.2",
    expected: "setCredentials + navigate / replace",
    type: "Positive",
    fr: "§6.2",
    test: "sets credentials and navigates to home when token and /me succeed",
    result: "Pass",
  },
  {
    id: 2,
    feature: "OAuth restore checkout",
    input: "pendingCheckout mode=buy_now + items",
    condition: "§6.2 / §4",
    expected: "navigate /checkout state đầy đủ; removeItem",
    type: "Positive",
    fr: "§6.2 / §4",
    test: "navigates to checkout with buy_now pending state (mode + items) after OAuth (§6.2)",
    result: "Pass",
  },
  {
    id: 3,
    feature: "OAuth thiếu token",
    input: "không token query",
    condition: "§6.2",
    expected: "navigate /login?oauth=missing",
    type: "Negative",
    fr: "§6.2",
    test: "navigates to login with oauth=missing when token is absent",
    result: "Pass",
  },
  {
    id: 4,
    feature: "OAuth /me lỗi",
    input: "/auth/me reject",
    condition: "§6.2",
    expected: "navigate /login?oauth=failed",
    type: "Negative",
    fr: "§6.2",
    test: "navigates to login with oauth=failed when /me rejects",
    result: "Pass",
  },
  {
    id: 5,
    feature: "OAuth replace home",
    input: "success không pending",
    condition: "§6.2",
    expected: "navigate / với replace: true",
    type: "Positive",
    fr: "§6.2",
    test: "uses replace true when navigating to home after success",
    result: "Pass",
  },
  {
    id: 6,
    feature: "OAuth replace checkout",
    input: "success có pending",
    condition: "§6.2",
    expected: "navigate /checkout với replace: true",
    type: "Positive",
    fr: "§6.2",
    test: "uses replace true when navigating to checkout after success",
    result: "Pass",
  },
  {
    id: 7,
    feature: "OAuth JSON lỗi",
    input: "pendingCheckout invalid JSON",
    condition: "§6.2",
    expected: "về /; giữ key lỗi",
    type: "Negative",
    fr: "§6.2",
    test: "navigates to home when pendingCheckout JSON is invalid",
    result: "Pass",
  },
  {
    id: 8,
    feature: "Login restore checkout",
    input: "mutateAsync OK + pending buy_now",
    condition: "§6.1",
    expected: "navigate /checkout { state }",
    type: "Positive",
    fr: "§6.1",
    test: "navigates to checkout with pending state after successful login (§6.1)",
    result: "Pass",
  },
  {
    id: 9,
    feature: "Ưu tiên pending > redirect",
    input: "pending + ?redirect=/cart",
    condition: "§6.1",
    expected: "checkout state, không /cart",
    type: "Positive",
    fr: "§6.1",
    test: "prefers pendingCheckout over redirect query param (§6.1)",
    result: "Pass",
  },
  {
    id: 10,
    feature: "Xóa pending sau restore",
    input: "login OK + pending",
    condition: "§6.1",
    expected: "localStorage pendingCheckout null",
    type: "Positive",
    fr: "§6.1",
    test: "removes pendingCheckout from localStorage after restore (§6.1)",
    result: "Pass",
  },
  {
    id: 11,
    feature: "Login JSON lỗi",
    input: "pendingCheckout invalid",
    condition: "§6.3",
    expected: "navigate redirect; không xóa key",
    type: "Negative",
    fr: "§6.3",
    test: "falls back to redirect when pendingCheckout JSON is invalid (§6.3)",
    result: "Pass",
  },
  {
    id: 12,
    feature: "Login chỉ redirect",
    input: "không pending; ?redirect=/checkout",
    condition: "§6.3",
    expected: "navigate /checkout không state",
    type: "Positive",
    fr: "§6.3",
    test: "navigates to redirect query when no pendingCheckout (§6.3)",
    result: "Pass",
  },
  {
    id: 13,
    feature: "Login mặc định home",
    input: "không pending, không redirect",
    condition: "§6.3",
    expected: 'navigate "/"',
    type: "Positive",
    fr: "§6.3",
    test: 'navigates to "/" when no pending and no redirect (§6.3)',
    result: "Pass",
  },
  {
    id: 14,
    feature: "Login thất bại",
    input: "mutateAsync reject + pending",
    condition: "§6.3",
    expected: "không navigate; giữ pending",
    type: "Negative",
    fr: "§6.3",
    test: "does not restore checkout when login fails",
    result: "Pass",
  },
  {
    id: 15,
    feature: "App TTL xóa cũ",
    input: "isAuthenticated; timestamp >5p",
    condition: "§7 BR-02",
    expected: "removeItem pendingCheckout",
    type: "Positive",
    fr: "§7 / BR-02",
    test: "removes pendingCheckout older than 5 minutes when authenticated (§7, BR-02)",
    result: "Pass",
  },
  {
    id: 16,
    feature: "App TTL giữ mới",
    input: "timestamp <5p",
    condition: "§7",
    expected: "giữ nguyên payload",
    type: "Positive",
    fr: "§7",
    test: "keeps pendingCheckout younger than 5 minutes when authenticated (§7)",
    result: "Pass",
  },
  {
    id: 17,
    feature: "App TTL không timestamp",
    input: "payload không timestamp",
    condition: "§7 BR-01",
    expected: "removeItem (coi timestamp=0)",
    type: "Positive",
    fr: "§7 / BR-01",
    test: "removes pendingCheckout without timestamp when authenticated (§7, BR-01)",
    result: "Pass",
  },
  {
    id: 18,
    feature: "Logout xóa pending",
    input: "useLogout()",
    condition: "§7",
    expected: "localStorage pendingCheckout null",
    type: "Positive",
    fr: "§7",
    test: "removes pendingCheckout from localStorage on logout (§7)",
    result: "Pass",
  },
]

async function main() {
  const outDir = path.join(__dirname, "../../docs/report/order")
  fs.mkdirSync(outDir, { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("UnitTest_PendingCheckout")

  sheet.mergeCells("A1:I1")
  sheet.getCell("A1").value =
    "FR: docs/feature_requirements/orders/FR_PendingCheckoutRestoreAfterLogin.md | FE-only (localStorage + navigate) | Backend: N/A"
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

  sheet.addRow([])
  sheet.addRow([
    "",
    "Backend API",
    NA,
    NA,
    NA,
    NA,
    "FR",
    "Không có API server cho feature này",
    NA,
  ])

  sheet.columns.forEach((col) => {
    col.width = 22
  })
  sheet.getColumn(8).width = 52

  const outPath = path.join(
    outDir,
    "UnitTest_PendingCheckoutRestoreAfterLogin.xlsx"
  )
  await workbook.xlsx.writeFile(outPath)
  console.log(`Wrote ${outPath} (${rows.length} test rows + backend N/A note)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
