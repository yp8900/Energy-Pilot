import { Link, useLocation } from "wouter";
import { LayoutDashboard, Server, BarChart3, AlertTriangle, Settings, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Devices", icon: Server, href: "/devices" },
  { name: "Analytics", icon: BarChart3, href: "/analytics" },
  { name: "Alarms", icon: AlertTriangle, href: "/alarms" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border/50 flex flex-col z-50">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center mr-3 shadow-lg shadow-primary/20">
          <span className="font-bold text-primary-foreground">E</span>
        </div>
        <span className="font-bold text-lg tracking-wider text-foreground">PLANT<span className="text-primary">EMS</span></span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_4px_0_0_0_theme(colors.primary.DEFAULT)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User / Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="User" className="w-full h-full rounded-full" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {user?.firstName || user?.username || "Operator"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || "System Admin"}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center px-4 py-2 rounded-md bg-secondary text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border border-border hover:border-destructive/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
