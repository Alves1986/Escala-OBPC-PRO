
                {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'availability' && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (member, dates, notes, targetMonth) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(ministryId, p.id, member, dates, targetMonth, notes); loadData(); }}} availabilityWindow={availabilityWindow} />}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { await loadData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'} ministryId={ministryId} />}
                {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(() => loadData())} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(() => loadData())} />}
                {currentTab === 'send-announcements' && isAdmin && <AlertsManager onSend={async (title, message, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title, message, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name); loadData(); }} />}
                {currentTab === 'report' && isAdmin && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await loadData(); }} />}
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
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(ministryId, p.id, member, dates, currentMonth, {}); loadData(); }}} currentMonth={currentMonth} />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
