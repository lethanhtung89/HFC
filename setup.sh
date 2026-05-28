#!/bin/bash
# ============================================================
# HFC - Setup script cho Synology NAS
# Chạy script này SAU KHI upload toàn bộ thư mục lên Synology
# ============================================================
set -e

echo "=========================================="
echo "  HFC v3.0.0 - Cài đặt trên Synology"
echo "=========================================="
echo ""

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài đặt. Hãy cài Docker từ Package Center."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose chưa được cài đặt."
    exit 1
fi

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt."
    echo "   Cài Node.js v20 từ Package Center hoặc Entware."
    echo "   Hoặc build dist/ trên máy khác rồi copy sang."
    exit 1
fi

echo "✅ Docker: $(docker --version)"
echo "✅ Node.js: $(node --version)"
echo ""

# Tạo thư mục data nếu chưa có
if [ ! -d "./data" ]; then
    echo "📁 Tạo thư mục data/..."
    mkdir -p ./data
fi
chmod -R 777 ./data

# Build frontend
echo ""
echo "📦 Cài đặt dependencies..."
npm install

echo ""
echo "🔨 Build frontend (Vite)..."
npm run build

# Đảm bảo dist/index.html tồn tại (Vite output có thể là vite-index.html)
if [ -f "./dist/vite-index.html" ] && [ ! -f "./dist/index.html" ]; then
    mv ./dist/vite-index.html ./dist/index.html
    echo "   Renamed vite-index.html → index.html"
fi

if [ ! -f "./dist/index.html" ]; then
    echo "❌ Build thất bại - không tìm thấy dist/index.html"
    exit 1
fi

echo "✅ Build thành công: $(ls dist/ | wc -l) files"
echo ""

# Dừng containers cũ nếu có
echo "🔄 Dừng containers cũ (nếu có)..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Build và khởi động
echo ""
echo "🚀 Build và khởi động Docker containers..."
docker compose up -d --build 2>/dev/null || docker-compose up -d --build

echo ""
echo "=========================================="
echo "  ✅ CÀI ĐẶT HOÀN TẤT!"
echo "=========================================="
echo ""
echo "  🌐 Truy cập: http://<IP-Synology>:7000"
echo ""
echo "  📦 Containers:"
echo "     - hfc-web       (nginx, port 7000)"
echo "     - hfc-state-api (Node.js, lưu trữ state)"
echo "     - hfc-pdf-api   (Python, xử lý PDF/OCR)"
echo ""
echo "  📂 Dữ liệu: ./data/"
echo "  🔧 Logs:     docker compose logs -f"
echo "  🔄 Restart:  docker compose restart"
echo "  ⏹  Stop:     docker compose down"
echo ""
