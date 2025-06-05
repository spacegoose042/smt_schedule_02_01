import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Work Orders', href: '/work-orders', icon: ClipboardDocumentListIcon },
  { name: 'SMT Lines', href: '/lines', icon: CubeIcon },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 shrink-0 items-center px-6">
          <img
            className="h-8 w-auto"
            src="/logo.png"
            alt="S&Y Industries"
          />
        </div>
        <nav className="flex flex-1 flex-col px-4 py-4">
          <ul role="list" className="flex flex-1 flex-col gap-y-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                    }`}
                  >
                    <item.icon
                      className={`h-6 w-6 shrink-0 ${
                        isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-600'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-6 border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex flex-1 justify-end">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* Content area */}
        <main className="py-8 px-6">
          {children}
        </main>
      </div>
    </div>
  );
} 