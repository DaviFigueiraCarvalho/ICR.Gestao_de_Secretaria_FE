import { useICRAuth } from "@/contexts/ICRAuthContext";
import { useLocation } from "wouter";
import { LayoutDashboard, Users, LogOut, PanelLeft, Church, Hub, Group } from "lucide-react";
import { Button } from "./ui/button";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger, SidebarInset } from "./ui/sidebar";
import { Avatar, AvatarFallback } from "./ui/avatar";

const menuItems = [
  { icon: LayoutDashboard, label: "Início", path: "/" },
  { icon: Church, label: "Igrejas", path: "/igrejas" },
  { icon: Users, label: "Membros", path: "/membros" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated } = useICRAuth();
  const [location, setLocation] = useLocation();

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 justify-center px-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#017158] p-1.5 rounded-lg text-white">ICR</div>
            <span className="font-bold text-[#017158] group-data-[collapsible=icon]:hidden">Secretaria</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton 
                  isActive={location === item.path}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                >
                  <item.icon className={location === item.path ? "text-[#017158]" : ""} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{user?.memberName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium truncate">{user?.memberName}</p>
            </div>
            <button onClick={logout} className="text-destructive hover:bg-destructive/10 p-1 rounded group-data-[collapsible=icon]:hidden">
              <LogOut size={16} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-4 lg:h-[60px]">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}