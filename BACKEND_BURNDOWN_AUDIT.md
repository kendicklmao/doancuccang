# Backend Epic Burndown Audit

Base commit: `d76b93a` (main) · Ngày: 2026-10-07 · Phạm vi: chỉ `GET /api/task/project/:projectId/epic-burndown`

## 1. Current implementation (trước khi sửa)

- Route: `route/task.js` → `taskRouter.get('/project/:projectId/epic-burndown', verifyToken, controller.getEpicBurndown)`, mount tại `/api/task`. Chỉ có `verifyToken`, không có kiểm tra role hay membership.
- Controller: `controller/task.js` → `getEpicBurndown`, toàn bộ logic viết inline, gọi `new Date()` trực tiếp.
- Models: `Task.point` (Number, mặc định 0), `Task.status` (String, mặc định `"pending"`), `Task.completedAt` (Date, mặc định null), timestamps. `Project.startDate` (Date, mặc định `Date.now`), timestamps.
- Thuật toán:
  - `start = project.startDate || project.createdAt || now`.
  - `weekOf(d) = floor((d - start) / 7 ngày) + 1`.
  - `currentWeek = max(1, weekOf(now))`, trong response được cap ở 6.
  - Task được tính khi `status === "completed"`. Ngày hoàn thành là `completedAt || updatedAt`, tuần được clamp vào [1, 6].
  - `planned(w) = max(0, round(total - total/6 * w))`.
  - `actual(w) = max(0, remaining)` nếu `w <= currentWeek`, ngược lại là `null`.
- Nguồn tạo `completedAt` trong code hiện tại:
  - `moveTask` khi kéo vào cột có title chứa done/accepted/finish. Kéo ra khỏi cột này thì reset về `pending` + `null`.
  - `reviewTask`, nhưng hàm này chưa có route.
  - `PUT /task/:id` với `status:"completed"` **không** ghi `completedAt`, nên biểu đồ sẽ fallback sang `updatedAt`.

## 2. API contract

```
GET /api/task/project/:projectId/epic-burndown
Authorization: Bearer <JWT>
```

| Status | Body |
|---|---|
| 200 | `{ totalPoints: number, currentWeek: number (1..6), weeks: [{ week: string, planned: number, actual: number \| null }] }`, trong đó `weeks` có đúng 7 phần tử: `Start, Week 1..Week 6` |
| 400 | `{ success: false, message: "Invalid Project ID" }` |
| 401 | `{ message: "not found token" }` hoặc `{ message: "token is not valid or expired" }` |
| 403 | `{ message: "ACCOUNT_SUSPENDED", logout: true }` |
| 404 | `{ success: false, message: "Project not found" }` (**mới**). Lưu ý: 404 `{ message: "User not found" }` đến từ middleware khi user của token không còn tồn tại. |
| 500 | `{ message: "Internal Server Error", error: string }` |

## 3. Problems found

| ID | Mức | Vấn đề |
|---|---|---|
| P1 | P0 | Project không tồn tại (ObjectId hợp lệ) vẫn trả **200** với dữ liệu rỗng giả (start = now). |
| P2 | P1 | Task completed thiếu cả `completedAt` và `updatedAt` cho ra `new Date(undefined)` = NaN, nên điểm bị **mất âm thầm**: đã cộng vào total nhưng không bao giờ được trừ. Không có fallback sang `createdAt`. |
| P3 | P1 | Logic gắn chặt với controller và `Date.now`, không test deterministic được. |
| P4 | P2 | Chuỗi ngày invalid cũng gây NaN như P2. |
| P5 | P2 | `getCurrentWeekNumber()` trong controller là dead code. Không xóa trong phase này. |

## 4. Changes implemented

- `helper/epicBurndown.js` (mới): hàm thuần `buildEpicBurndown(tasks, startDate, now)`. Công thức planned/actual/currentWeek giữ nguyên. Chỉ thay đổi ngày hoàn thành thành `completedAt → updatedAt → createdAt`, bỏ qua ngày không hợp lệ, và nếu không còn ngày hợp lệ nào thì tính vào Week 1.
- `controller/task.js`: thêm 404 `Project not found` (không query Task khi project không tồn tại). Phần tính toán giao cho helper với `now = new Date()`. Response thành công giữ nguyên.
- `test/epicBurndown.test.js` (mới): dùng `node:test` + `node:assert`, không thêm dependency.
- `package.json`: script `test` được đổi thành `node --test "test/**/*.test.js"` (trước đó script này chỉ `exit 1`).

## 5. Unit tests

`test/epicBurndown.test.js` cố định `START = 2026-01-05T00:00Z`, `NOW = START + 17 ngày` (Week 3).

- CASE 1–13 test trực tiếp helper. Ngoài ra có thêm 4b (không có ngày hợp lệ → Week 1), K8 (startDate tương lai), ranh giới tuần (ngày 6.99 / 7), và kiểm tra không mutate input.
- CASE 14 test controller, với `Project.findById` / `Task.find` được stub (không cần DB): kết quả 404 và Task không bị query. Kèm hai test cho 400 (invalid id) và 200 (đúng contract, không có `success`).

