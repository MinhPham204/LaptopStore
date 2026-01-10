const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FE_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true // Thêm dòng này để cho phép cookie/auth
    },
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Sự kiện: Người dùng tham gia vào "phòng" (room) riêng của họ
    // Client sẽ gửi userId lên khi kết nối
    socket.on("join_user_room", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room user_${userId}`);
      }
    });

    // Sự kiện: Admin tham gia vào phòng "admin"
    // Client gửi role lên, nếu là admin thì join
    socket.on("join_admin_room", () => {
      socket.join("admin_room");
      console.log(`Socket ${socket.id} joined admin_room`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
    });
  });

  return io;
};

// Hàm helper để lấy instance io ở các file khác (controller)
const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIO };