# Use Case — UC-ORD-08: Mua ngay (Buy Now Without Full Login Flow)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | UC-ORD-08 |
| **Tên** | Mua ngay — bỏ qua giỏ, checkout intent `buy_now` |
| **Mức độ ưu tiên** | Cao |
| **Phiên bản** | Bám code hiện tại |

---

## 1. Mô tả ngắn

**“Mua ngay”** cho phép khách đặt **một variation** (đã chọn đủ cấu hình) **không thêm vào giỏ**, đi thẳng checkout với:

```javascript
navigate("/checkout", {
  state: {
    mode: "buy_now",
    items: [{ variation_id, quantity, product: { ...display only } }],
  },
});
```

| Trạng thái auth | Hành vi |
|-----------------|---------|
| **Đã login** | Navigate checkout ngay |
| **Guest** | Lưu `pendingCheckout` → `/login` → UC-ORD-07 restore |

Sau đặt hàng: **không** `removeMany` cart; BE **không** bắt buộc xóa cart (items body vẫn clear matching variations nếu trùng).

**“Without full login flow”** = không bắt buộc đi qua `/cart` và không merge vào giỏ; **vẫn cần đăng nhập** để vào `/checkout` (ProtectedRoute).

**FE:** `ProductDetailPage.handleBuyNow`  
**BE:** `createOrder` với `body.items` — giống cart subset

---

## 2. Tác nhân

| Tác nhân | Vai trò |
|----------|---------|
| **Guest / Customer** | Click “Mua ngay” |
| **ProductDetailPage** | Validate `isReady`, stock, auth branch |
| **CheckoutPage** | `intentMode === "buy_now"` |
| **Backend** | Create order từ items |

---

## 3. Preconditions

| # | Điều kiện |
|---|-----------|
| PRE-01 | PDP: `isReady && matched` variation |
| PRE-02 | Stock ≥ quantity |
| PRE-03 | Authenticated **hoặc** chấp nhận login redirect |

---

## 4. Postconditions

### Authenticated buy now

| # | Kết quả |
|---|---------|
| POST-01 | Checkout 1 dòng (có thể enrich product từ state) |
| POST-02 | Order created |
| POST-03 | Cart Redux **không** bị `removeMany` |
| POST-04 | VNPAY redirect hoặc COD success |

### Guest buy now

| # | Kết quả |
|---|---------|
| POST-G01 | `pendingCheckout` trong LS |
| POST-G02 | Sau login → checkout restore (UC-ORD-07) |

---

## 5. Trigger

Click **“Mua ngay”** trên `ProductDetailPage`.

---

## 6. Luồng chính — User đã đăng nhập

| Bước | Hành động |
|------|-----------|
| 1 | `getValidationReason()` — nếu lỗi → alert |
| 2 | `if (!isReady) return` |
| 3 | `qty = max(1, quantity)` |
| 4 | `navigate('/checkout', { state: { mode: 'buy_now', items: [...] }})` |
| 5 | CheckoutPage: `viewItems` — `product` từ state nếu không có trong cart Map |
| 6 | Preview + submit như order thường |
| 7 | Success handler **không** vào block `intentMode === 'cart'` |

### Item payload (display snapshot)

```javascript
items: [{
  variation_id: matched.variation_id,
  quantity: qty,
  product: {
    product_name: product.product_name,
    thumbnail_url: product.thumbnail_url,
    discount_percentage: product.discount_percentage,
    variation: { price: Number(matched.price) },
  },
}],
```

---

## 7. Luồng chính — Guest

| Bước | Hành động |
|------|-----------|
| 1 | Cùng validation stock/config |
| 2 | Build `checkoutData` + `timestamp: Date.now()` |
| 3 | `localStorage.setItem('pendingCheckout', JSON.stringify(...))` |
| 4 | `navigate('/login?redirect=/checkout')` |
| 5 | Login/OAuth → UC-ORD-07 |

---

## 8. So sánh với “Thêm giỏ”

| | Thêm giỏ (auth) | Mua ngay (auth) | Mua ngay (guest) |
|--|-----------------|-----------------|------------------|
| API cart | `POST /cart` | Không | Không |
| Checkout mode | Thường qua cart page | `buy_now` | pending → `buy_now` |
| Cart Redux | Cập nhật | Không đổi | Không |
| Sau COD | removeMany nếu cart mode | Không removeMany | Không |

---

## 9. Luồng thay thế

### AF-01: Cùng variation đã có trong giỏ

Buy now vẫn tạo order từ items body; BE có thể `CartItem.destroy` variation đó — dòng cart biến mất dù FE không removeMany.

### AF-02: ProtectedRoute checkout

Guest **không** vào được `/checkout` trực tiếp URL — phải login.

### AF-03: Add to cart guest

Cũng lưu `pendingCheckout` nhưng message flow giống buy now — không qua cart page.

---

## 10. Luồng ngoại lệ

### EF-01: Chưa chọn cấu hình

`if (!isReady) return` — silent (buy now) vs alert (add to cart).

### EF-02: `getValidationReason`

Alert localized reason (stock, config).

### EF-03: Checkout refresh

Mất `location.state` → redirect `/cart` — mất buy now intent.

---

## 11. Quy tắc nghiệp vụ

| ID | Quy tắc |
|----|---------|
| BR-01 | Buy now = **single intent** qua router state, không global store |
| BR-02 | Giá submit từ **DB** — snapshot product chỉ UI |
| BR-03 | `mode: buy_now` tắt post-submit cart cleanup FE |
| BR-04 | Vẫn yêu cầu map + địa chỉ đầy đủ trên checkout |

---

## 12. Validation helpers (PDP)

| Check | Mô tả |
|-------|--------|
| `isReady` | `matched && allSelected` |
| `matched` | Variation khớp `sel` attrs |
| Stock | `qty <= stock_quantity` |

---

## 13. Triển khai

| File | Vai trò |
|------|---------|
| `client/app/pages/ProductDetailPage.jsx` | `handleBuyNow` |
| `client/app/pages/CheckoutPage.jsx` | `intentMode`, skip removeMany |
| `server/controllers/orderController.js` | `createOrder(items)` |
| `docs/use_cases/cart/UC_AddProductToCart.md` | Contrast |

---

## 14. Sơ đồ

```mermaid
flowchart TD
  A[Click Mua ngay] --> B{Authenticated?}
  B -->|Yes| C[navigate checkout buy_now]
  B -->|No| D[save pendingCheckout]
  D --> E[/login]
  E --> F[Restore state]
  F --> C
  C --> G[POST /orders]
```

---

## 15. Liên kết

| UC / FR |
|---------|
| UC-ORD-07 RestorePendingCheckoutAfterLogin |
| UC-ORD-06 CheckoutFromSelectedCartItems |
| UC-CAT-05 SelectProductConfiguration |
| `FR_CreateOrder.md` |

---

## 16. Known gaps

| # | Mô tả |
|---|--------|
| GAP-01 | Tên UC “without full login” — vẫn **bắt buộc login** trước checkout |
| GAP-02 | `!isReady` return im lặng trên buy now |
| GAP-03 | Không deep-link `?variation_id=` cho buy now |
| GAP-04 | Guest add-to-cart dùng cùng pending shape `buy_now` |
