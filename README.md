# TURBO HR Chatbot

Messenger chatbot của TURBO dựa trên GPT 3.5 của OpenAI.

## Cài đặt

1. Clone dự án về máy tính của bạn.
2. Chạy lệnh `npm install` và `pip install -r requirements.txt` để cài đặt các phụ thuộc cần thiết.
3. Tạo fb page và fb app và kết nối chúng với nhau, lấy `PAGE_ACCESS_TOKEN` và `PAGE_ID`
4. Lấy `OPENAI_API_KEY` từ https://platform.openai.com
5. Điền chuỗi URI của mongodb cần kết nối và tên cơ sở dữ liệu `DB_NAME`.
6. Điền các thông tin cần thiết trong `.env.example` và đổi tên thành `.env`

## Sử dụng

1. Chạy `python fastapi/api.py` để khởi tạo API sử dụng model pytorch tìm kiếm top sản phẩm.
2. Deploy node.js project lên server có SSL để có webhook được fb chấp nhận.
3. Xác nhận webhook từ fb.