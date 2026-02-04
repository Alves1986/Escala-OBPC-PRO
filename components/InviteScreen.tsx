import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, UserPlus, AlertOctagon, Loader2 } from 'lucide-react';
import { validateInviteToken, registerWithInvite } from '../services/supabaseService';

interface Props {
    token: string;
    onClear: () => void;
}

export const InviteScreen: React.FC<Props> = ({ token, onClear }) => {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
    const [inviteData, setInviteData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
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
        if (!name.trim() || !password || !confirmPass) return;
        
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
            const res = await registerWithInvite(token, name, password);
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
                <h1 className="text-2xl font-bold text-white mb-2">Convite Inválido</h1>
                <p className="text-zinc-400 mb-8 max-w-sm">{errorMsg}</p>
                <button 
                    onClick={onClear}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                    Voltar para Login
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
                <p className="text-zinc-400 mb-4">Bem-vindo à equipe.</p>
                <Loader2 className="animate-spin text-zinc-600" size={20} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-2xl animate-fade-in">
                <div className="text-center mb-8">
                    <div className="inline-flex p-3 bg-teal-500/10 rounded-2xl mb-4">
                        <UserPlus className="text-teal-500" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Aceitar Convite</h1>
                    <p className="text-zinc-400 text-sm mt-1">Você foi convidado para participar.</p>
                </div>

                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 mb-6 text-center">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">E-mail Vinculado</p>
                    <p className="text-white font-medium text-sm">{inviteData?.email}</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nome Completo</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500" 
                            placeholder="Seu nome"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Criar Senha</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500" 
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Confirmar Senha</label>
                        <input 
                            type="password" 
                            value={confirmPass} 
                            onChange={e => setConfirmPass(e.target.value)} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-teal-500" 
                            placeholder="••••••••"
                        />
                    </div>

                    {errorMsg && <p className="text-red-400 text-xs text-center font-bold">{errorMsg}</p>}

                    <button 
                        type="submit" 
                        disabled={registering}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {registering ? <Loader2 className="animate-spin" size={18}/> : <span className="flex items-center gap-2">Criar Conta <ArrowRight size={16}/></span>}
                    </button>
                </form>
            </div>
        </div>
    );
};