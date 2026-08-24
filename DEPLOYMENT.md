# Hướng Dẫn Cấu Hình Backend Cơ Sở Dữ Liệu Bền Vững (Persistent Database Setup)

Dự án NutriFit sử dụng kiến trúc **Serverless Conflict-Safe Sync Engine** với **Upstash Redis / Vercel KV** làm Canonical Source of Truth.

---

## 1. Biến Môi Trường Bắt Buộc (Required Environment Variables)

Để tính năng Đồng bộ Đám mây hoạt động bền vững, bạn cần thêm 2 biến môi trường sau vào Vercel (Project Settings -> Environment Variables):

| Tên Biến | Mô Tả | Ví Dụ |
| :--- | :--- | :--- |
| `KV_REST_API_URL` | REST API URL của cơ sở dữ liệu Upstash Redis / Vercel KV | `https://nutrifit-kv-****.upstash.io` |
| `KV_REST_API_TOKEN` | REST API Access Token bảo mật | `AX4...==` |

---

## 2. Hướng Dẫn Tạo Database Miễn Phí (Free 1-Click Setup)

### Cách 1: Vercel KV (Khuyên dùng nếu deploy trên Vercel)
1. Mở trang quản trị dự án trên [Vercel Dashboard](https://vercel.com).
2. Vào tab **Storage** -> Bấm **Create Database** -> Chọn **KV (Redis)**.
3. Bấm **Continue** -> Chọn khu vực máy chủ (VD: Singapore / Hong Kong).
4. Vercel sẽ **tự động liên kết** biến `KV_REST_API_URL` và `KV_REST_API_TOKEN` vào dự án của bạn!

### Cách 2: Upstash Redis (Trực tiếp từ Upstash)
1. Đăng ký tài khoản miễn phí tại [Upstash Console](https://console.upstash.com).
2. Bấm **Create Database** (Free Tier cho 10,000 requests/ngày).
3. Tại trang tổng quan database, cuộn xuống mục **REST API**.
4. Sao chép `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
5. Dán vào Vercel Environment Variables với tên `KV_REST_API_URL` và `KV_REST_API_TOKEN`.

---

## 3. Cơ Chế Hoạt Động & Bảo Mật

* **Atomic Lua Transaction**: Mọi yêu cầu ghi dữ liệu đều chạy script Lua nguyên tử trên Redis, triệt tiêu hoàn toàn race condition khi hai thiết bị cùng ghi một lúc.
* **Xác thực Token 256-bit**: Mỗi không gian đồng bộ được bảo vệ bởi một Auth Token độ dài cao. Người chỉ có mã 6 số sẽ không thể đọc hoặc ghi trái phép dữ liệu.
* **Xử lý khi thiếu Database**: Nếu chưa cấu hình biến môi trường, API sẽ trả về mã lỗi `503 Service Unavailable` cùng thông báo rõ ràng, **tuyệt đối không giả mạo thành công trong RAM**.
