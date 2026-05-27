# Use Case — UC-ADM-04: Quản trị đơn hàng (Admin Manage Orders)

| Thuộc tính | Giá trị |
|------------|---------|
| **ID** | UC-ADM-04 |
| **Tên** | Admin xem danh sách / chi tiết đơn, lọc tab trạng thái, đổi status thủ công |
| **Mức độ ưu tiên** | Cao |
| **Phiên bản** | Bám code hiện tại |
| **Liên quan FR** | `FR_AdminListOrders.md`, `FR_AdminViewOrderDetail.md`, `FR_AdminUpdateOrderStatus.md` |
| **Liên quan UC** | UC-ADM-01, UC-ADM-05 (ship/deliver/refund), UC-ORD-* |

---

## 1. Mô tả ngắn

Trang **`/admin/orders`** cho phép admin:

- Xem **toàn bộ đơn** (mọi user) với tab trạng thái.
- **Phân trang** server-side (`page`, `limit`).
- **Xem chi tiết** `/admin/orders/:orderId`.
- **Đổi trạng thái** tùy ý qua dropdown (`PUT .../status`) — không ràng buộc máy trạng thái chặt như ship/deliver.

Các thao tác fulfillment có nút riêng (UC-ADM-05): ship, deliver, refund.

---

## 2. Tác nhân

| Tác nhân | Vai trò |
|----------|---------|
| **Administrator** | Vận hành đơn |
| **AdminOrders.jsx** | List + detail nested |
| **adminController** | `getAllOrders`, `getOrderDetail`, `updateOrderStatus` |
| **emailService** | Email khi đổi status |

---

## 3. Preconditions

| # | Điều kiện |
|---|-----------|
| PRE-01 | UC-ADM-01 |
| PRE-02 | Có đơn trong DB (có thể 0 row) |

---

## 4. Postconditions

| # | Kết quả |
|---|---------|
| POST-01 | List trả `orders[]` + `pagination` |
| POST-02 | Detail trả `order` kèm `items`, `payment`, `user` |
| POST-03 | Update status → DB + email async (best effort) |
| POST-E01 | Order không tồn tại → 404 |

---

## 5. Trigger

- Menu **Đơn hàng** → `/admin/orders`.
- Click **Xem** → `/admin/orders/:orderId`.
- Đổi tab / trang.
- Đổi `<select>` status trên detail.

---

## 6. API Backend

### Danh sách

```http
GET /api/admin/orders?page=1&limit=20&status=processing
```

| Query | Mô tả |
|-------|--------|
| `page` | Default 1 |
| `limit` | Default 20 |
| `status` | Filter **chính xác** `Order.status` (optional) |

Response:

```json
{
  "orders": [ /* Order + user + payment */ ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

Include: `User` (username, email, full_name, phone), `Payment` (method, status, provider).

Order: **`created_at DESC`** (cố định BE).

### Chi tiết

```http
GET /api/admin/orders/:order_id
```

Include:

- `OrderItem` → `ProductVariation` → `Product`
- `Payment`
- `User`

### Cập nhật status (manual)

```http
PUT /api/admin/orders/:order_id/status
Content-Type: application/json

