import React, { useState, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { DashboardLayout } from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { useToast } from './components/Toast';
import * as Supabase from './services/supabaseService';

const LoadingFallback = () => <LoadingScreen />;

const InnerApp = () => {
  const { currentUser, loadingAuth } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { addToast } = useToast();

  const ministryId = currentUser?.ministryId || 'midia';

  // Fix for line 14 errors: Define missing names
  const { 
    events, schedule, attendance,
    notifications, swapRequests, roles, 
    ministryTitle, 
    refreshData, isLoading: loadingData,
  } = useMinistryData(ministryId, currentMonth, currentUser);

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  return (
    <ErrorBoundary>
        <DashboardLayout
            title={ministryTitle}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onLogout={() => Supabase.getSupabase()?.auth.signOut()}
            mainNavItems={[
                { id: 'dashboard', label: 'Visão Geral', icon: <span /> },
                { id: 'calendar', label: 'Escala', icon: <span /> },
                { id: 'availability', label: 'Disponibilidade', icon: <span /> },
                { id: 'announcements', label: 'Avisos', icon: <span /> },
            ]}
            managementNavItems={currentUser.role === 'admin' ? [
                { id: 'swaps', label: 'Trocas', icon: <span /> },
                { id: 'members', label: 'Equipe', icon: <span /> },
            ] : []}
            notifications={notifications}
            onNotificationsUpdate={() => refreshData()}
        >
            <Suspense fallback={<LoadingFallback />}>
                {currentTab === 'swaps' && (
                  <SwapRequestsScreen 
                    schedule={schedule} 
                    currentUser={currentUser} 
                    requests={swapRequests} 
                    visibleEvents={events} 
                    onCreateRequest={async (role, iso, title) => { 
                      const res = await Supabase.createSwapRequestSQL(ministryId, { 
                          id: '', ministryId, requesterName: currentUser.name, 
                          requesterId: currentUser.id, role, eventIso: iso, 
                          eventTitle: title, status: 'pending', createdAt: new Date().toISOString() 
                      }); 
                      if (!res.success && res.message) addToast(res.message, "warning");
                      refreshData(); 
                    }} 
                    onAcceptRequest={async (reqId) => { 
                      await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); 
                      refreshData(); 
                    }}
                    onCancelRequest={async (reqId) => {
                      const ok = await Supabase.cancelSwapRequestSQL(reqId);
                      if (ok) addToast("Pedido cancelado.", "info");
                      refreshData();
                    }}
                  />
                )}

                {currentTab === 'announcements' && (
                    <AnnouncementsScreen 
                        announcements={[]} 
                        currentUser={currentUser} 
                        onMarkRead={() => {}} 
                        onToggleLike={() => {}} 
                    />
                )}
                
                {currentTab === 'dashboard' && (
                    <div className="p-4 bg-white rounded-xl shadow-sm border">
                        <h2 className="text-xl font-bold">Olá, {currentUser.name}</h2>
                        <p className="text-zinc-500">Selecione uma opção no menu lateral para começar.</p>
                    </div>
                )}
            </Suspense>
        </DashboardLayout>
    </ErrorBoundary>
  );
};

export default function App() {
    return <InnerApp />;
}
