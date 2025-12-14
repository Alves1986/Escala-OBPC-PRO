
// ... existing imports ...
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';

// --- Lazy Load Heavy Components (Code Splitting) ---
const ScheduleTable = React.lazy(() => import('./components/ScheduleTable').then(module => ({ default: module.ScheduleTable })));
const CalendarGrid = React.lazy(() => import('./components/CalendarGrid').then(module => ({ default: module.CalendarGrid })));
const AvailabilityScreen = React.lazy(() => import('./components/AvailabilityScreen').then(module => ({ default: module.AvailabilityScreen })));
const SwapRequestsScreen = React.lazy(() => import('./components/SwapRequestsScreen').then(module => ({ default: module.SwapRequestsScreen })));
const RepertoireScreen = React.lazy(() => import('./components/RepertoireScreen').then(module => ({ default: module.RepertoireScreen })));
const AnnouncementsScreen = React.lazy(() => import('./components/AnnouncementsScreen').then(module => ({ default: module.AnnouncementsScreen })));
const AlertsManager = React.lazy(() => import('./components/AlertsManager').then(module => ({ default: module.AlertsManager })));
const AvailabilityReportScreen = React.lazy(() => import('./components/AvailabilityReportScreen').then(module => ({ default: module.AvailabilityReportScreen })));
const SettingsScreen = React.lazy(() => import('./components/SettingsScreen').then(module => ({ default: module.SettingsScreen })));
const ProfileScreen = React.lazy(() => import('./components/ProfileScreen').then(module => ({ default: module.ProfileScreen })));
const EventsScreen = React.lazy(() => import('./components/EventsScreen').then(module => ({ default: module.EventsScreen })));
const RankingScreen = React.lazy(() => import('./components/RankingScreen').then(module => ({ default: module.RankingScreen })));
const MembersScreen = React.lazy(() => import('./components/MembersScreen').then(module => ({ default: module.MembersScreen })));
const SocialMediaScreen = React.lazy(() => import('./components/SocialMediaScreen').then(module => ({ default: module.SocialMediaScreen })));
const AdminReportsScreen = React.lazy(() => import('./components/AdminReportsScreen').then(module => ({ default: module.AdminReportsScreen })));

// Loading Spinner para Lazy Components
// ... existing LoadingFallback ...

