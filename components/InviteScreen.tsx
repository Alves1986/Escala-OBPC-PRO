import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, UserPlus, AlertOctagon, Loader2, Mail, Lock, Phone, User, Calendar, Briefcase, Building2 } from 'lucide-react';
import { validateInviteToken, registerWithInvite } from '../services/supabaseService';

interface Props {
    token: string;
    onClear: () => void;
}

export const InviteScreen: React.FC<Props> = ({ token, onClear }) => {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
    const [inviteData, setInviteData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");
    
    // Form Data
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [birthDate, setBirthDate] = useState("");
    
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        const check = async () => {
            const res = await validateInviteToken(token);
            if (res.valid) {
                setInviteData(res.data);
                setStatus('valid');
            } else {
                setErrorMsg(res.message || "Convite inválido");
                setStatus('invalid');
            }
        };
        check();
    }, [token]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim() || !email.trim() || !password || !confirmPass || !whatsapp.trim() || !birthDate) {
            setErrorMsg("Todos os campos são obrigatórios.");
            return;
        }
        
        if (password !== confirmPass) {
            setErrorMsg("As senhas não coincidem.");
            return;
        }
        
        if (password.length < 6) {
            setErrorMsg("A senha deve ter no mínimo 6 caracteres.");
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
                birthDate
            });

            if (res.success) {
                setStatus('success');
                setTimeout(() => {
                    window.location.href = '/'; // Reload to clear params and init auth
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
                            <span className="text-white text-sm font-bold">{inviteData.ministryLabel}</span>
                        </div>
                        {inviteData.roles && inviteData.roles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {inviteData.roles.map((r: string) => (
                                    <span key={r} className="text-[10px] bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded font-bold border border-zinc-600">{r}</span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nome Completo</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">E-mail (Login)</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">WhatsApp</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="tel" 
                                    value={whatsapp} 
                                    onChange={e => setWhatsapp(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nascimento</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="date" 
                                    value={birthDate} 
                                    onChange={e => setBirthDate(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Criar Senha</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Confirmar Senha</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={confirmPass} 
                                    onChange={e => setConfirmPass(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500 text-sm" 
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    {errorMsg && <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMsg}</p>}

                    <button 
                        type="submit" 
                        disabled={registering}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
                    >
                        {registering ? <Loader2 className="animate-spin" size={18}/> : <span className="flex items-center gap-2">Finalizar Cadastro <ArrowRight size={16}/></span>}
                    </button>
                </form>
            </div>
        </div>
    );
};