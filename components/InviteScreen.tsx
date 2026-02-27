import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, UserPlus, AlertOctagon, Loader2, Mail, Lock, Phone, User, Calendar, Briefcase, Building2, Check } from 'lucide-react';
import { validateInviteToken, registerWithInvite, fetchMinistrySettings } from '../services/supabaseService';
import { getSupabase } from '../services/supabase/client';

interface Props {
    token: string;
    onClear: () => void;
}

export const InviteScreen: React.FC<Props> = ({ token, onClear }) => {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
    const [inviteData, setInviteData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");
    
    // Ministry Data
    const [ministryName, setMinistryName] = useState("Ministério não encontrado");
    
    // Roles Data
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);

    // Form Data
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [birthDate, setBirthDate] = useState("");
    
    const [registering, setRegistering] = useState(false);


    const isUUID = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    useEffect(() => {
        const check = async () => {
            const res = await validateInviteToken(token);
            
            if (res.valid) {
                const rawInviteData: any = res.data || {};
                console.log("INVITE RAW:", rawInviteData);

                const ministryId =
                    res.data?.ministryId ||
                    res.data?.ministry_id;

                try {
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } catch (e) {
                    console.warn("Não foi possível limpar a URL", e);
                }

                const incomingMinistry = ministryId || rawInviteData.ministry;
                const incomingOrgId = rawInviteData.orgId || rawInviteData.organization_id || rawInviteData.org_id;

                if (!incomingMinistry || !incomingOrgId) {
                    setErrorMsg("Convite inválido ou ministério não encontrado.");
                    setStatus('invalid');
                    return;
                }

                setLoadingRoles(true);
                try {
                    const sb = getSupabase();
                    let ministry: any = null;
                    let realMinistryId: string | null = null;

                    if (isUUID(String(incomingMinistry))) {
                        realMinistryId = String(incomingMinistry);
                        if (sb) {
                            const { data } = await sb
                                .from('organization_ministries')
                                .select('*')
                                .eq('id', realMinistryId)
                                .eq('organization_id', incomingOrgId)
                                .maybeSingle();
                            ministry = data;
                        }
                    } else if (sb) {
                        const { data } = await sb
                            .from('organization_ministries')
                            .select('*')
                            .eq('organization_id', incomingOrgId)
                            .or(`label.eq.${incomingMinistry},name.eq.${incomingMinistry},title.eq.${incomingMinistry},ministry_name.eq.${incomingMinistry}`)
                            .maybeSingle();

                        ministry = data;
                        if (isUUID(String(ministry?.id || ''))) {
                            realMinistryId = String(ministry.id);
                        }
                    }

                    if (!realMinistryId || !isUUID(realMinistryId) || !incomingOrgId) {
                        setErrorMsg("Convite inválido ou ministério não encontrado.");
                        setStatus('invalid');
                        setMinistryName('Ministério não encontrado');
                        setAvailableRoles([]);
                        return;
                    }

                    const finalInviteData = {
                        ...rawInviteData,
                        ministryId: realMinistryId,
                        orgId: incomingOrgId
                    };

                    console.log("INVITE DATA", finalInviteData);
                    setInviteData(finalInviteData);
                    setStatus('valid');

                    const ministryLabel =
                        ministry?.label ||
                        ministry?.name ||
                        ministry?.title ||
                        ministry?.ministry_name ||
                        'Ministério não encontrado';

                    setMinistryName(ministryLabel);

                    if (isUUID(realMinistryId) && incomingOrgId) {
                        const settings = await fetchMinistrySettings(realMinistryId, incomingOrgId);
                        const rolesFromSettings = Array.isArray(settings?.roles)
                            ? settings.roles.filter((role: string) => role?.trim().length > 0)
                            : [];
                        setAvailableRoles(rolesFromSettings);
                    }
                } catch (e) {
                    console.error("Failed to load roles", e);
                    setErrorMsg("Convite inválido ou ministério não encontrado.");
                    setStatus('invalid');
                    setMinistryName('Ministério não encontrado');
                    setAvailableRoles([]);
                } finally {
                    setLoadingRoles(false);
                }
            } else {
                setErrorMsg(res.message || "Convite inválido");
                setStatus('invalid');
            }
        };
        check();
    }, [token]);

    const toggleRole = (role: string) => {
        let newRoles;
        if (selectedRoles.includes(role)) {
            newRoles = selectedRoles.filter(r => r !== role);
        } else {
            newRoles = [...selectedRoles, role];
        }
        setSelectedRoles(newRoles);
    };

    const isPasswordConfirmationValid = confirmPass.length > 0 && password === confirmPass;

    const isFormValid = 
        name.trim().length > 0 &&
        email.trim().length > 0 &&
        whatsapp.trim().length > 0 &&
        birthDate.trim().length > 0 &&
        password.trim().length > 0 &&
        password.length >= 6 &&
        isPasswordConfirmationValid &&
        selectedRoles.length > 0;

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isFormValid) {
            setErrorMsg("Preencha todos os campos e selecione ao menos uma função.");
            return;
        }

        setRegistering(true);
        setErrorMsg("");

        try {
            const res = await registerWithInvite(token, {
                name,
                email,
                password,
                whatsapp,
                birthDate,
                roles: selectedRoles
            });

            if (res.success) {
                setStatus('success');
                setTimeout(() => {
                    window.location.href = '/'; 
                }, 2000);
            } else {
                setErrorMsg(res.message || "Erro ao registrar.");
            }
        } catch (e: any) {
            setErrorMsg(e.message || "Erro desconhecido.");
        } finally {
            setRegistering(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-teal-500 mb-4" size={32} />
                <p className="text-sm font-medium text-zinc-400">Validando convite...</p>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <AlertOctagon className="text-red-500" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Link Inválido</h1>
                <p className="text-zinc-400 mb-8 max-w-sm">{errorMsg}</p>
                <button 
                    onClick={onClear}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                    Ir para Login
                </button>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-slide-up">
                    <CheckCircle2 className="text-green-500" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Conta Criada!</h1>
                <p className="text-zinc-400 mb-4">Redirecionando para o painel...</p>
                <Loader2 className="animate-spin text-zinc-600" size={20} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-2xl animate-fade-in">
                
                <div className="text-center mb-8">
                    <div className="inline-flex p-3 bg-teal-500/10 rounded-2xl mb-4">
                        <UserPlus className="text-teal-500" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Cadastro de Membro</h1>
                    <p className="text-zinc-400 text-sm mt-1">Complete seus dados para entrar na equipe.</p>
                </div>

                {inviteData && (
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 mb-6 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-teal-500"/>
                            <span className="text-white text-sm font-bold">
                                Você está entrando em: <span className="text-teal-400">{ministryName}</span>
                            </span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nome Completo *</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="Seu nome"
                                    required
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">E-mail (Login) *</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">WhatsApp *</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="tel" 
                                    value={whatsapp} 
                                    onChange={e => setWhatsapp(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="(00) 00000-0000"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nascimento *</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="date" 
                                    value={birthDate} 
                                    onChange={e => setBirthDate(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    required
                                />
                            </div>
                        </div>

                        {/* ROLES SELECTION */}
                        <div className="md:col-span-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-3 block flex items-center gap-2">
                                <Briefcase size={12}/> Selecione suas Funções *
                            </label>
                            
                            {loadingRoles ? (
                                <div className="text-center py-4"><Loader2 className="animate-spin text-zinc-500 mx-auto" size={20}/></div>
                            ) : availableRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {availableRoles.map(role => {
                                        const isSelected = selectedRoles.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                                    isSelected 
                                                    ? 'bg-teal-600 text-white border-teal-500 shadow-md ring-1 ring-teal-500/50' 
                                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
                                                }`}
                                            >
                                                {role}
                                                {isSelected && <Check size={12} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center p-4">
                                    <p className="text-xs text-red-400 italic mb-2">Este ministério não possui funções cadastradas.</p>
                                    <p className="text-[10px] text-zinc-500">Contate o administrador para configurar as funções.</p>
                                </div>
                            )}
                            {selectedRoles.length === 0 && availableRoles.length > 0 && <p className="text-[10px] text-red-400 mt-2 ml-1">* Selecione pelo menos uma função.</p>}
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Criar Senha *</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Confirmar Senha *</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={confirmPass} 
                                    onChange={e => setConfirmPass(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="Repita a senha"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {errorMsg && <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMsg}</p>}

                    <button 
                        type="submit" 
                        disabled={registering || !isFormValid}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {registering ? <Loader2 className="animate-spin" size={18}/> : <span className="flex items-center gap-2">Finalizar Cadastro <ArrowRight size={16}/></span>}
                    </button>
                </form>
            </div>
        </div>
    );
};
