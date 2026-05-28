# HFC v3.0 — Hướng dẫn cài đặt trên Synology NAS

## Tổng quan

| Thông số | Giá trị |
|---|---|
| Tên ứng dụng | **HFC** |
| Port truy cập | **7000** |
| Đường dẫn Docker | `/volume2/docker/hfc/` |
| Containers | `hfc-web`, `hfc-state-api`, `hfc-pdf-api` |
| Dữ liệu lưu tại | `/volume2/docker/hfc/data/` |

---

## Yêu cầu trước khi cài đặt

1. **Synology DSM 7.x** trở lên
2. **Docker** (Container Manager) — cài từ Package Center
3. **Node.js v20** — cài từ Package Center (chỉ cần để build lần đầu)
4. **Git** (tuỳ chọn) — cài từ Package Center nếu muốn clone repo

> **Lưu ý:** Nếu Synology không cài được Node.js, bạn có thể build trên máy tính cá nhân rồi copy thư mục `dist/` lên NAS. Xem mục "Build trên máy khác" bên dưới.

---

## Bước 1 — Upload file lên Synology

### Cách 1: Qua File Station
1. Mở **File Station** trên DSM
2. Vào thư mục `docker` (thường ở `/volume2/docker/` hoặc `/volume1/docker/`)
3. Tạo thư mục mới tên `hfc`
4. Giải nén file `hfc.zip` vào thư mục này

### Cách 2: Qua SSH
```bash
# SSH vào Synology (bật SSH trong Control Panel > Terminal)
ssh admin@<IP-Synology>

# Tạo thư mục
sudo mkdir -p /volume2/docker/hfc
cd /volume2/docker/hfc

# Upload và giải nén (hoặc dùng SCP/WinSCP)
unzip hfc.zip
```

### Sau khi giải nén, cấu trúc phải là:
```
/volume2/docker/hfc/
├── docker-compose.yml
├── nginx.conf
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite-index.html
├── setup.sh
├── index.html          ← bản gốc (backup)
├── src/                ← mã nguồn frontend
├── state-api/          ← API lưu trữ dữ liệu
├── pdf-api/            ← API xử lý PDF
└── data/               ← dữ liệu ứng dụng
```

---

## Bước 2 — Phân quyền thư mục data

```bash
sudo chmod -R 777 /volume2/docker/hfc/data
```

> Đây là bước **bắt buộc** để containers có thể đọc/ghi dữ liệu.

---

## Bước 3 — Build frontend

### Cách A: Build trực tiếp trên Synology (cần Node.js)

```bash
cd /volume2/docker/hfc

# Cài dependencies
npm install

# Build
npm run build
```

Kết quả: thư mục `dist/` được tạo ra chứa file HTML/JS/CSS đã compile.

### Cách B: Build trên máy khác rồi copy sang

Trên máy tính cá nhân (Windows/Mac/Linux) có Node.js v18+:

```bash
# Giải nén hfc.zip vào một thư mục
cd hfc
npm install
npm run build

# Copy thư mục dist/ lên Synology qua SCP hoặc File Station
scp -r dist/ admin@<IP-Synology>:/volume2/docker/hfc/dist/
```

### Cách C: Chạy setup script tự động

```bash
cd /volume2/docker/hfc
sudo bash setup.sh
```

Script tự động: kiểm tra yêu cầu → npm install → npm run build → docker compose up.

---

## Bước 4 — Khởi động Docker containers

```bash
cd /volume2/docker/hfc

# Build images và khởi động (lần đầu mất 3-5 phút)
sudo docker compose up -d --build
```

Kiểm tra trạng thái:
```bash
sudo docker compose ps
```

Kết quả mong muốn:
```
NAME             IMAGE              STATUS
hfc-web          nginx:1.25-alpine  Up
hfc-state-api    hfc-state-api      Up
hfc-pdf-api      hfc-pdf-api        Up
```

---

## Bước 5 — Truy cập ứng dụng

Mở trình duyệt, vào:

```
http://<IP-Synology>:7000
```

Ví dụ: `http://192.168.1.100:7000`

---

## Cấu hình bổ sung

### Mở port trên Firewall Synology

Nếu bật Firewall trên DSM:

1. **Control Panel** → **Security** → **Firewall**
2. **Edit Rules** → **Create**
3. Port: `7000`, Protocol: `TCP`, Action: **Allow**

### Truy cập từ bên ngoài mạng LAN