{ "status": "shipping" }
```

- Không validate transition.
- Gửi email `sendOrderUpdateEmail` (`changeType: 'ORDER_STATUS'`).

---

## 7. Luồng FE — Danh sách

### Tabs (`ORDER_STATUS_TABS`)

| Tab key | Label | Query `status` |
|---------|-------|----------------|
| `all` | Tất cả | (không gửi) |
| `awaiting_payment` | Chờ thanh toán | `AWAITING_PAYMENT` |
| `processing` | Chờ giao hàng | `processing` |
| `shipping` | Đang giao hàng | `shipping` |
| `delivered` | Hoàn thành | `delivered` |
| `cancelled` | Đã hủy | `cancelled` |
| `failed` | Thanh toán thất bại | `FAILED` |

Hook: `useAdminOrders({ page, limit: 20, status })` → build query string.

### Cột bảng

Mã đơn, khách (tên + email), tổng `final_amount`, badge status, ngày đặt, **Thao tác** (UC-ADM-05).

### Lọc phụ (client-only)

Trên tab `all` / `cancelled`: dropdown checkbox `statusFilters` — **lọc trên mảng đã tải**, không gọi lại API.

Ví dụ tab cancelled:

- `cancelled_not_refunded`: `status === cancelled` && `payment_status !== refunded`
- `cancelled_refunded`: ngược lại

### Sort UI (gap)

UI có `sortBy` / `sortOrder` và icon sort cột ngày — **không truyền** vào `useAdminOrders` và BE **không hỗ trợ** — thứ tự luôn `created_at DESC`.

---

## 8. Luồng FE — Chi tiết (`AdminOrderDetail`)

Route: cùng file `AdminOrders.jsx`, nếu `useParams().orderId` có → render detail.

| Khối UI | Nội dung |
|---------|----------|
| Khách hàng | `order.user` |
| Giao hàng | `shipping_name`, `shipping_phone`, `shipping_address` |
| Sản phẩm | items + ảnh thumbnail product |
| Thanh toán | method, provider, payment_status, transaction_id |
| Tóm tắt | total, shipping_fee, discount, final_amount |
| Ghi chú | `order.note` |

**Dropdown status:** mọi giá trị:

- `AWAITING_PAYMENT`, `processing`, `shipping`, `delivered`, `cancelled`, `FAILED`

`useUpdateOrderStatus` → confirm dialog → PUT status.

**Không** hiển thị nút Ship/Deliver/Refund trên trang detail — chỉ trên list theo tab.

---

## 9. Trạng thái đơn — ngữ cảnh hệ thống

| Status | Nguồn điển hình |
|--------|-----------------|
| `AWAITING_PAYMENT` | Tạo đơn VNPAY |
| `processing` | COD ngay khi tạo; VNPAY sau return success |
| `shipping` | Admin ship (UC-ADM-05) |
| `delivered` | Admin deliver |
| `cancelled` | User/admin hủy |
| `FAILED` | Thanh toán thất bại / hủy VNPAY |

Admin có thể **nhảy** status bằng dropdown (ví dụ `AWAITING_PAYMENT` → `delivered`) — bypass quy trình fulfillment.

---

## 10. So sánh với trang khách `OrdersPage`

| | Customer `/orders` | Admin `/admin/orders` |
|---|-------------------|----------------------|
| API | `GET /api/orders` | `GET /api/admin/orders` |
| Scope | `user_id = req.userId` | Tất cả users |
| Tab logic | Phức tạp (payment + status) | Filter đơn `status` |
| Actions | Hủy, retry VNPAY | Ship, deliver, refund, đổi status |

---

## 11. Email thông báo

Khi `updateOrderStatus` (và ship/deliver/refund trong UC-ADM-05):

```javascript
sendOrderUpdateEmail({
  order,
  changeType: 'ORDER_STATUS' | 'ORDER_REFUND',
  oldData, newData,
  user
})
```

Gửi **async** — lỗi email không rollback DB.

---

## 12. Sơ đồ

```mermaid
flowchart TD
  L[/admin/orders] --> T{Tab status?}
  T --> API[GET /admin/orders?status=]
  API --> TBL[Bảng đơn]
  TBL --> V[Click Xem]
  V --> D[/admin/orders/:id]
  D --> API2[GET /admin/orders/:id]
  D --> SEL[Dropdown PUT /status]
```

---

## 13. Hooks

| Hook | Endpoint |
|------|----------|
| `useAdminOrders` | GET `/admin/orders` |
| `useAdminOrderDetail` | GET `/admin/orders/:id` |
| `useUpdateOrderStatus` | PUT `/admin/orders/:id/status` |

`onSuccess` invalidate `admin-orders`, `orders`, `order-counters`.

---

## 14. Ánh xạ mã nguồn

| Thành phần | Đường dẫn |
|------------|-----------|
| UI | `client/app/pages/admin/AdminOrders.jsx` |
| Hooks | `client/app/hooks/useOrders.js` |
| Controller | `server/controllers/adminController.js` L350–470 |
| Routes | `server/routes/adminRoutes.js` L21–23 |
| Email | `server/services/emailService.js` |

---

## 15. Known gaps

| # | Gap |
|---|-----|
| GAP-01 | Sort FE **không có hiệu lực** |
| GAP-02 | `statusFilters` chỉ lọc client — tab all vẫn tải full page 20 |
| GAP-03 | `useAdminOrders` nhận `sortBy`/`sortOrder` từ page nhưng **bỏ qua** |
| GAP-04 | Detail **không** có nút ship/deliver — admin phải quay list |
| GAP-05 | `updateOrderStatus` **không** validate FSM — dễ inconsistent payment |
| GAP-06 | Tab admin **không** lọc payment_status (khác customer orders) |
| GAP-07 | Confirm ship nói 「đã giao hàng」nhưng API là **chuyển sang shipping** |

---

## 16. Tiêu chí chấp nhận

- [ ] Tab processing chỉ đơn `status=processing`
- [ ] Pagination đổi trang → đơn khác
- [ ] Detail hiển thị đủ items + payment
- [ ] Đổi status dropdown → DB đổi + list refresh
- [ ] Non-admin → 403 admin API
- [ ] Đơn không tồn tại → 404 detail
