# Functional Requirement (FR) — Callback Frontend sau OAuth / Xác minh Email (OAuth Success Page)

## 1. Feature Overview

Route frontend **`/oauth/success`** (`OAuthSuccess.jsx`) là **điểm hạ cánh thống nhất** sau khi backend redirect kèm **JWT phiên làm việc (session JWT)** trong query parameter `token`. Trang này:

1. Đọc `token` từ URL.
2. Gắn `Authorization: Bearer` trên axios instance + `localStorage.setItem("token", token)`.
3. Gọi **`GET /api/auth/me`** để lấy object `user` đầy đủ.
4. `dispatch(setCredentials({ token, user }))` — đồng bộ Redux + `localStorage` user (qua reducer).
5. Điều hướng: hoặc **`/checkout`** (nếu có `pendingCheckout` hợp lệ), hoặc **`/`**.

**Nguồn redirect tới `/oauth/success?token=` trong đồ án:**

| Nguồn | Backend | Ghi chú |
|-------|---------|---------|
| Google OAuth callback | `authSocialRoutes` | `302` → `FE_APP_URL/oauth/success?token=...` |
| Facebook OAuth callback | `authSocialRoutes` | Giống trên |
| Xác minh email (GET verify) | `authController.verifyEmail` | Sau kích hoạt `is_active`, redirect **`/oauth/success?token=sessionJwt`** (cùng pattern “session do máy chủ phát”) |

Tên file FR có chữ OAuth, nhưng **scope thực tế là trang nhận session JWT**: mọi flow backend phát JWT và redirect tới URL này đều dùng chung logic FE.

---

## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **User** | Vừa hoàn tất OAuth hoặc bấm link xác nhận email |
| **Browser** | Theo redirect HTTP 302 |
| **Frontend** | Component `OAuthSuccess` |
| **API** | `GET /api/auth/me` |

---

## 3. Routing

```text
client/app/App.jsx → <Route path="oauth/success" element={<OAuthSuccess />} />
```

Route nằm trong cấu trúc con của `Layout` (cùng cấp với `/login`), nên UX có Header/Footer trong lúc hiển thị “Đang hoàn tất đăng nhập...”. Route **không** yêu cầu `ProtectedRoute`.

---

## 4. Thuật toán (`OAuthSuccess.jsx`)

### Success path

```text
token = searchParams.get("token")
→ set axios default Authorization Bearer
→ localStorage.token = token
→ GET /auth/me (baseURL chứa /api)
→ setCredentials({ token, user: data.user })
→ if pendingCheckout: navigate("/checkout", { state, replace }) ; return
→ navigate("/", { replace: true })
```

### Error paths

| Điều kiện | Đích |
|-----------|------|
| `GET /auth/me` reject | `navigate("/login?oauth=failed", { replace: true })` |
| Không có `token` | `navigate("/login?oauth=missing", { replace: true })` |

### Pending checkout

- Key: `localStorage.pendingCheckout`.
- Giá trị: JSON stringify (phải parse được).
- Sau khi dùng: `removeItem`.
- Parse fail: log lỗi, **không** chặn luồng — rơi xuống `navigate "/"` (implicit sau catch không return trong code — xem đoạn try/catch: catch chỉ logs khi parsing fail bên trong if pending).

Đọc lại OAuthSuccess.jsx for parse error...

```javascript
if (pendingCheckout) {
  try {
    ...
    navigate('/checkout', ...)
    return;
  } catch (e) {
    console.error(...)
  }
}
navigate("/", ...)
```

Đúng: parse fail → log → rồi vẫn navigate `/`.

---

## 5. Redux & persistence

`setCredentials` cập nhật:

- Redux: `user`, `token`, `isAuthenticated`.
- LS: `token`, user JSON **`user`** (theo slice).

Điều này thống nhất với `App.jsx` restore khi refresh.

---

## 6. Mối quan hệ axios

Request interceptor của `api` luôn gắn `Bearer` từ `localStorage` — phù hợp sau refresh. Việc set `defaults.headers.common.Authorization` trên OAuthSuccess giúp request `/me` **ngay lap tức** sau redirect (trước khi interceptor phụ thuộc LS — thực tế interceptor cũng đọc LS đã set).

---

## 7. Nhánh thay thế: `RegisterPage` + `?token`

`RegisterPage` có effect: nếu URL có `token` → tương tự Bearer + `/me` + credentials + cleanup URL `/register`.

Social backend **không** redirect vào `/register`; nhánh có thể dùng cho tích hợp cũ hoặc test.

---

## 8. Backend redirect URL base

OAuth social routes dùng:

```javascript
const FE_URL = process.env.FE_APP_URL || "http://localhost:3000";
```

Email verify trong `authController` dùng `getFrontendBaseUrl()` (`FRONTEND_URL` \| `CLIENT_URL`). **Hai biến khác nhau** — đồng bộ khi deploy.

---

## 9. Gap UX: `/login` & query `oauth`

Failure từ provider:

- `?oauth=google_failed`, `oauth=facebook_failed`

Từ trang success:

- `oauth=failed`, `oauth=missing`

`LoginPage.jsx` hiện **không map** các query này sang banner tiếng Việt — **documented gap**.

---

## 10. Security

| Chủ đề | Ghi chú |
|--------|---------|
| JWT in URL | Rủi ro Referer/leak → HTTPS, xử lý nhanh, `replace` |
| XSS | Token trong LS |
| Độ dài sóng JWT | Session 7 ngày như đăng nhập thường |

---

## 11. Related Features

| FR | Quan hệ |
|----|---------|
| `FR_OAuthGoogle.md`, `FR_OAuthFacebook.md` | Nguồn redirect OAuth |
| `FR_VerifyEmail.md` | Redirect cùng đích FE |
| `FR_GetCurrentUser.md` | API hydrate |

---

## 12. Source Files

| Layer | File |
|-------|------|
| FE Page | `client/app/pages/OAuthSuccess.jsx` |
| Routes | `client/app/App.jsx` |
| BE OAuth | `server/routes/authSocialRoutes.js` |
| BE Verify email | `server/controllers/authController.js` |

---

## 13. Acceptance Criteria

- **AC1:** Token hợp lệ + `/me` OK → Redux + LS và redirect `/` hoặc checkout.
- **AC2:** Token rỗng → `/login?oauth=missing`.
- **AC3:** `/me` fail → `/login?oauth=failed`.
- **AC4:** `pendingCheckout` hợp lệ → checkout + xóa key.
- **AC5:** Dùng `replace: true` cho navigate sau success.
