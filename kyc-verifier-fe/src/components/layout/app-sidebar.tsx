import * as React from 'react';
import { IconChartBar, IconDashboard, IconFolder, IconHelp, IconInnerShadowTop, IconUsers, IconBriefcase } from '@tabler/icons-react';

import { NavMain } from '@/components/layout/nav-main';
import { NavSecondary } from '@/components/layout/nav-secondary';
import { NavUser } from '@/components/layout/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'KYC Applications',
      url: '/kyc-applications',
      icon: IconDashboard,
    },
    {
      title: 'Clients',
      url: '/clients',
      icon: IconBriefcase,
    },
    {
      title: 'Organizations',
      url: '/organizations',
      icon: IconUsers,
    },
    {
      title: 'Documents',
      url: '/documents',
      icon: IconFolder,
    },
    {
      title: 'Analytics',
      url: '/analytics',
      icon: IconChartBar,
    },
  ],
  navSecondary: [
    {
      title: 'Help and Support',
      url: '#',
      icon: IconHelp,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="offcanvas"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">truffles.one</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary
          items={data.navSecondary}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
