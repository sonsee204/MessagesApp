---
name: mongodb-query-optimizer
description: >-
  Help with MongoDB query optimization and indexing. Use only when the user asks for optimization or performance: "How do I optimize this query?", "How do I index this?", "Why is this query slow?", "Can you fix my slow queries?", "What are the slow queries on my cluster?", etc. Hỗ trợ tối ưu hóa truy vấn MongoDB, đánh chỉ mục (indexing), phân tích explain() và chẩn đoán truy vấn chậm (slow queries).
compatibility: >-
  Best with MongoDB MCP server. Uses collection-indexes and explain when the connection string works; uses Atlas Performance Advisor when Atlas API is configured. Without either, suggest indexes from query shape only. User creates indexes in Atlas or migrations unless tooling allows otherwise.
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# MongoDB Query Optimizer (Tối Ưu Hóa Truy Vấn MongoDB)

## Khi Nào Sử Dụng Skill Này

Kích hoạt **chỉ khi** người dùng yêu cầu:

- Tối ưu hóa truy vấn hoặc chỉ mục (**optimization / performance**)
- Tìm hiểu **tại sao truy vấn bị chậm** hoặc **cách tăng tốc độ truy vấn**
- Phát hiện **truy vấn chậm (slow queries)** trên cluster và cách khắc phục

**Không** kích hoạt cho việc viết truy vấn thông thường trừ khi người dùng yêu cầu trợ giúp về hiệu năng, slow query hoặc indexing.

## Quy Trình Xử Lý Tổng Quan (High Level Workflow)

### 1. Hỗ Trợ Hiệu Năng Chung (General Performance Help)

Nếu người dùng muốn kiểm tra các truy vấn chậm hoặc tìm đề xuất hiệu năng chung:
- Sử dụng công cụ **atlas-get-performance-advisor** từ MongoDB MCP server để lấy log truy vấn chậm và phân tích từ Performance Advisor.
- Đưa ra đề xuất dựa trên thông tin thu thập được.
- Nếu không có MCP hoặc thông tin Atlas, hướng dẫn người dùng cấu hình credentials hoặc hỏi về một truy vấn cụ thể.

### 2. Hỗ Trợ Một Truy Vấn Cụ Thể (Specific Query Help)

Nếu người dùng hỏi về một câu lệnh query cụ thể:
- Sử dụng **collection-indexes**, **explain**, và **find** để lấy danh sách indexes hiện có, kết quả `explain()` và dữ liệu tài liệu mẫu.
- Sử dụng **atlas-get-performance-advisor** để lấy thông tin log query chậm.
- Đưa ra đề xuất tối ưu dựa trên quy tắc **ESR (Equality, Sort, Range)** và các best practices từ file tài liệu tham khảo.

---

## Các Công Cụ MongoDB MCP Khả Dụng

Gọi MongoDB MCP server với đúng tên công cụ (`toolName`) và tham số:

| Tên Công Cụ (MCP Tool) | Đối Tượng Tham Số (Arguments) | Mục Đích |
| :---- | :---- | :---- |
| `collection-indexes` | `{ "database": "<db>", "collection": "<coll>" }` | Lấy danh sách các index hiện có trên collection. |
| `explain` | `{ "database": "<db>", "collection": "<coll>", "method": [ { "name": "find", "arguments": { "filter": {...}, "sort": {...}, "limit": N } } ], "verbosity": "executionStats" }` | Phân tích kế hoạch thực thi query (COLLSCAN vs IXSCAN, docs scanned vs returned). |
| `find` | `{ "database": "<db>", "collection": "<coll>", "filter": {...}, "projection": {...}, "sort": {...}, "limit": N }` | Lấy sample document để phân tích cấu trúc schema. |
| `atlas-list-projects` | `{}` hoặc `{ "orgId": "<hex-24-ký-tự>" }` | Liệt kê danh sách projects kèm project ID. |
| `atlas-get-performance-advisor` | `{ "projectId": "...", "clusterName": "...", "operations": ["slowQueryLogs", "suggestedIndexes"] }` | Đọc khuyến nghị index và log truy vấn chậm từ MongoDB Atlas. |

---

## Quy Trình Từng Bước Cho Một Query Cụ Thể (Workflow 1)

**Tình huống:** Người dùng hỏi: *"Tại sao truy vấn này chạy chậm? `db.orders.find({status: 'shipped', region: 'US'}).sort({date: -1})`"*

1. **Kiểm tra Indexes hiện tại**:
   - Gọi `collection-indexes` trên collection `orders`.
   - Kết quả ví dụ: `{_id: 1}`, `{status: 1}`, `{date: -1}`.
2. **Chạy Phân Tích Explain**:
   - Gọi `explain` với `verbosity: "executionStats"`.
   - Kết quả ví dụ: Dùng index `{status: 1}`, sau đó thực hiện in-memory SORT, `totalKeysExamined: 50000`, `nReturned: 100`.
3. **Lấy Document Mẫu**:
   - Gọi `find` với `limit: 1` để xem cấu trúc thực tế.
4. **Chẩn Đoán (Diagnosis)**:
   - Truy vấn quét 50K index entries nhưng chỉ trả về 100 docs (selectivity rất thấp: 0.002). In-memory sort gây tốn CPU/RAM và tăng latency.
5. **Đề Xuất Chỉ Mục (Recommendation theo quy tắc ESR)**:
   - Tạo compound index `{ status: 1, region: 1, date: -1 }`:
     - **Equality**: `status` và `region` đứng trước.
     - **Sort**: `date: -1` đứng ngay sau để loại bỏ in-memory sort.

---

## Quy Trình Tối Ưu Hóa Tổng Thể Cluster (Workflow 2)

**Tình huống:** Người dùng hỏi: *"Giúp tôi tối ưu hóa các slow queries trên cluster?"*

1. **Chạy atlas-get-performance-advisor**:
   - Lấy log slow queries 24 giờ qua (`slowQueryLogs`).
   - Đọc đề xuất index (`suggestedIndexes`) và đề xuất loại bỏ index thừa (`dropIndexSuggestions`).
2. **Chẩn Đoán & Đề Xuất**:
   - Ưu tiên tối ưu các truy vấn chậm nhất và có tần suất xuất hiện cao nhất.
   - Hướng dẫn tạo compound index phù hợp.

---

## Tài Liệu Tham Khảo Cần Đọc

Trước khi chẩn đoán và đề xuất, đọc các tài liệu liên quan trong thư mục `references/`:
- Luôn đọc: `references/core-indexing-principles.md` (Nguyên lý ESR, Prefix compression, Covered queries).
- Luôn đọc: `references/antipattern-examples.md` (Các lỗi phản mẫu: thiếu index sort, regex không neo đầu `^`, `$or` lạm dụng).
- Nếu tối ưu Aggregation: `references/aggregation-optimization.md` (`$match`/`$project` đặt sớm, `$facet` memory limit).
- Nếu tối ưu Update/Replace: `references/update-query-examples.md` (Tối ưu oplog, update atomic).

---

## Tiêu Chuẩn Phản Hồi (Output Standard)
- Trả lời ngắn gọn, rõ ràng: giải thích lý do đề xuất dựa trên nguyên lý ESR hoặc kết quả explain.
- Không cam kết tuyệt đối kiểu "tạo index này chắc chắn giải quyết 100% vấn đề", mà giải thích bản chất cải thiện.
- Nhắc nhở người dùng lưu ý số lượng index trên một collection (khuyến nghị không vượt quá 20 indexes).
- Không tự ý tạo index trực tiếp qua MCP nếu chưa được người dùng xác nhận.