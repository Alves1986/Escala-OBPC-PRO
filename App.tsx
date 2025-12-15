
// ... existing code ...
                {/* Other Tabs Mapped to Lazy Components */}
                {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
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
                                await Supabase.saveMemberAvailability(p.id, member, dates, targetMonth, ministryId, notes); 
                                loadData(); 
                            }
                        }} 
                        availabilityWindow={availabilityWindow} 
                    />
                )}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { await loadData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'} ministryId={ministryId} />}
// ... existing code ...
            {/* Modals & Global UI */}
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); loadData(); }} onRemove={async (id) => { loadData(); }} />
            <AvailabilityModal 
                isOpen={isAvailModalOpen} 
                onClose={() => setAvailModalOpen(false)} 
                members={publicMembers.map(m => m.name)} 
                availability={availability} 
                onUpdate={async (member, dates) => { 
                    const p = publicMembers.find(pm => pm.name === member); 
                    if (p) { 
                        await Supabase.saveMemberAvailability(p.id, member, dates, currentMonth, ministryId, {}); 
                        loadData(); 
                    }
                }} 
                currentMonth={currentMonth} 
            />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
            <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
// ... existing code ...
