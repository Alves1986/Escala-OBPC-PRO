
import React, { useState, useEffect } from 'react';
import { 
    Building2, Users, Layers, Activity, Plus, Edit2, 
    ToggleLeft, ToggleRight, Search, Loader2, CheckCircle2, Trash2, UserMinus, X
} from 'lucide-react';
import { Organization, MinistryDef } from '../types';
import { 
    fetchOrganizationsWithStats, saveOrganization, toggleOrganizationStatus, 
    saveOrganizationMinistry, deleteOrganizationMinistry,
    fetchMinistryMemberships, removeUserFromMinistry 
} from '../services/supabaseService';
import { useToast } from './Toast';

// Componente Interno para Modal de Membros
const MinistryMembersModal = ({ isOpen, onClose, orgId, ministry, onRemove }: any) => {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && orgId && ministry) {
            loadMembers();
        }
    }, [isOpen, orgId, ministry]);

    const loadMembers = async () => {
        setLoading(true);
        const data = await fetchMinistryMemberships(orgId, ministry.code);
        setMembers(data);
        setLoading(false);
    };

    if (!isOpen || !ministry) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
                    <div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Membros Vinculados</h3>
                        <p className="text-xs text-zinc-500">{ministry.label} ({ministry.code})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    {loading ? (
                        <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-zinc-400"/></div>
                    ) : members.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8 text-sm italic">Nenhum membro vinculado explicitamente.</p>
                    ) : (
                        <div className="space-y-2">
                            {members.map(m => (
                                <div key={m.profileId} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {m.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{m.name}</p>
                                            <p className="text-xs text-zinc-500">{m.email}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => onRemove(m.profileId, m.name)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Desvincular do ministério"
                                    >
                                        <UserMinus size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SuperAdminDashboard: React.FC = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState({ name: "", slug: "" });
    const [saving, setSaving] = useState(false);

    // Ministry Management State
    const [newMinistryCode, setNewMinistryCode] = useState("");
    const [newMinistryLabel, setNewMinistryLabel] = useState("");
    const [ministrySaving, setMinistrySaving] = useState(false);

    // Members Modal State
    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [selectedMinistry, setSelectedMinistry] = useState<{ code: string, label: string } | null>(null);

    const { addToast, confirmAction } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchOrganizationsWithStats();
        setOrganizations(data);
        setLoading(false);
    };

    const handleEdit = (org: Organization) => {
        setEditingOrg(org);
        setFormData({ name: org.name, slug: org.slug || "" });
        setNewMinistryCode("");
        setNewMinistryLabel("");
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingOrg(null);
        setFormData({ name: "", slug: "" });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return addToast("Nome é obrigatório", "error");

        setSaving(true);
        const res = await saveOrganization(editingOrg?.id || null, formData.name, formData.slug);
        
        if (res.success) {
            addToast(res.message, "success");
            if(!editingOrg) setIsModalOpen(false); 
            loadData();
        } else {
            addToast(res.message, "error");
        }
        setSaving(false);
    };

    const handleAddMinistry = async () => {
        if (!editingOrg) return;
        if (!newMinistryCode || !newMinistryLabel) return addToast("Preencha código e nome.", "warning");

        setMinistrySaving(true);
        const res = await saveOrganizationMinistry(editingOrg.id, newMinistryCode, newMinistryLabel);
        if (res.success) {
            addToast(res.message, "success");
            setNewMinistryCode("");
            setNewMinistryLabel("");
            const data = await fetchOrganizationsWithStats();
            setOrganizations(data);
            const updatedOrg = data.find(o => o.id === editingOrg.id);
            if (updatedOrg) setEditingOrg(updatedOrg);
        } else {
            addToast(res.message, "error");
        }
        setMinistrySaving(false);
    };

    const handleDeleteMinistry = async (code: string) => {
        if (!editingOrg) return;
        confirmAction("Remover Ministério", `Isso pode quebrar o acesso de usuários vinculados ao ministério '${code}'. Continuar?`, async () => {
            const res = await deleteOrganizationMinistry(editingOrg.id, code);
            if (res.success) {
                addToast("Ministério removido.", "info");
                const data = await fetchOrganizationsWithStats();
                setOrganizations(data);
                const updatedOrg = data.find(o => o.id === editingOrg.id);
                if (updatedOrg) setEditingOrg(updatedOrg);
            } else {
                addToast(res.message, "error");
            }
        });
    };

    const handleOpenMembers = (code: string, label: string) => {
        setSelectedMinistry({ code, label });
        setMembersModalOpen(true);
    };

    const handleRemoveMemberFromMinistry = (profileId: string, memberName: string) => {
        if (!editingOrg || !selectedMinistry) return;
        
        confirmAction(
            "Desvincular Membro", 
            `Tem certeza que deseja remover ${memberName} do ministério ${selectedMinistry.label}?`,
            async () => {
                const res = await removeUserFromMinistry(editingOrg.id, profileId, selectedMinistry.code);
                if (res.success) {
                    addToast(res.message, "success");
                    // Força refresh do modal fechando e abrindo (hack simples) ou component interno reage
                    setMembersModalOpen(false);
                    setTimeout(() => setMembersModalOpen(true), 100); 
                } else {
                    addToast(res.message, "error");
                }
            }
        );
    };

    const handleToggleStatus = async (org: Organization) => {
        const newStatus = !org.active;
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, active: newStatus } : o));
        
        const success = await toggleOrganizationStatus(org.id, org.active || false);
        if (!success) {
            addToast("Erro ao atualizar status", "error");
            loadData();
        }
    };

    const filteredOrgs = organizations.filter(o => 
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.slug && o.slug.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-28">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        <Building2 className="text-purple-600"/> Gestão Global
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">Administração de Organizações (Multi-Tenant)</p>
                </div>
                <button 
                    onClick={handleCreate}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-600/20"
                >
                    <Plus size={18}/> Nova Organização
                </button>
            </div>

            {/* Stats Cards (Mantido igual) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                        <Building2 size={24}/>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Organizações</p>
                        <p className="text-2xl font-bold text-zinc-800 dark:text-white">{organizations.length}</p>
                    </div>
                </div>
                {/* ... outros cards mantidos ... */}
            </div>

            {/* List Table (Mantido igual) */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                {/* ... Search e Tabela mantidos ... */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        {/* ... Headers mantidos ... */}
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                            {filteredOrgs.map(org => (
                                <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{org.name}</p>
                                        <p className="text-xs text-zinc-500">{org.slug || '-'}</p>
                                    </td>
                                    {/* ... outras colunas ... */}
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleToggleStatus(org)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-colors ${org.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                            {org.active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">{org.userCount || 0}</td>
                                    <td className="px-6 py-4 text-center">{org.ministryCount || 0}</td>
                                    <td className="px-6 py-4 text-center text-zinc-500 text-xs">
                                        {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleEdit(org)}
                                            className="p-2 text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit / Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* ... Modal Header e Form Org mantidos ... */}
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-white">
                                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Nome</label>
                                    <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Slug</label>
                                    <input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white" />
                                </div>
                                <div className="flex justify-end">
                                    <button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                                        {saving && <Loader2 className="animate-spin" size={14}/>} Salvar
                                    </button>
                                </div>
                            </form>

                            {/* Ministry Manager Section */}
                            {editingOrg && (
                                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                                    <h4 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Layers size={18}/> Ministérios da Organização
                                    </h4>
                                    
                                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Código (ID)</label>
                                                <input value={newMinistryCode} onChange={e => setNewMinistryCode(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="ex: jovens" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm" />
                                            </div>
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Nome</label>
                                                <input value={newMinistryLabel} onChange={e => setNewMinistryLabel(e.target.value)} placeholder="ex: Ministério de Jovens" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm" />
                                            </div>
                                            <button onClick={handleAddMinistry} disabled={ministrySaving} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                                {ministrySaving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {editingOrg.ministries && editingOrg.ministries.length > 0 ? (
                                            editingOrg.ministries.map(min => (
                                                <div key={min.code} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg shadow-sm">
                                                    <div>
                                                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{min.label}</p>
                                                        <p className="text-xs text-zinc-500 font-mono">{min.code}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => handleOpenMembers(min.code, min.label)}
                                                            className="text-zinc-400 hover:text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                            title="Gerenciar Membros"
                                                        >
                                                            <Users size={16}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteMinistry(min.code)}
                                                            className="text-zinc-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Excluir Ministério"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-sm text-zinc-400 py-4 italic">Nenhum ministério cadastrado.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Membros */}
            <MinistryMembersModal 
                isOpen={membersModalOpen}
                onClose={() => setMembersModalOpen(false)}
                orgId={editingOrg?.id}
                ministry={selectedMinistry}
                onRemove={handleRemoveMemberFromMinistry}
            />
        </div>
    );
};
