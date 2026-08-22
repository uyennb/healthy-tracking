# 🥗 NutriFit - Mobile Health & Nutrition Tracker

Ứng dụng web-app di động tối ưu cho điện thoại giúp theo dõi dinh dưỡng hàng ngày (Calo-in, Protein, Carbs, Fats, Fiber), cân bằng calo (Calo-in vs Calo-out TDEE), và hiệu quả luyện tập (Thời gian tập vs Calo bài tập) với đa dạng biểu đồ trực quan và lọc thời gian linh hoạt.

![NutriFit Mobile Screenshot](https://raw.githubusercontent.com/uyennb/healthy-tracking/main/public/preview.png)

## 🌟 Tính Năng Nổi Bật

- 📱 **Mobile-First App Experience**: Giao diện thiết kế dạng di động với Bottom Navigation Bar & Nút nhập liệu nhanh (+).
- 🎨 **Tông Màu Tươi Sáng & Phân Biệt Chỉ Số**: Biểu đồ với màu nhận diện rõ ràng cho từng chất dinh dưỡng (Protein - Lam, Carbs - Cam, Fats - Hồng đỏ, Fiber - Xanh lá).
- 📊 **3 Chế Độ Hiển Thị**: Biểu đồ cột (Bar Chart), Biểu đồ đường (Line Chart), Bảng thống kê (Data Table với dòng TRUNG BÌNH/AVERAGE tự động).
- 📈 **3 Nhóm Phân Tích Chuyên Biệt**:
  1. Biểu đồ dinh dưỡng (Protein, Carbs, Fats, Fiber)
  2. Biểu đồ Calo-in vs Calo-out (TDEE) & Mức thâm hụt/dư thừa calo
  3. Biểu đồ theo dõi luyện tập (Trục kép thời gian tập vs Calo đốt bài tập)
- 🗓️ **Bộ Lọc Thời Gian**: Tuần, Tháng, Quý, Năm & Giai đoạn Tự nhập (Custom Date Range).
- 👤 **Hồ Sơ Cá Nhân (Profile)**: Tải ảnh đại diện, tự động tính tuổi từ ngày sinh, tính chỉ số thể hình BMI.
- 🌐 **Đa Ngôn Ngữ (i18n)**: Chuyển đổi linh hoạt giữa Tiếng Việt 🇻🇳 và English 🇬🇧.
- 💾 **Bảo Mật & Quản Lý Dữ Liệu**: Lưu trữ LocalStorage riêng tư trên thiết bị, hỗ trợ Xuất/Nhập file Excel CSV & JSON.

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 18 (Vite + TypeScript)
- **Styling**: Tailwind CSS v3 + Lucide React Icons
- **Biểu đồ**: Recharts
- **Xử lý Thời gian**: Date-fns (Hỗ trợ i18n locale)

## 🚀 Hướng Dẫn Khởi Chạy (Local Setup)

```bash
# 1. Clone dự án
git clone https://github.com/uyennb/healthy-tracking.git
cd healthy-tracking

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Chạy môi trường phát triển
npm run dev

# 4. Đóng gói bản sản phẩm
npm run build
```

## 📝 Giấy Phép (License)

MIT License © 2026 Bảo Uyên
