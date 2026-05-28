const crypto = require("crypto")
const qs = require("qs")

const ENV_KEYS = ["VNPAY_SECRET_KEY"]

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

function sortObject(obj) {
  const sorted = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+")
  }
  return sorted
}

function signVnpParams(params, secretKey) {
  const sortedParams = sortObject(params)
  const signData = qs.stringify(sortedParams, { encode: false })
  return crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex")
}

function loadVnpayService() {
  jest.resetModules()
  process.env.VNPAY_SECRET_KEY = "unit-test-verify-secret-key!!"
  return require("../../services/vnpayService")
}

describe("vnpayService.verifyReturnUrl", () => {
  let savedEnv
  const secretKey = "unit-test-verify-secret-key!!"

  beforeEach(() => {
    savedEnv = snapshotEnv()
  })

  afterEach(() => {
    restoreEnv(savedEnv)
    jest.resetModules()
  })

  const baseReturnParams = () => ({
    vnp_TxnRef: "42-1710000000000",
    vnp_ResponseCode: "00",
    vnp_Amount: "2253000000",
    vnp_BankCode: "NCB",
    vnp_OrderInfo: "Thanh toan don hang #42",
  })

  // FR: BR-01 — response 00 + hash đúng → isSuccess true
  it("returns isSuccess true when hash matches and vnp_ResponseCode is 00", () => {
    const { verifyReturnUrl } = loadVnpayService()
    const params = baseReturnParams()
    const hash = signVnpParams(params, secretKey)

    const result = verifyReturnUrl({ ...params, vnp_SecureHash: hash })

    expect(result.isSuccess).toBe(true)
    expect(result.vnp_Params.vnp_TxnRef).toBe("42-1710000000000")
    expect(result.vnp_Params.vnp_SecureHash).toBeUndefined()
  })

  // FR: BR-01 — response khác 00 → isSuccess false
  it("returns isSuccess false when vnp_ResponseCode is not 00", () => {
    const { verifyReturnUrl } = loadVnpayService()
    const params = { ...baseReturnParams(), vnp_ResponseCode: "24" }
    const hash = signVnpParams(params, secretKey)

    const result = verifyReturnUrl({ ...params, vnp_SecureHash: hash })

    expect(result.isSuccess).toBe(false)
  })

  // FR: §7 — hash sai → isSuccess false
  it("returns isSuccess false when vnp_SecureHash does not match", () => {
    const { verifyReturnUrl } = loadVnpayService()
    const params = baseReturnParams()

    const result = verifyReturnUrl({ ...params, vnp_SecureHash: "invalid-hash" })

    expect(result.isSuccess).toBe(false)
  })

  // FR: §4 — vnp_SecureHashType không tham gia ký
  it("ignores vnp_SecureHashType when verifying signature", () => {
    const { verifyReturnUrl } = loadVnpayService()
    const params = baseReturnParams()
    const hash = signVnpParams(params, secretKey)

    const result = verifyReturnUrl({
      ...params,
      vnp_SecureHash: hash,
      vnp_SecureHashType: "SHA512",
    })

    expect(result.isSuccess).toBe(true)
  })
})
