import { useSelector, useDispatch } from "react-redux"
import { Navigate, useLocation, Link } from "react-router-dom"
import { logout } from "../store/slices/authSlice"

import Header from "./Header" 

import { 
  LuLayoutDashboard, 
  LuChartBar, 
  LuPackage, 
  LuShoppingCart, 
  LuUsers, 
  LuFolder, 
  LuTag, 
  LuMessageCircle, 
  LuLogOut 
} from "react-icons/lu"

function AdminLayout({ children, onLogout }) {
  const location = useLocation()

  const menuItems = [
    { title: "Trang chủ", icon: <LuLayoutDashboard className="w-5 h-5" />, path: "/admin" },
    { title: "Thống kê", icon: <LuChartBar className="w-5 h-5" />, path: "/admin/analytics" },
    { title: "Sản phẩm", icon: <LuPackage className="w-5 h-5" />, path: "/admin/products" },
    { title: "Đơn hàng", icon: <LuShoppingCart className="w-5 h-5" />, path: "/admin/orders" },
    { title: "Người dùng", icon: <LuUsers className="w-5 h-5" />, path: "/admin/users" },
    { title: "Danh mục", icon: <LuFolder className="w-5 h-5" />, path: "/admin/categories" },
    { title: "Thương hiệu", icon: <LuTag className="w-5 h-5" />, path: "/admin/brands" },
    { title: "Q&A", icon: <LuMessageCircle className="w-5 h-5" />, path: "/admin/questions" },
  ]

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin"
    return location.pathname.startsWith(path)
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      
      <div className="z-50 bg-white shadow-md flex-shrink-0">
         <Header />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
      
        <aside className="w-64 bg-white shadow-lg overflow-y-auto flex-shrink-0 hidden md:block">
          <div className="flex flex-col h-full"> 
            
            <div className="h-16 px-6 border-b border-gray-200 flex items-center bg-blue-50">
              <h1 className="text-lg font-bold text-blue-800 uppercase">Admin Menu</h1>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${
                    isActive(item.path)
                      ? "bg-blue-50 text-blue-700 border-r-4 border-blue-700"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.title}
                </Link>
              ))}
            </nav>

          </div>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
          {children}
        </main>

      </div>
    </div>
  )
}

// Logic check quyền giữ nguyên
export default function AdminRoute({ children }) {
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.roles?.includes("admin")) return <Navigate to="/" replace />

  const handleLogout = () => {
    dispatch(logout())
  }

  return <AdminLayout onLogout={handleLogout}>{children}</AdminLayout>
}