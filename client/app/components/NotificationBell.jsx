import { useState, useEffect, useRef } from "react";
import { Bell, Check } from "lucide-react"; // Import icon
import { notificationAPI } from "../services/api";
import { useSocket } from "../hooks/useSocket"; // Hook socket bạn đã làm
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale"; // Format ngày tháng tiếng Việt

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const dropdownRef = useRef(null);
  const socket = useSocket(); // Lấy socket instance

  // 1. Tải thông báo lần đầu
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await notificationAPI.getNotifications({ limit: 10 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error("Lỗi tải thông báo:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // 2. Lắng nghe Socket để cập nhật realtime
    // Sự kiện 'notification_received' được bắn từ Backend (notificationService)
    if (socket) {
      socket.on("notification_received", (newNotif) => {
        // Thêm thông báo mới vào đầu danh sách
        setNotifications((prev) => [newNotif, ...prev]);
        // Tăng số lượng chưa đọc
        setUnreadCount((prev) => prev + 1);
      });
    }

    // Cleanup listener khi unmount
    return () => {
      if (socket) socket.off("notification_received");
    };
  }, [socket]);

  // 3. Xử lý đóng mở dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 4. Đánh dấu đã đọc
  const handleMarkRead = async (notif) => {
    if (notif.read_at) return; // Đã đọc rồi thì thôi

    try {
      await notificationAPI.markAsRead(notif.id);
      // Cập nhật UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date() })));
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút Chuông */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Danh sách */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Thông báo</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Đánh dấu đã đọc hết
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Chưa có thông báo nào
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <li
                    key={notif.id || `temp-${notif.timestamp}`} // Fallback key cho notif realtime chưa có ID DB ngay (nếu có)
                    className={`hover:bg-gray-50 transition-colors ${
                      !notif.read_at ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div
                      onClick={() => handleMarkRead(notif)}
                      className="block px-4 py-3 cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className={`text-sm ${!notif.read_at ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                            {notif.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notif.timestamp || notif.created_at
                              ? formatDistanceToNow(new Date(notif.timestamp || notif.created_at), {
                                  addSuffix: true,
                                  locale: vi,
                                })
                              : "Vừa xong"}
                          </p>
                        </div>
                        {!notif.read_at && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-gray-50 text-center">
            <Link
              to="/notifications"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setIsOpen(false)}
            >
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}