Nếu muốn truy cập qua internet:

1. Trong **router**, forward port `7000` TCP về IP Synology
2. Hoặc dùng **Synology QuickConnect** / **DDNS** + reverse proxy

### Cấu hình Gemini API Key (xử lý PDF bằng AI)

1. Truy cập ứng dụng tại `http://<IP>:7000`
2. Vào **Cài Đặt** (Settings)
3. Mục **API & AI**: nhập Gemini API Key
4. Lấy key miễn phí tại: https://aistudio.google.com/apikey

---

## Quản lý vận hành

### Xem logs
```bash
cd /volume2/docker/hfc

# Tất cả containers
sudo docker compose logs -f

# Chỉ 1 container
sudo docker compose logs -f web
sudo docker compose logs -f state-api
sudo docker compose logs -f pdf-api
```

### Khởi động lại
```bash
sudo docker compose restart
```

### Dừng ứng dụng
```bash
sudo docker compose down
```

### Cập nhật phiên bản mới
```bash
cd /volume2/docker/hfc

# Dừng containers
sudo docker compose down

# Upload source mới (giữ nguyên thư mục data/)
# ... copy file mới vào, KHÔNG xoá data/ ...

# Build lại
npm install
npm run build

# Khởi động
sudo docker compose up -d --build
```

### Backup dữ liệu
```bash
# Backup file state
cp /volume2/docker/hfc/data/state.json /volume2/backup/hfc-state-$(date +%Y%m%d).json

# Hoặc backup toàn bộ thư mục data
tar -czf /volume2/backup/hfc-data-$(date +%Y%m%d).tar.gz /volume2/docker/hfc/data/
```

### Restore dữ liệu
```bash
cp /volume2/backup/hfc-state-20260201.json /volume2/docker/hfc/data/state.json
sudo docker compose restart state-api
```

---

## Xử lý lỗi thường gặp

### Container không khởi động được
```bash
# Kiểm tra log chi tiết
sudo docker compose logs state-api
sudo docker compose logs pdf-api

# Rebuild từ đầu
sudo docker compose down
sudo docker compose up -d --build --force-recreate
```

### Lỗi "permission denied" trên data/
```bash
sudo chmod -R 777 /volume2/docker/hfc/data
sudo docker compose restart
```

### Port 7000 bị chiếm
```bash
# Kiểm tra ai đang dùng port
sudo netstat -tlnp | grep 7000

# Đổi port trong docker-compose.yml, ví dụ sang 7001:
# ports:
#   - "7001:80"
```

### Trang trắng khi truy cập
```bash
# Kiểm tra dist/ đã có chưa
ls -la /volume2/docker/hfc/dist/

# Nếu chưa có, cần build
npm run build

# Kiểm tra nginx
sudo docker compose logs web
```

### pdf-api build lỗi (thiếu RAM)
Trên NAS RAM thấp (2GB), pdf-api (Python + Tesseract) có thể build chậm:
```bash
# Build riêng pdf-api trước
sudo docker compose build pdf-api
sudo docker compose up -d
```

---

## Kiến trúc hệ thống

```
Trình duyệt ──── port 7000 ────▶ hfc-web (nginx)
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                  ▼
              hfc-state-api                      hfc-pdf-api
              (Node.js/Express)                  (Python/FastAPI)
              Lưu trữ state.json                 OCR + Gemini proxy
                    │                                  │
                    └────────────┬─────────────────────┘
                                 ▼
                            ./data/
                         (volume mount)
```

- **hfc-web**: Serve frontend (dist/), reverse proxy API requests
- **hfc-state-api**: REST API lưu/đọc state.json, quản lý phiên bản (revision)
- **hfc-pdf-api**: Xử lý PDF (OCR Tesseract), proxy gọi Gemini API

---

## Thông tin kỹ thuật

| Thành phần | Công nghệ | Image |
|---|---|---|
| Frontend | React + Vite + TypeScript | nginx:1.25-alpine |
| State API | Node.js 20 + Express | node:20-alpine (build) |
| PDF API | Python 3.11 + FastAPI + Tesseract | python:3.11-slim (build) |
| Dữ liệu | JSON file (state.json) | — |

**Dung lượng Docker images (ước tính):**
- hfc-web: ~40 MB
- hfc-state-api: ~180 MB
- hfc-pdf-api: ~800 MB (do Tesseract OCR)
- **Tổng: ~1 GB**
