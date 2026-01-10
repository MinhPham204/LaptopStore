const { Notification } = require("../models");
const { Op } = require("sequelize"); // Import Op

// Lấy danh sách thông báo của user
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Notification.findAndCountAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    //Dùng Op.is để so sánh với NULL
    const unreadCount = await Notification.count({
      where: { 
        user_id: userId, 
        read_at: { [Op.is]: null } // Thay vì read_at: null
      },
    });

    res.json({
      notifications: rows,
      unreadCount,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Đánh dấu đã đọc
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    // Nếu id = 'all' thì đánh dấu tất cả
    if (id === "all") {
      await Notification.update(
        { read_at: new Date() },
        { 
          where: { 
            user_id: userId, 
            read_at: { [Op.is]: null } // Sửa cả ở đây cho chắc chắn
          } 
        }
      );
    } else {
      await Notification.update(
        { read_at: new Date() },
        { where: { id: id, user_id: userId } }
      );
    }

    res.json({ message: "Marked as read" });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    await Notification.update(
      { read_at: new Date() }, // Cập nhật thời gian hiện tại
      {
        where: {
          user_id: userId,
          read_at: { [Op.is]: null }, // Chỉ update những cái chưa đọc
        },
      }
    );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};