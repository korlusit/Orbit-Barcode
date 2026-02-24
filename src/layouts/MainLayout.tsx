
import { Outlet, NavLink } from "react-router-dom";
import { Package, BarChart3, Settings, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";

export const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black">
      <main className="flex-1 overflow-y-auto pb-24 safe-area-inset-bottom">
        <Outlet />
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-white/80 dark:bg-black/80 backdrop-blur-lg border-white/20 pb-safe z-50">
        <div className="flex justify-around items-center h-16">
          <NavItem to="/" icon={<ScanBarcode size={24} />} label="POS" />
          <NavItem to="/inventory" icon={<Package size={24} />} label="Stocks" />
          <NavItem to="/reports" icon={<BarChart3 size={24} />} label="Reports" />
          <NavItem to="/settings" icon={<Settings size={24} />} label="Settings" />
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
        isActive 
          ? "text-ios-blue" 
          : "text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
      )
    }
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </NavLink>
);
