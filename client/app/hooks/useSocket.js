import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

// URL của Server Socket
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || "http://localhost:5000";

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"], // Ưu tiên websocket
      reconnectionAttempts: 5,
    });

    // Debug sự kiện kết nối
    newSocket.on("connect", () => {
      console.log("[Socket Client] Đã kết nối thành công! ID:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[Socket Client] Lỗi kết nối:", err.message);
    });

    // Lưu instance vào state
    setSocket(newSocket);

    // Cleanup khi unmount
    return () => {
      console.log("[Socket Client] Ngắt kết nối...");
      newSocket.disconnect();
    };
  }, []); 

  // 2. Join Room và Đăng ký lắng nghe sự kiện (Chạy khi socket hoặc user thay đổi)
  useEffect(() => {
    if (!socket || !isAuthenticated || !user) return;

    console.log("[Socket Client] Tham gia phòng cho User:", user.user_id);

    // --- JOIN ROOM ---
    socket.emit("join_user_room", user.user_id);

    // Kiểm tra quyền admin/staff để join room quản trị
    const isAdminOrStaff = user.role === "admin" || user.role === "staff" || 
                           (user.Roles && user.Roles.some(r => ["admin", "staff"].includes(r.role_name)));

    if (isAdminOrStaff) {
      console.log("[Socket Client] Tham gia phòng Admin");
      socket.emit("join_admin_room");
    }

    // --- ĐỊNH NGHĨA HANDLERS (Để dễ cleanup) ---
    
    const handleNewOrder = (data) => {
      console.log("[Socket Client] Nhận sự kiện 'new_order':", data);
      toast.info(`💰 ${data.message}`, {
        position: "top-right",
        autoClose: 5000,
        onClick: () => window.location.href = `/admin/orders`
      });
    };

    const handleNewQuestion = (data) => {
      console.log("[Socket Client] Nhận sự kiện 'new_question':", data);
      toast.warning(`${data.message}`, {
        onClick: () => window.location.href = `/products/${data.relatedId}`
      });
    };

    const handleNewAnswer = (data) => {
      console.log("[Socket Client] Nhận sự kiện 'new_answer':", data);
      toast.info(`${data.message}`, {
        onClick: () => window.location.href = `/products/${data.relatedId}`
      });
    };

    const handleOrderStatus = (data) => {
      console.log("[Socket Client] Nhận sự kiện 'order_status_updated':", data);
      toast.success(`${data.message}`, {
        onClick: () => window.location.href = `/orders/${data.relatedId}`
      });
    };

    const handlePaymentSuccess = (data) => {
      console.log("[Socket Client] Nhận sự kiện 'payment_success':", data);
      toast.success(`${data.message}`, {
        autoClose: 7000,
        onClick: () => window.location.href = `/orders/${data.relatedId}`
      });
    };
    
    const handlePaymentReceived = (data) => {
        console.log("[Socket Client] Nhận sự kiện 'payment_received':", data);
        toast.success(`${data.message}`);
    };

    // --- ĐĂNG KÝ LẮNG NGHE ---
    socket.on("new_order", handleNewOrder);
    socket.on("new_question", handleNewQuestion);
    socket.on("new_answer", handleNewAnswer);
    socket.on("order_status_updated", handleOrderStatus);
    socket.on("payment_success", handlePaymentSuccess);
    socket.on("payment_received", handlePaymentReceived);

    // --- CLEANUP ---
    // Gỡ bỏ listener cũ khi component re-render hoặc user logout để tránh bị duplicate thông báo
    return () => {
      socket.off("new_order", handleNewOrder);
      socket.off("new_question", handleNewQuestion);
      socket.off("new_answer", handleNewAnswer);
      socket.off("order_status_updated", handleOrderStatus);
      socket.off("payment_success", handlePaymentSuccess);
      socket.off("payment_received", handlePaymentReceived);
    };

  }, [socket, isAuthenticated, user]); // Phụ thuộc vào socket và user

  return socket;
};