## 6. Integration tests

Script tạm (không commit, nằm ngoài repo) dựng `app.js` thật trên một port ngẫu nhiên, kết nối `mongodb://127.0.0.1:27017/doancuccang_burndown_test`.

- Script tự huỷ nếu DB đã tồn tại từ trước khi chạy.
- Seed qua Mongoose cùng các document "legacy" được insert raw (không có `updatedAt`, không có ngày nào, không có `point`), rồi ký JWT test và gọi HTTP thật.
- Cuối cùng chờ `Model.init()` xong rồi mới `dropDatabase()`, sau đó xác nhận DB không còn.

## 7. Test results

- Unit: **20/20 pass** (`npm test`).
- Integration: **12/12 pass**. Các trường hợp đã kiểm tra:
  - Project chính: 200, totalPoints 21, currentWeek 3, actual `[21,15,11,5,null,null,null]`, planned `[21,18,14,11,7,4,0]`.
  - Project rỗng: 200.
  - startDate tương lai: 200, currentWeek 1.
  - Project không tồn tại: 404.
  - Invalid id: 400.
  - Thiếu token: 401.
- DB `doancuccang_burndown_test` đã bị xoá (đã xác minh). Lần chạy đầu bị lỗi ở bước seed (password < 6 ký tự). Sau đó autoIndex của Mongoose đã tạo lại collection rỗng sau khi drop; phần này đã được dọn và script đã được sửa.

## 8. Known Issues (chỉ ghi nhận, không sửa)

- K1: `reviewTask` có trong controller nhưng không có route.
- K2: `updateAssigneesPoints` được import từ `controller/user.js`, nhưng file đó không export hàm này → cộng/trừ điểm user không chạy (được che bằng `typeof === 'function'`).
- K3: `require('../model/Comment')` viết hoa, trong khi file thật là `model/comment.js` → sẽ lỗi trên Linux.
- K4: Không có kiểm tra quyền/membership. Mọi JWT hợp lệ đều đọc được burndown của mọi project.
- K5: `PUT /task/:id` cho phép set `status:"completed"` mà không ghi `completedAt`, nên biểu đồ dùng `updatedAt`, tức lần sửa gần nhất. Ngược lại, set về `pending` qua PUT không reset `completedAt`.
- K6: `point` không có ràng buộc `min`. Điểm âm (qua PUT) sẽ làm giảm `totalPoints`.
- K7: Portfolio `onTimeRate` so sánh `status === "done"`, trong khi nghiệp vụ dùng `"completed"`.
- Khác: dead code `getCurrentWeekNumber`. `Project` schema khai báo `userId` hai lần. Chạy `npm test` mất khoảng 19 giây vì các lệnh autoIndex của Mongoose bị buffer khi không có kết nối, nhưng không ảnh hưởng kết quả.

## 9. Known Limitations

- K8: `Project.startDate` nằm trong tương lai → `currentWeek = 1` và Week 1 vẫn hiển thị `actual` (= totalPoints) dù project chưa bắt đầu. Behavior này **giữ nguyên** trong phase này.
- Luôn cố định 6 tuần, không phụ thuộc vào độ dài thực của project. Task hoàn thành sau tuần 6 bị dồn vào Week 6. Task hoàn thành trước start bị dồn vào Week 1.
- Task completed có ngày hoàn thành ở tương lai (dữ liệu bất thường) được gán vào tuần tương lai. Phần điểm đó chưa được trừ cho đến khi tuần đó tới.
- Tuần được tính theo khối 7×24h kể từ thời điểm `startDate` (UTC), không theo tuần lịch hay timezone.
- `planned` được làm tròn bằng `Math.round`. `actual` không làm tròn (point có thể lẻ).
- Dữ liệu cũ thiếu cả ba ngày được dồn vào Week 1, nên có thể làm đường actual giảm sớm hơn thực tế.

## 10. Frontend Integration Contract

- Gọi `GET {API}/task/project/{projectId}/epic-burndown` kèm Bearer token. Response **không** có wrapper `success/data`.
- Trục X lấy từ `weeks[].week` (7 điểm). Có hai series: `planned` (luôn là số) và `actual` (`null` = tuần chưa tới, vẽ thành khoảng trống, **không** đổi thành 0).
- `totalPoints` và `currentWeek` (1..6) dùng cho thẻ tổng quan hoặc để đánh dấu tuần hiện tại.
- Xử lý lỗi:
  - 404 `{success:false,message:"Project not found"}`: hiển thị trạng thái không tìm thấy.
  - 400: id sai.
  - 401/403: xử lý auth tập trung.
  - 500: đọc `error`.
- `totalPoints === 0` là hợp lệ (project chưa có điểm), nên hiển thị empty state thay vì biểu đồ phẳng.
- Muốn biểu đồ chính xác thì task phải được hoàn thành qua kéo-thả vào cột Done (`moveTask`), vì đường này ghi `completedAt`.
