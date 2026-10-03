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
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={role || 'STUDENT'}
      />

      <div className="main-wrapper">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          unreadNotificationsCount={unreadCount}
          userName={userProfile?.name || 'Campus Member'}
          userRole={role || 'STUDENT'}
          onLogout={handleLogout}
        />

        <main className="content-container">
          <Outlet />
        </main>

        <BottomNav onOpenMenu={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
};
