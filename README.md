# UML Quản lý nhân sự

Sơ đồ lớp UML tương tác của ứng dụng quản lý nhân sự chạy trên console (Project 2, học phần Cấu trúc dữ liệu và giải thuật). Thiết kế cho C++ trên Windows, cài đặt theo hướng đối tượng và template. Trang chỉ có **một sơ đồ lớp**.

## Cách mở trên máy

Trình duyệt không cho trang mở bằng cách bấm đúp (địa chỉ `file://`) đọc các file JSON đi kèm, nên cần một máy chủ cục bộ. Mở PowerShell, đi tới thư mục này và chạy:

```powershell
cd "D:\Project 2 ctdl\uml"
py -m http.server 8000
```

Rồi mở `http://localhost:8000` trong trình duyệt. Dừng máy chủ bằng Ctrl + C. Thêm `#HrSystem` vào địa chỉ để mở thẳng lớp `HrSystem`.

Nếu sau khi các file được sửa mà trang vẫn hiện bản cũ, nhấn Ctrl + F5 để tải lại không dùng bộ nhớ đệm của trình duyệt.

## Cách xem

- Cuộn chuột để phóng to hoặc thu nhỏ, kéo để di chuyển. Có bốn mức chi tiết (tự đổi theo độ phóng, hoặc chọn tay ở thanh bên): mức 0 tên và mục đích; mức 1 thuộc tính và phương thức dạng ngắn; mức 2 chữ ký đầy đủ; mức 3 chữ ký đầy đủ cùng mô tả từng thành viên.
- Trên điện thoại và máy tính bảng: kéo một ngón tay để di chuyển, **hai ngón tay để phóng to hoặc thu nhỏ**, chạm vào một lớp hoặc thành viên để xem chi tiết, nút ☰ mở danh sách và bộ lọc.
- Số trên mỗi thẻ là **thứ tự đọc**. Thanh bên có danh sách theo thứ tự đó; khi một lớp đang được chọn, phím mũi tên trái và phải đi sang lớp trước hoặc sau.
- Rê chuột lên một lớp, một thành viên, một đường nối hoặc một tên kiểu để xem chú thích; bấm để mở khung chi tiết bên phải.
- Khung chi tiết của một lớp có: vai trò, yêu cầu của đề mà lớp đáp ứng, **những gì cần biết từ lớp khác** (đủ để một người làm lớp này mà không phải đọc các lớp còn lại), bất biến, thành viên, quan hệ, gợi ý cài đặt C++.
- Khung chi tiết của một thuộc tính hay phương thức có: mô tả, vai trò (ai gọi, để làm gì), tiền điều kiện, hậu điều kiện, độ phức tạp, ví dụ cụ thể và gợi ý cài đặt C++ bằng cú pháp cơ bản.
- **Mọi tên lớp và tên kiểu đều bấm được**: bấm `UserProfile` hay `string` để nhảy tới nơi nó được định nghĩa. Nút «← Quay lại» ở đầu khung đưa về lựa chọn trước.
- Mặc định chỉ vẽ các quan hệ cấu trúc cho gọn; các quan hệ phụ thuộc của một lớp hiện khi chọn lớp đó, hoặc bật «Hiện mọi quan hệ phụ thuộc» ở thanh bên.

## Ước tính số dòng code C++ (tính cả dòng trống)

| File | Dòng |
| --- | ---: |
| `Util.h` | 60 |
| `Account.h` (gồm `Role`) | 32 |
| `Admin.h` | 18 |
| `Employee.h` | 32 |
| `UserProfile.h` (gồm `ProfileField`) | 38 |
| `AccountList.h` | 65 |
| `Validator.h` | 65 |
| `HrSystem.h` + `HrSystem.cpp` | 30 + 120 |
| `Console.h` + `Console.cpp` | 20 + 75 |
| `Menu.h` + `Menu.cpp` | 20 + 22 |
| `AdminMenu.h` + `AdminMenu.cpp` | 18 + 105 |
| `EmployeeMenu.h` + `EmployeeMenu.cpp` | 16 + 60 |
| `Application.h` + `Application.cpp` | 16 + 50 |
| `main.cpp` | 6 |
| **Tổng** | **khoảng 868** |

Đây là ước tính theo từng hàm, giả định: dấu `{` cùng dòng với câu lệnh, một dòng trống giữa hai hàm, một dòng chú thích cho mỗi lớp (không chú thích từng hàm), các số giới hạn viết thẳng trong mã. Nếu Coding Standard của lớp bắt chú thích từng hàm, tách mọi lớp thành `.h`/`.cpp` hoặc cấm «số ma thuật», tổng sẽ nhiều hơn.

## Các file

| File | Nội dung |
| --- | --- |
| `index.html`, `style.css` | Khung trang và giao diện |
| `common.js`, `diagram.js`, `main.js` | Mã trang (không dùng thư viện ngoài) |
| `data/meta.json` | Tên, phiên bản, các gói (màu), các chặng đọc và kích thước chuẩn để co giãn bố cục |
| `data/classes_types.json` | Thẻ «Kiểu cơ bản» (`BasicTypes`): `string`, `vector<T>`, `int`, `bool`, `char`, `void` |
| `data/classes_util.json` | `Util` |
| `data/classes_model.json` | `Role`, `Account`, `Admin`, `Employee`, `ProfileField`, `UserProfile` |
| `data/classes_storage.json` | `AccountList<T>` |
| `data/classes_logic.json` | `Validator`, `HrSystem` |
| `data/classes_ui.json` | `Console`, `Menu`, `AdminMenu`, `EmployeeMenu`, `Application` |
| `data/relations.json` | Các quan hệ giữa lớp |

Muốn sửa nội dung thì sửa các file JSON; sơ đồ được vẽ lại từ dữ liệu, nên không phải sửa mã trang. Mỗi thành viên có các trường `summary`, `role` (vai trò), `detail`, `pre`, `post`, `complexity`, `example`, `cpp`; mỗi lớp có thêm `spec` (yêu cầu của đề) và `uses` (cần biết từ lớp khác). Khi thêm hoặc xóa lớp, cần cập nhật `read` (thứ tự đọc) và `pos` (vị trí ban đầu) cho lớp đó; lớp template có thêm `tparams`.
