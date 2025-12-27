
import React, { useState, useEffect } from 'react';
import { 
    Building2, Users, Layers, Activity, Plus, Edit2, 
    ToggleLeft, ToggleRight, Search, Loader2, CheckCircle2 
} from 'lucide-react';
import { Organization } from '../types';
import { fetchOrganizationsWithStats, saveOrganization, toggleOrganizationStatus } from '../services/supabaseService';
import { useToast } from './Toast';

export const SuperAdminDashboard: React.FC = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState({ name: "", slug: "" });
    const [saving, setSaving] = useState(false);

    const { addToast } = useToast();

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
            setIsModalOpen(false);
            loadData();
        } else {
            addToast(res.message, "error");
        }
        setSaving(false);
    };

    const handleToggleStatus = async (org: Organization) => {
        const newStatus = !org.active;
        // Optimistic update
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, active: newStatus } : o));
        
        const success = await toggleOrganizationStatus(org.id, org.active || false);
        if (!success) {
            addToast("Erro ao atualizar status", "error");
            loadData(); // Revert
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

            {/* Stats Cards */}
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
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                        <Users size={24}/>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Total de Usuários</p>
                        <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                            {organizations.reduce((acc, curr) => acc + (curr.userCount || 0), 0)}
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600">
                        <Activity size={24}/>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Ativas</p>
                        <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                            {organizations.filter(o => o.active).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar organização..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                        <Loader2 className="animate-spin mb-2" size={32}/> Carregando...
                    </div>
                ) : filteredOrgs.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">Nenhuma organização encontrada.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-6 py-3">Nome / Slug</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                    <th className="px-6 py-3 text-center">Usuários</th>
                                    <th className="px-6 py-3 text-center">Ministérios</th>
                                    <th className="px-6 py-3 text-center">Criado em</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                                {filteredOrgs.map(org => (
                                    <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-zinc-800 dark:text-zinc-200">{org.name}</p>
                                            <p className="text-xs text-zinc-500">{org.slug || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleToggleStatus(org)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-colors ${org.active ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
                                                {org.active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                                                {org.active ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                <Users size={12}/> {org.userCount || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                <Layers size={12}/> {org.ministryCount || 0}
                                            </span>
                                        </td>
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
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-white">
                                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Nome da Organização</label>
                                <input 
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    placeholder="Ex: Igreja Central"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Slug (URL amigável)</label>
                                <input 
                                    value={formData.slug}
                                    onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    placeholder="ex: igreja-central"
                                />
                                <p className="text-[10px] text-zinc-400 mt-1">Opcional. Usado para links personalizados.</p>
                            </div>
                            
                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-bold text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="animate-spin" size={14}/>}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
