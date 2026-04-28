const express = require('express');
const cors = require('cors');
const session = require('express-session');
const Keycloak = require('keycloak-connect');

const app = express();
const PORT = 4000;

// Cấu hình Keycloak
const keycloakConfig = {
    "realm": "rustdesk-realm",
    // Nếu Keycloak bản mới (bản phân phối Quarkus v17+) dùng nguyên http://..., bản cũ thêm /auth
    "auth-server-url": "http://192.168.43.8:8080", 
    "ssl-required": "external",
    "resource": "rustdesk-client",
    "public-client": true,
    "confidential-port": 0
};

// Khởi tạo MemoryStore cho Session (yêu cầu của keycloak-connect)
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'some-secret-key', // Nên đổi thành một chuỗi ngẫu nhiên bảo mật
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Khởi tạo Keycloak
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Cấu hình CORS để RustDesk nhận dữ liệu (giữ nguyên logic gốc)
app.use(cors());

// Sử dụng middleware của Keycloak
app.use(keycloak.middleware());

// Biến lưu trữ Address Book giả lập trong bộ nhớ (để có thể test Thêm/Sửa)
let addressBookData = {
    tags: ["Máy Công Ty", "Máy Cá Nhân"],
    peers: [
        {
            id: "123456789",
            username: "admin",
            alias: "Server Host (Máy thật)",
            hostname: "192.168.56.1",
            platform: "Windows",
            tags: ["Máy Công Ty"]
        },
        {
            id: "987654321",
            username: "dev",
            alias: "Dev VM (Máy ảo)",
            hostname: "192.168.56.101",
            platform: "Linux",
            tags: ["Máy Cá Nhân"]
        }
    ]
};

// Route lấy dữ liệu Address Book (GET)
app.get('/api/ab', /* keycloak.protect(), */ (req, res) => {
    console.log(`[${new Date().toISOString()}] Nhận yêu cầu GET /api/ab từ RustDesk`);
    
    res.json({
        success: true,
        data: addressBookData // Trả về nguyên cục { tags, peers }
    });
});

// Route nhận cập nhật Address Book từ RustDesk (POST)
app.use(express.json()); // Cần middleware này để đọc JSON từ Body
app.post('/api/ab', /* keycloak.protect(), */ (req, res) => {
    console.log(`[${new Date().toISOString()}] Nhận yêu cầu POST /api/ab cập nhật Address Book`);
    
    // Cập nhật mảng vào bộ nhớ (khi test bạn đổi tên/tag trên App sẽ thấy tác dụng ngay)
    if (req.body && req.body.data) {
        try {
            const incomingData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            if (incomingData.tags && incomingData.peers) {
                addressBookData = incomingData;
                console.log("Đã cập nhật Address Book thành công!");
            }
        } catch (e) {
            console.error("Lỗi parse data POST:", e);
        }
    }
    
    res.json({ success: true, message: "Updated" });
});

// Route test độc lập cho Sciter <-> Rust <-> Node.js
app.get('/api/test', (req, res) => {
    console.log(`[${new Date().toISOString()}] Nhận yêu cầu GET /api/test (Test Độc lập)`);
    res.json({
        success: true,
        message: "Hello từ Node.js! Kết nối Sciter <-> Rust <-> Node.js thành công."
    });
});

// Route 404 cho các đường dẫn khác
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Đường dẫn không tồn tại!' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`----------------------------------------------------`);
    console.log(`🚀 API Gateway đang chạy với Express & Keycloak tại Cổng: ${PORT}`);
    console.log(`🔌 Địa chỉ lấy dữ liệu: http://127.0.0.1:${PORT}/clients`);
    console.log(`🔒 Đường dẫn này hiện đang được khóa và cần token từ Keycloak để truy cập!`);
    console.log(`----------------------------------------------------`);
});
