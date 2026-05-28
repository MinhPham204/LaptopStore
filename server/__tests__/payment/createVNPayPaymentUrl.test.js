const request = require("supertest")
const express = require("express")

jest.mock("../../services/vnpayService", () => ({
  getPaymentUrl: jest.fn(),
  verifyReturnUrl: jest.fn(),
}))

const { getPaymentUrl } = require("../../services/vnpayService")
const vnpayRoutes = require("../../routes/vnpayRoutes")

const app = express()
app.use(express.json())
app.use("/api", vnpayRoutes)

const CREATE_URL = "/api/vnpay/create_payment_url"

describe("POST /api/vnpay/create_payment_url (createPayment)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // FR: AC §6 standalone API — 200 { url }, txnRef orderId-timestamp, không auth
  it("returns 200 with url and txnRef orderId-timestamp without Authorization header", async () => {
    const fakeUrl =
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_SecureHash=abc&vnp_TxnRef=123-1"
    getPaymentUrl.mockResolvedValue(fakeUrl)

    const res = await request(app)
      .post(CREATE_URL)
      .send({ orderId: "123", amount: 22530000 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: fakeUrl })
    expect(getPaymentUrl).toHaveBeenCalledTimes(1)
    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 22530000,
        txnRef: expect.stringMatching(/^123-\d+$/),
        orderDesc: "Thanh toan don hang #123",
        ipAddr: expect.any(String),
      })
    )
  })

  // FR: §6 — x-forwarded-for được dùng làm ipAddr
  it("passes first x-forwarded-for value as ipAddr", async () => {
    getPaymentUrl.mockResolvedValue("https://sandbox.vnpay/pay?x=1")

    await request(app)
      .post(CREATE_URL)
      .set("x-forwarded-for", "203.0.113.5, 10.0.0.1")
      .send({ orderId: "7", amount: 1000 })

    expect(getPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: "203.0.113.5" })
    )
  })

  describe("validation — 400", () => {
    // FR: §6 Errors — thiếu orderId hoặc amount
    it('returns 400 "Thiếu orderId hoặc amount" when orderId is missing', async () => {
      const res = await request(app)
        .post(CREATE_URL)
        .send({ amount: 1000 })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe("Thiếu orderId hoặc amount")
      expect(getPaymentUrl).not.toHaveBeenCalled()
    })

    it('returns 400 "Thiếu orderId hoặc amount" when amount is missing', async () => {
      const res = await request(app)
        .post(CREATE_URL)
        .send({ orderId: "123" })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe("Thiếu orderId hoặc amount")
      expect(getPaymentUrl).not.toHaveBeenCalled()
    })
  })

  // FR: §6 Errors — 500 khi getPaymentUrl throws
  it('returns 500 "Lỗi tạo link thanh toán" when getPaymentUrl throws', async () => {
    getPaymentUrl.mockRejectedValue(new Error("sign failed"))

    const res = await request(app)
      .post(CREATE_URL)
      .send({ orderId: "123", amount: 50000 })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe("Lỗi tạo link thanh toán")
  })

  // createOrder / retry / changePM — xem FR_VNPayPaymentInCreateOrder, FR_RetryVNPayPayment, FR_ChangePaymentMethod
})