const InnerApp = () => {
  // ... existing code ...

  const MAIN_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas de Escala', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
    { id: 'ranking', label: 'Destaques', icon: <Trophy size={20}/> },
    { id: 'social', label: 'Redes Sociais', icon: <Share2 size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'admin-reports', label: 'Relatórios (KPIs)', icon: <FileBarChart size={20}/> }, // Updated here
    { id: 'report', label: 'Disponibilidade (Mês)', icon: <CalendarDays size={20}/> }, // Renamed slightly to distinguish
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
  ];

  const isAdmin = currentUser.role === 'admin';

  return (
    <ErrorBoundary>
        <DashboardLayout
            // ... existing props ...
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            mainNavItems={MAIN_NAV}
            managementNavItems={isAdmin ? MANAGEMENT_NAV : []}
            // ... existing props ...
        >
            <Suspense fallback={<LoadingFallback />}>
                {/* ... existing routes ... */}
                {currentTab === 'schedule-editor' && isAdmin && (
                    // ... existing schedule editor ...
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                            <div><h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3"><Edit className="text-blue-600 dark:text-blue-500" size={32} /> Editor de Escala</h2><p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p></div>
                            <div className="flex items-center gap-3">
                                <ToolsMenu onExportIndividual={() => {}} onExportFull={() => {}} onWhatsApp={() => {}} onClearMonth={() => confirmAction("Limpar?", "Limpar toda a escala do mês?", () => Supabase.clearScheduleForMonth(ministryId, currentMonth).then(() => loadData()))} onResetEvents={() => confirmAction("Restaurar?", "Restaurar eventos padrão?", () => Supabase.resetToDefaultEvents(ministryId, currentMonth).then(() => loadData()))} onAiAutoFill={handleAiAutoFill} onSyncCalendar={handleSyncCalendar} allMembers={publicMembers.map(m => m.name)} />
                                <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-700 shadow-sm text-white"><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowLeft size={16}/></button><span className="text-sm font-bold min-w-[80px] text-center">{currentMonth}</span><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowRight size={16}/></button></div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><Clock size={18} /> Eventos</button>
                            <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><ShieldAlert size={18} /> Indisponibilidade</button>
                            <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><Settings size={18} /> Funções</button>
                        </div>
                        <ScheduleTable events={events} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={membersMap} allMembers={publicMembers.map(m => m.name)} memberProfiles={publicMembers} scheduleIssues={{}} globalConflicts={globalConflicts} onCellChange={handleCellChange} onAttendanceToggle={handleAttendanceToggle} onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]); loadData(); })} onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} memberStats={Object.values(schedule).reduce((acc: any, val: any) => { if(val) acc[val] = (acc[val] || 0) + 1; return acc; }, {})} ministryId={ministryId} readOnly={false} onlineUsers={onlineUsers} />
                    </div>
                )}

                {/* Other Tabs Mapped to Lazy Components */}
                {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'availability' && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (member, dates, notes, targetMonth) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates, targetMonth, notes); loadData(); }}} availabilityWindow={availabilityWindow} />}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { await loadData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'} ministryId={ministryId} />}
                {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(() => loadData())} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(() => loadData())} />}
                {currentTab === 'send-announcements' && isAdmin && <AlertsManager onSend={async (title, message, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title, message, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name); loadData(); }} />}
                {currentTab === 'report' && isAdmin && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await loadData(); }} />}
                {currentTab === 'admin-reports' && isAdmin && <AdminReportsScreen ministryId={ministryId} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { const res = await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); if (res.success) { addToast(res.message, "success"); if (currentUser) { setCurrentUser({ ...currentUser, name, whatsapp, avatar_url: avatar || currentUser.avatar_url, functions: funcs, birthDate: bdate }); } loadData(); } else { addToast(res.message, "error"); }}} availableRoles={roles} />}
                {currentTab === 'settings' && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={handleSetThemeMode} onSaveTheme={handleSaveTheme} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); setMinistryTitle(newTitle); addToast("Nome do ministério atualizado!", "success"); }} onAnnounceUpdate={async () => { await Supabase.sendNotificationSQL(ministryId, { title: "Atualização de Sistema", message: "Uma nova versão do app está disponível. Recarregue a página para aplicar.", type: "warning" }); addToast("Notificação de atualização enviada.", "success"); }} onEnableNotifications={handleEnableNotifications} onSaveAvailabilityWindow={async (start, end) => { setAvailabilityWindow({ start, end }); await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); loadData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
                {currentTab === 'social' && <SocialMediaScreen />}
                
                {currentTab === 'members' && isAdmin && (
                    <MembersScreen 
                        members={publicMembers} 
                        onlineUsers={onlineUsers} 
                        currentUser={currentUser}
                        availableRoles={roles}
                        onToggleAdmin={async (email, currentStatus, name) => {
                            if (!email) return addToast("Usuário sem e-mail não pode ser admin.", "error");
                            const newStatus = !currentStatus;
                            await Supabase.toggleAdminSQL(email, newStatus, ministryId);
                            loadData();
                            addToast(`${name} agora é ${newStatus ? 'Admin' : 'Membro'}.`, 'success');
                        }}
                        onRemoveMember={async (id, name) => {
                            confirmAction(
                                "Remover Membro",
                                `Deseja remover ${name} da equipe? Isso removerá o acesso dele ao ministério atual.`,
                                async () => {
                                    const result = await Supabase.deleteMember(ministryId, id, name);
                                    if (result.success) {
                                        setPublicMembers(prev => prev.filter(m => m.id !== id));
                                        loadData(false);
                                        addToast(`${name} removido.`, "success");
                                    } else {
                                        addToast(`Erro: ${result.message}`, "error");
                                    }
                                }
                            );
                        }}
                    />
                )}
            </Suspense>

            {/* Modals & Global UI */}
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); loadData(); }} onRemove={async (id) => { loadData(); }} />
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates, currentMonth, {}); loadData(); }}} currentMonth={currentMonth} />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
            <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={handleJoinMinistry} alreadyJoined={currentUser.allowedMinistries || []} />
            {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, applyToAll) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso, applyToAll); loadData(); setEventDetailsModal({ isOpen: false, event: null }); addToast("Evento atualizado.", "success"); }} onSwapRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if (success) { addToast("Troca solicitada!", "success"); loadData(); setEventDetailsModal({ isOpen: false, event: null }); }}} currentUser={currentUser} ministryId={ministryId} canEdit={isAdmin} />}
            <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={(() => { const stats: Record<string, number> = {}; Object.values(schedule).forEach((val) => { const name = val as string; if (name) stats[name] = (stats[name] || 0) + 1; }); return stats; })()} monthName={getMonthName(currentMonth)} />
            <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key); loadData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
        </DashboardLayout>
    </ErrorBoundary>
  );
};
