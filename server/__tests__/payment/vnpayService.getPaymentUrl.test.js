const qs = require("qs")

const ENV_KEYS = [
  "VNPAY_TMN_CODE",
  "VNPAY_SECRET_KEY",
  "VNPAY_URL",
  "VNPAY_RETURN_URL",
  "VNP_TMN_CODE",
  "VNP_HASHSECRET",
  "VNP_RETURNURL",
  "VNP_PAYURL",
]

function snapshotEnv() {
  const saved = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
  }
  return saved
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

function setTestVnpayEnv(overrides = {}) {
  process.env.VNPAY_TMN_CODE = overrides.tmnCode ?? "UNITTEST_TMN"
  process.env.VNPAY_SECRET_KEY = overrides.secretKey ?? "unit-test-secret-key-32chars!!"
  process.env.VNPAY_URL = overrides.vnpUrl ?? "https://sandbox.test.vnpay/paymentv2/vpcpay.html"
  process.env.VNPAY_RETURN_URL =
    overrides.returnUrl ?? "http://localhost:5000/api/vnpay/return"
}

function loadVnpayService() {
  jest.resetModules()
  return require("../../services/vnpayService")
}

function parsePaymentUrl(url) {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : ""
  return qs.parse(query)
}

describe("vnpayService.getPaymentUrl", () => {
  let savedEnv

  beforeEach(() => {
    savedEnv = snapshotEnv()
    setTestVnpayEnv()
  })

  afterEach(() => {
    restoreEnv(savedEnv)
    jest.resetModules()
  })

  // FR: AC §5 — URL có SecureHash, TxnRef, Amount×100, ReturnUrl backend, Command pay
  it("builds payment URL with vnp_SecureHash, TxnRef, Amount×100, ReturnUrl and Command pay", async () => {
    const { getPaymentUrl } = loadVnpayService()
    const txnRef = "42-1700000000000"
    const amount = 22530000

    const url = await getPaymentUrl({
      amount,
      txnRef,
      orderDesc: "Thanh toan don hang #42",
      ipAddr: "203.0.113.10",
    })

    expect(url).toMatch(/^https:\/\/sandbox\.test\.vnpay\/paymentv2\/vpcpay\.html\?/)

    const params = parsePaymentUrl(url)
    expect(params.vnp_SecureHash).toEqual(expect.any(String))
    expect(params.vnp_SecureHash.length).toBeGreaterThan(0)
    expect(params.vnp_TxnRef).toBe(txnRef)
    expect(params.vnp_Amount).toBe(String(Math.round(amount * 100)))
    expect(params.vnp_ReturnUrl).toBe("http://localhost:5000/api/vnpay/return")
    expect(params.vnp_Command).toBe("pay")
    expect(params.vnp_TmnCode).toBe("UNITTEST_TMN")
    expect(params.vnp_Version).toBe("2.1.0")
    expect(params.vnp_CurrCode).toBe("VND")
  })

  // FR: GAP-02 — method không map vnp_BankCode (code đã comment)
  it("does not add vnp_BankCode when method is VNBANK, VNPAYQR or INTCARD", async () => {
    const { getPaymentUrl } = loadVnpayService()

    for (const method of ["VNBANK", "VNPAYQR", "INTCARD"]) {
      const url = await getPaymentUrl({
        method,
        amount: 100000,
        txnRef: `99-${method}`,
        ipAddr: "127.0.0.1",
      })
      const params = parsePaymentUrl(url)
      expect(params.vnp_BankCode).toBeUndefined()
    }
  })

  // FR: GAP-01 §4 — createOrder kiểm tra VNP_* nhưng service đọc VNPAY_*
  it("reads VNPAY_* env only; VNP_* alone does not override service config (GAP-01)", async () => {
    delete process.env.VNPAY_TMN_CODE
    process.env.VNP_TMN_CODE = "ONLY_VNP_PREFIX"
    const { getPaymentUrl } = loadVnpayService()

    const url = await getPaymentUrl({
      amount: 50000,
      txnRef: "1-gap",
      ipAddr: "127.0.0.1",
    })
    const params = parsePaymentUrl(url)
    // Default sandbox tmn when VNPAY_TMN_CODE unset — not ONLY_VNP_PREFIX
    expect(params.vnp_TmnCode).toBe("XGEX2VEC")
    expect(params.vnp_TmnCode).not.toBe("ONLY_VNP_PREFIX")

    setTestVnpayEnv({ tmnCode: "FROM_VNPAY_PREFIX" })
    const { getPaymentUrl: getPaymentUrl2 } = loadVnpayService()
    const url2 = await getPaymentUrl2({
      amount: 50000,
      txnRef: "2-gap",
      ipAddr: "127.0.0.1",
    })
    expect(parsePaymentUrl(url2).vnp_TmnCode).toBe("FROM_VNPAY_PREFIX")
  })

  // FR: §5 — ipAddr mặc định khi không truyền
  it("defaults vnp_IpAddr to 127.0.0.1 when ipAddr is omitted", async () => {
    const { getPaymentUrl } = loadVnpayService()
    const url = await getPaymentUrl({
      amount: 1000,
      txnRef: "3-default-ip",
    })
    expect(parsePaymentUrl(url).vnp_IpAddr).toBe("127.0.0.1")
  })
})
