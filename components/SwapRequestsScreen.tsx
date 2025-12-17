
import React, { useState } from 'react';
import { RefreshCcw, User, Calendar, ArrowRight, CheckCircle2, Clock, Info, FilterX, Trash2, XCircle, Loader2 } from 'lucide-react';
import { SwapRequest, User as UserType, ScheduleMap } from '../types';
import { useToast } from './Toast';

interface Props {
  schedule: ScheduleMap;
  currentUser: UserType;
  requests: SwapRequest[];
  visibleEvents: { iso: string; title: string; dateDisplay: string }[];
  onCreateRequest: (role: string, iso: string, title: string) => void;
  onAcceptRequest: (reqId: string) => void;
  onCancelRequest: (reqId: string) => void;
}

export const SwapRequestsScreen: React.FC<Props> = ({ 
    schedule, currentUser, requests, visibleEvents, onCreateRequest, onAcceptRequest, onCancelRequest 
}) => {
  const [activeTab, setActiveTab] = useState<'mine' | 'wall'>('wall');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { confirmAction } = useToast();

  // Encontrar minhas escalas futuras
  const mySchedules = visibleEvents.map(evt => {
      const myRolesInEvent: string[] = [];
      Object.keys(schedule).forEach(key => {
          if (key.startsWith(evt.iso) && schedule[key] === currentUser.name) {
              const role = key.split('_').pop() || '';
              myRolesInEvent.push(role);
          }
      });
      return { event: evt, roles: myRolesInEvent };
  }).filter(item => item.roles.length > 0);

  // Encontrar o pedido específico para uma vaga
  const getExistingRequest = (iso: string, role: string) => {
      return requests.find(r => 
          r.eventIso === iso && 
          r.role === role && 
          r.requesterName === currentUser.name && 
          r.status === 'pending'
      );
  };

  // Filtrar pedidos para o Mural
  const visibleRequests = requests.filter(req => {
      if (req.status !== 'pending') return false;
      if (req.requesterName === currentUser.name) return false;

      const isAdmin = currentUser.role === 'admin';
      const hasRole = currentUser.functions?.includes(req.role);

      return isAdmin || hasRole;
  });

  const handleCancel = (reqId: string) => {
      confirmAction(
          "Cancelar Pedido",
          "Deseja remover este pedido de troca? Sua escala voltará ao normal e o item sairá do mural.",
          () => {
              setProcessingId(reqId);
              onCancelRequest(reqId);
              setTimeout(() => setProcessingId(null), 1000);
          }
      );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <RefreshCcw className="text-amber-500"/> Trocas de Escala
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Solicite substituição ou assuma escalas disponíveis.
                </p>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full max-w-sm mx-auto">
            <button 
                onClick={() => setActiveTab('mine')}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'mine' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Minhas Escalas
            </button>
            <button 
                onClick={() => setActiveTab('wall')}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'wall' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Mural de Trocas
                {visibleRequests.length > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{visibleRequests.length}</span>}
            </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'mine' && (
            <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-3">
                    <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        Clique em "Solicitar Troca" para disponibilizar sua vaga. Se mudar de ideia, você pode cancelar o pedido a qualquer momento antes de alguém assumir.
                    </p>
                </div>

                {mySchedules.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                        <Calendar className="mx-auto mb-3 opacity-20" size={48}/>
                        <p>Você não está escalado em nenhum evento neste mês.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mySchedules.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-slide-up">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-zinc-800 dark:text-white">{item.event.title}</h3>
                                        <p className="text-sm text-zinc-500">{item.event.dateDisplay} • {item.event.iso.split('T')[1]}</p>
                                    </div>
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500">
                                        <Clock size={20}/>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    {item.roles.map(role => {
                                        const existingReq = getExistingRequest(item.event.iso, role);
                                        const isProcessing = processingId === existingReq?.id;

                                        return (
                                            <div key={role} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${existingReq ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-700/50'}`}>
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{role}</span>
                                                
                                                {existingReq ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-amber-100 dark:border-amber-900">
                                                            No Mural
                                                        </span>
                                                        <button 
                                                            onClick={() => handleCancel(existingReq.id)}
                                                            disabled={isProcessing}
                                                            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
                                                        >
                                                            {isProcessing ? <Loader2 size={12} className="animate-spin"/> : <XCircle size={12}/>}
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => onCreateRequest(role, item.event.iso, item.event.title)}
                                                        className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-amber-500/20"
                                                    >
                                                        Solicitar Troca
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'wall' && (
            <div className="space-y-4">
                 <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30 flex items-start gap-3">
                    <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-green-700 dark:text-green-300">
                        Aqui aparecem pedidos de troca <strong>compatíveis com suas funções</strong>. Se você estiver disponível, clique em "Assumir Escala" para realizar a troca automaticamente.
                    </p>
                </div>

                {visibleRequests.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <FilterX className="mx-auto mb-3 opacity-20" size={48}/>
                        <p className="font-medium text-zinc-500">Nenhum pedido compatível.</p>
                        <p className="text-xs text-zinc-400 mt-1">Não há trocas pendentes para suas funções no momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleRequests.map(req => {
                            const dateDisplay = req.eventIso.split('T')[0].split('-').reverse().join('/');
                            const timeDisplay = req.eventIso.split('T')[1];

                            return (
                                <div key={req.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden animate-slide-up">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                    
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                                            <User size={18}/>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase font-bold">Solicitante</p>
                                            <p className="font-bold text-zinc-800 dark:text-white">{req.requesterName}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Evento:</span>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">{req.eventTitle}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Data:</span>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{dateDisplay} às {timeDisplay}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Função:</span>
                                            <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">{req.role}</span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            confirmAction(
                                                "Assumir Escala",
                                                `Você deseja assumir a escala de ${req.requesterName} para o evento "${req.eventTitle}"?`,
                                                () => onAcceptRequest(req.id)
                                            );
                                        }}
                                        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 active:scale-95"
                                    >
                                        Assumir Escala <ArrowRight size={18}/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
