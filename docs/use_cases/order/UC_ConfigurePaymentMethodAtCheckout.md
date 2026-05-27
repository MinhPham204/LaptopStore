# Use Case — UC-ORD-04: Chọn phương thức thanh toán (Configure Payment Method At Checkout)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | UC-ORD-04 |
| **Tên** | Chọn COD hoặc VNPAY trên trang checkout |
| **Mức độ ưu tiên** | Cao |
| **Phiên bản** | Bám code hiện tại |

---

## 1. Mô tả ngắn

Trên **`CheckoutPage`**, khối **“Phương thức thanh toán”** dùng component **`PaymentOptions`**: hai lựa chọn **COD** và **VNPAY**. State `payment` được gửi trong `POST /orders` as `payment_provider` + `payment_method`.

**Mặc định:** `{ payment_provider: "COD", payment_method: "COD" }`  
**Khi chọn VNPAY:** `payment_method` auto = **`VNPAYQR`** (UI con ẩn)

**FE:** `PaymentOptions.jsx`, `CheckoutPage` state  
**BE:** validate `VALID` map trong `createOrder`

---

## 2. Tác nhân

| Tác nhân | Vai trò |
|----------|---------|
| **Customer** | Chọn hình thức thanh toán |
| **CheckoutPage** | `setPayment` callback |
| **Backend** | Reject invalid provider/method pairs |

---

## 3. Preconditions

| # | Điều kiện |
|---|-----------|
| PRE-01 | User trên `/checkout` với intent hợp lệ |
| PRE-02 | Form shipping đủ điều kiện submit (tách UC) |

---

## 4. Postconditions

| # | Kết quả |
|---|---------|
| POST-01 | `payment` state cập nhật |
| POST-02 | Submit gửi đúng cặp provider/method |
| POST-03 | COD → order `status: processing` |
| POST-04 | VNPAY → order `status: AWAITING_PAYMENT` + `redirect` URL |

---

## 5. Trigger

Click card COD hoặc VNPAY trong `PaymentOptions`.

---

## 6. Component logic

```javascript
const VNPAY_METHODS = [
  { key: "VNPAYQR", label: "Quét mã VNPAY-QR" },
  { key: "VNBANK", label: "Thẻ nội địa" },
  { key: "INTCARD", label: "Thẻ quốc tế" },
  { key: "INSTALLMENT", label: "Trả góp" },
];

const selectProvider = (p) => {
  setProvider(p);
  const m = p === "COD" ? "COD" : "VNPAYQR";
  setMethod(m);
  onChange({ payment_provider: p, payment_method: m });
};
```

**UI hiện tại:** chỉ 2 nút provider — **không render** danh sách `VNPAY_METHODS` (comment: “Ẩn phần chọn phương thức VNPAY con”).

---

## 7. Luồng chính — COD

| Bước | Hành động |
|------|-----------|
| 1 | User chọn “Thanh toán khi nhận hàng (COD)” |
| 2 | `payment = { provider: "COD", method: "COD" }` |
| 3 | Submit → BE `status = processing`, `reserve_expires_at = null` |
| 4 | Success → `/checkout/success` |

---

## 8. Luồng chính — VNPAY

| Bước | Hành động |
|------|-----------|
| 1 | User chọn “VNPAY” |
| 2 | `payment_method = "VNPAYQR"` (mặc định) |
| 3 | Submit → order `AWAITING_PAYMENT`, `reserve_expires_at` +24h |
| 4 | BE `getPaymentUrl` → `redirect` |
| 5 | FE `window.location.href = res.redirect` |
| 6 | User thanh toán trên cổng VNPAY |
| 7 | Return URL → `vnpayController` → FE `VnpayReturn` |

---

## 9. Backend validation

```javascript
const VALID = {
  COD: ["COD"],
  VNPAY: ["VNPAYQR", "VNBANK", "INTCARD", "INSTALLMENT"],
};
```

| Lỗi | Response |
|-----|----------|
| Provider không hỗ trợ | 400 `Unsupported payment_provider` |
| Method không khớp provider | 400 `Invalid payment_method` |

---

## 10. Luồng thay thế

### AF-01: Đổi payment sau khi tạo đơn

`POST /orders/:order_id/payment-method` — `changePaymentMethod` (ngoài checkout, FR riêng).

### AF-02: Retry VNPAY từ OrdersPage

`POST /orders/:id/payments/retry` body `{ method: "VNPAYQR" }` — user có thể đổi method ở đây dù UI checkout ẩn.

---

## 11. Quy tắc nghiệp vụ

| ID | Quy tắc |
|----|---------|
| BR-01 | Một order một `Payment` record tại create |
| BR-02 | VNPAY bắt buộc ENV (`VNP_TMN_CODE` trong createOrder check — có thể lệch tên `VNPAY_*` trong service — GAP) |
| BR-03 | COD không redirect |
| BR-04 | `payment_status` ban đầu = `pending` cho cả hai |

---

## 12. Submit payload excerpt

```javascript
{
  payment_provider: payment.payment_provider,
  payment_method: payment.payment_method,
  // ...
}
```

---

## 13. Triển khai

| File | Vai trò |
|------|---------|
| `client/app/components/PaymentOptions.jsx` | UI chọn |
| `client/app/pages/CheckoutPage.jsx` | State + submit |
| `server/controllers/orderController.js` | Validation + branch VNPAY |
| `server/services/vnpayService.js` | Build pay URL |
| `server/controllers/vnpayController.js` | Return handler |

---

## 14. Known gaps

| # | Mô tả |
|---|--------|
| GAP-01 | Không chọn sub-method VNPAY trên checkout (luôn VNPAYQR) |
| GAP-02 | ENV check `VNP_*` vs `vnpayService` dùng `VNPAY_*` — có thể 502 config |
| GAP-03 | `PaymentOptions` không gọi `onChange` lúc mount — mặc định COD đúng với state parent |
| GAP-04 | Không hiển thị phí VNPAY / installment info |
