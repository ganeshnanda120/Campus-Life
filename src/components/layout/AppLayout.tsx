import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../context/useAuth';
import { notificationService } from '../../services/notificationService';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userProfile, role, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsubscribe = notificationService.subscribeNotifications(userProfile.uid, (notifs) => {
      const count = notifs.filter((n) => !n.isRead).length;
      setUnreadCount(count);
    });
    return () => {
      unsubscribe();
    };
  }, [userProfile?.uid]);

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('campus_life_logged_out', 'true');
    } catch {
      // ignore
    }
    navigate('/login', { replace: true, state: { isLogout: true } });
    await logout();
  };

  return (
    <div className="app-shell h-screen w-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 2. Top Header at fixed height */}
      <Header
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        unreadNotificationsCount={unreadCount}
        userName={userProfile?.name || 'Campus Member'}
        userRole={role || 'STUDENT'}
        onLogout={handleLogout}
      />

      {/* Decoupled side-by-side work zone */}
      <div className="layout-body flex-1 flex flex-row overflow-hidden min-h-0 relative">
        {/* 3. Sidebar Navigation constrained to calc(100vh - 4rem) */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userRole={role || 'STUDENT'}
        />

        {/* 4. Main Content Area independently scrollable */}
        <main className="main-viewport flex-1 h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <div className="content-container">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav onOpenMenu={() => setSidebarOpen(true)} />
    </div>
  );
};
