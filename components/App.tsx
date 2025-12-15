
// ... existing code ...
                {currentTab === 'availability' && (
                    <AvailabilityScreen 
                        availability={availability} 
                        availabilityNotes={availabilityNotes} 
                        setAvailability={setAvailability} 
                        allMembersList={publicMembers.map(m => m.name)} 
                        currentMonth={currentMonth} 
                        onMonthChange={setCurrentMonth} 
                        currentUser={currentUser} 
                        onSaveAvailability={async (member, dates, notes, targetMonth) => { 
                            const p = publicMembers.find(pm => pm.name === member); 
                            if (p) { 
                                try {
                                    // Passando ministryId corretamente e tratando erros
                                    await Supabase.saveMemberAvailability(p.id, member, dates, targetMonth, ministryId!, notes); 
                                    await loadData(); 
                                } catch (e: any) {
                                    console.error("Failed to save availability:", e);
                                    addToast(`Erro ao salvar: ${e.message || 'Verifique sua conexão'}`, 'error');
                                }
                            }
                        }} 
                        availabilityWindow={availabilityWindow} 
                    />
                )}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId!, { requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId!, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId!} currentUser={currentUser} />}
// ... existing code ...
            {/* Modals & Global UI */}
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId!, e); loadData(); }} onRemove={async (id) => { loadData(); }} />
            <AvailabilityModal 
                isOpen={isAvailModalOpen} 
                onClose={() => setAvailModalOpen(false)} 
                members={publicMembers.map(m => m.name)} 
                availability={availability} 
                onUpdate={async (member, dates) => { 
                    const p = publicMembers.find(pm => pm.name === member); 
                    if (p) { 
                        try {
                            // Passando ministryId corretamente no Modal de Admin
                            await Supabase.saveMemberAvailability(p.id, member, dates, currentMonth, ministryId!, {}); 
                            loadData(); 
                        } catch (e: any) {
                            addToast("Erro ao salvar (Modal): " + e.message, "error");
                        }
                    }
                }} 
                currentMonth={currentMonth} 
            />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId!, undefined, newRoles); loadData(); }} />
            <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
// ... existing code ...
