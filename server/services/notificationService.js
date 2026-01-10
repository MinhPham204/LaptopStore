const { Notification, User, Role } = require("../models"); // Thêm Role vào import
const { getIO } = require("../config/socket");
const { Op } = require("sequelize");

/**
 * Service tạo thông báo:
 * 1. Lưu vào Database (để hiển thị lịch sử/hình cái chuông).
 * 2. Gửi Socket.IO (để hiển thị Toast/Popup realtime).
 */
exports.createNotification = async ({
  userId,
  title,
  message,
  type,
  relatedType,
  relatedId,
}) => {
  try {
    let io;
    try { io = getIO(); } catch (e) { /* Bỏ qua nếu socket chưa init */ }
    
    const socketPayload = {
      title, message, type, relatedType, relatedId, timestamp: new Date(),
    };

    // --- TRƯỜNG HỢP 1: Gửi cho Khách hàng cụ thể ---
    if (userId) {
      const notif = await Notification.create({
        user_id: userId,
        title, message, 
        type: type, // Đảm bảo cột type trong DB là VARCHAR
        related_entity_type: relatedType,
        related_entity_id: relatedId,
        read_at: null,
      });

      if (io) {
        io.to(`user_${userId}`).emit(type, { ...socketPayload, id: notif.id });
        io.to(`user_${userId}`).emit("notification_received", { ...socketPayload, id: notif.id });
      }
      return notif;
    }

    // --- TRƯỜNG HỢP 2: Gửi cho nhóm Admin/Staff ---
    else {
      // ===>>> SỬA LOGIC TÌM ADMIN Ở ĐÂY <<<===
      // Thay vì tìm where: { role: ... }, ta include bảng Role
      const admins = await User.findAll({
        include: [{
          model: Role,
          as: "Roles", // Hoặc 'roles' tuỳ vào alias trong User model của bạn
          where: { 
            role_name: { [Op.in]: ["admin", "staff"] } // Tìm user có role là admin hoặc staff
          },
          required: true // Inner join để lọc
        }],
        attributes: ["user_id"],
      });

      if (admins.length > 0) {
        const records = admins.map((admin) => ({
          user_id: admin.user_id,
          title, message, 
          type: type, 
          related_entity_type: relatedType,
          related_entity_id: relatedId,
          read_at: null,
        }));

        await Notification.bulkCreate(records);
      } else {
        console.warn("NotificationService: Không tìm thấy tài khoản Admin/Staff nào để lưu thông báo.");
      }

      // Gửi Socket (vẫn gửi bình thường cho ai đang join room admin)
      if (io) {
        io.to("admin_room").emit(type, socketPayload);
        io.to("admin_room").emit("notification_received", socketPayload);
      }
    }
  } catch (error) {
    console.error("Notification Service Error:", error);
  }
};