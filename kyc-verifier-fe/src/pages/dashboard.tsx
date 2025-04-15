import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";


export default function Dashboard() {
  return    <SidebarProvider>
  <AppSidebar variant="inset" />
  <SidebarInset>
    <SiteHeader />
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-4 p-4  md:gap-6 md:p-6">
        <motion.div
          className="flex justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </motion.div>
        <motion.div
          className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
        </motion.div>
      </div>
    </div>
  </SidebarInset>
</SidebarProvider>
}