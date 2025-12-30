import React, { useState } from 'react';
import { ScheduleTable } from './components/ScheduleTable';
import * as Supabase from './services/supabaseService';
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useAppStore } from './store/appStore';
import { useToast } from './components/Toast';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { DashboardLayout } from './components/DashboardLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
    const { currentUser, loadingAuth } = useAuth();
    const { ministryId, themeMode, setThemeMode } = useAppStore();
    const { addToast, confirmAction } = useToast();
    const [eventDetailsModal, setEventDetailsModal] = useState({ isOpen: false, event: null });
    const [currentTab, setCurrentTab] = useState('dashboard');
    
    // Date handling for current month
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

    const {
        events, roles, schedule, attendance, availability, availabilityNotes,
        membersMap, publicMembers, globalConflicts, refreshData, notifications
    } = useMinistryData(ministryId, currentMonth, currentUser);

    const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);

    if (loadingAuth) return <LoadingScreen />;
    if (!currentUser) return <LoginScreen />;

    // Navigation Items
    const mainNavItems = [
        { id: 'dashboard', label: 'Visão Geral', icon: <div /> }, // Icons would be imported from lucide-react
        { id: 'calendar', label: 'Escala', icon: <div /> },
    ];

    return (
        <DashboardLayout
            title="Gestão Escala"
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onLogout={async () => { await Supabase.getSupabase()?.auth.signOut(); window.location.reload(); }}
            mainNavItems={mainNavItems}
            managementNavItems={[]}
            notifications={notifications}
            onNotificationsUpdate={() => refreshData()}
        >
            {currentTab === 'calendar' && (
                <ScheduleTable 
                    events={events} 
                    roles={roles} 
                    schedule={schedule} 
                    attendance={attendance} 
                    availability={availability}
                    availabilityNotes={availabilityNotes}
                    members={membersMap} 
                    allMembers={publicMembers.map(m => m.name)} 
                    memberProfiles={publicMembers} 
                    scheduleIssues={{}} 
                    globalConflicts={globalConflicts} 
                    onCellChange={async (key: string, memberId: string) => { 
                        // PROMPT FIX: Receive UUID directly from ScheduleTable
                        const success = await Supabase.saveScheduleAssignment(ministryId, key, memberId); 
                        if (success) {
                            refreshData(); 
                        } else {
                            addToast("Erro ao salvar: Membro inválido ou erro de conexão.", "error");
                        }
                    }} 
                    onAttendanceToggle={async (key: string) => { await Supabase.toggleAssignmentConfirmation(ministryId, key); refreshData(); }} 
                    onDeleteEvent={async (iso: string, title: string) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]); refreshData(); })} 
                    onEditEvent={(event: any) => setEventDetailsModal({ isOpen: true, event })} 
                    memberStats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} 
                    ministryId={ministryId} 
                    readOnly={false} 
                    onlineUsers={onlineUsers} 
                />
            )}
            {/* Other tabs would go here */}
        </DashboardLayout>
    );
}
