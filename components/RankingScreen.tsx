
import React, { useEffect, useState } from 'react';
import { Trophy, Crown, Info, X, RefreshCw, Star, Check, Award, History, ArrowDown, ArrowUp, Calendar, Heart, Eye } from 'lucide-react';
import { RankingEntry, User as UserType, RankingHistoryItem } from '../types';
import { fetchRankingData } from '../services/supabaseService';

interface Props {
  ministryId: string;
  currentUser: UserType;
}

// --- History Modal Component ---
const HistoryModal = ({ isOpen, onClose, history, memberName, totalPoints }: { isOpen: boolean; onClose: () => void; history: RankingHistoryItem[]; memberName: string; totalPoints: number }) => {
    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch(type) {
            case 'assignment': return <Calendar size={16} className="text-green-500" />;
            case 'swap_penalty': return <RefreshCw size={16} className="text-red-500" />;
            case 'announcement_read': return <Eye size={16} className="text-blue-500" />;
            case 'announcement_like': return <Heart size={16} className="text-pink-500" />;
            default: return <Star size={16} className="text-zinc-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2">
                            <History size={20} className="text-blue-500"/> Histórico de Pontos
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Extrato de {memberName.split(' ')[0]} • Total: {totalPoints} pts
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                    {history.length === 0 ? (
                        <div className="p-10 text-center text-zinc-400">
                            <Star size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-sm">Nenhum registro de pontos ainda.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {history.map((item, idx) => (
                                <div key={idx} className="p-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${item.points > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.description}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-medium">{new Date(item.date).toLocaleDateString('pt-BR')} • {new Date(item.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                    <div className={`font-black text-sm whitespace-nowrap ${item.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {item.points > 0 ? '+' : ''}{item.points}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const RankingScreen: React.FC<Props> = ({ ministryId, currentUser }) => {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{ history: RankingHistoryItem[], name: string, points: number } | null>(null);

  const loadData = async () => {
      setLoading(true);
      const data = await fetchRankingData(ministryId);
      
      const sorted = data.sort((a, b) => {
          if (b.points !== a.points) {
              return b.points - a.points;
          }
          return a.name.localeCompare(b.name);
      });
      
      setRanking(sorted);
      setLoading(false);
  };

  useEffect(() => {
      loadData();
  }, [ministryId]);

  const getMedalColor = (index: number) => {
      if (index === 0) return 'text-yellow-500'; // Ouro
      if (index === 1) return 'text-zinc-400';   // Prata
      if (index === 2) return 'text-amber-700';  // Bronze
      return 'text-zinc-500';
  };

  const handleOpenHistory = (entry: RankingEntry) => {
      setSelectedHistory({
          history: entry.history,
          name: entry.name,
          points: entry.points
      });
  };

  if (loading) {
    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
             {/* Header Skeleton */}
             <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
                 <div className="space-y-2">
                    <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                    <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                 </div>
                 <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
             </div>
             
             <div className="grid grid-cols-3 gap-4 items-end mb-8 h-48 px-4">
                 <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse opacity-60"></div>
                 <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse"></div>
                 <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse opacity-60"></div>
             </div>

             <div className="h-24 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse mb-6"></div>

             <div className="space-y-3">
                 {[1,2,3,4,5].map(i => (
                     <div key={i} className="h-16 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse border border-zinc-200 dark:border-zinc-700"></div>
                 ))}
             </div>
        </div>
    )
  }

  const myRank = ranking.findIndex(r => r.memberId === currentUser.id);
  const myData = ranking[myRank];
  const displayList = ranking;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <Trophy className="text-yellow-500"/> Destaques do Ano
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Reconhecimento pelo engajamento e dedicação ao ministério.
                </p>
            </div>
            
            <div className="flex gap-2 self-end">
                <button 
                    onClick={() => setShowRules(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                    <Info size={16}/> Regras
                </button>
                <button 
                    onClick={loadData}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-lg transition-colors"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
                </button>
            </div>
        </div>

        {/* Podium (Top 3) */}
        {!loading && displayList.length > 0 && (
            <div className="grid grid-cols-3 gap-2 md:gap-4 items-end mb-8 relative px-2">
                {/* 2nd Place */}
                {displayList[1] && (
                    <div onClick={() => handleOpenHistory(displayList[1])} className="flex flex-col items-center animate-slide-up cursor-pointer group" style={{ animationDelay: '0.1s' }}>
                        <div className="relative mb-2 transition-transform group-hover:scale-105">
                            {displayList[1].avatar_url ? (
                                <img src={displayList[1].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xl shadow-lg">
                                    {displayList[1].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-zinc-400 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">2</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{displayList[1].name}</p>
                            <p className="text-zinc-500 text-xs font-bold">{displayList[1].points} pts</p>
                        </div>
                        <div className="h-16 md:h-24 w-full bg-gradient-to-t from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 rounded-t-lg mt-2 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                )}

                {/* 1st Place */}
                {displayList[0] && (
                    <div onClick={() => handleOpenHistory(displayList[0])} className="flex flex-col items-center animate-slide-up z-10 w-full cursor-pointer group" style={{ animationDelay: '0s' }}>
                        <div className="relative mb-3 transition-transform group-hover:scale-105">
                            <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500 drop-shadow-md animate-bounce" size={28} fill="currentColor"/>
                            {displayList[0].avatar_url ? (
                                <img src={displayList[0].avatar_url} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 object-cover shadow-xl" />
                            ) : (
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold text-2xl shadow-xl">
                                    {displayList[0].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-3 -right-2 bg-yellow-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white dark:border-zinc-800">1</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-900 dark:text-white text-sm md:text-base line-clamp-1">{displayList[0].name}</p>
                            <p className="text-yellow-600 dark:text-yellow-400 font-black text-sm md:text-lg">{displayList[0].points} pts</p>
                        </div>
                        <div className="h-24 md:h-32 w-full bg-gradient-to-t from-yellow-200 to-yellow-50 dark:from-yellow-900/40 dark:to-yellow-800/10 rounded-t-xl mt-2 border-x border-t border-yellow-200 dark:border-yellow-800/50 relative overflow-hidden group-hover:opacity-100 transition-opacity">
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {displayList[2] && (
                    <div onClick={() => handleOpenHistory(displayList[2])} className="flex flex-col items-center animate-slide-up cursor-pointer group" style={{ animationDelay: '0.2s' }}>
                        <div className="relative mb-2 transition-transform group-hover:scale-105">
                            {displayList[2].avatar_url ? (
                                <img src={displayList[2].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl shadow-lg">
                                    {displayList[2].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">3</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{displayList[2].name}</p>
                            <p className="text-zinc-500 text-xs font-bold">{displayList[2].points} pts</p>
                        </div>
                        <div className="h-12 md:h-16 w-full bg-gradient-to-t from-orange-100 to-white dark:from-orange-900/30 dark:to-zinc-800 rounded-t-lg mt-2 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                )}
            </div>
        )}

        {/* My Score Card */}
        {myData && !loading && (
            <div 
                onClick={() => handleOpenHistory(myData)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg mb-6 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <Award size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-blue-100 text-xs font-bold uppercase flex items-center gap-1">
                            Sua Pontuação <History size={10} className="opacity-70"/>
                        </p>
                        <h3 className="text-2xl font-bold">{myData.points} pontos</h3>
                        <p className="text-xs text-blue-200 mt-0.5">Posição atual: #{myRank + 1}</p>
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-xs opacity-80">Escalas Cumpridas</div>
                    <div className="font-bold text-lg">{myData.stats.confirmedEvents}</div>
                </div>
            </div>
        )}

        {/* Ranking List */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">Classificação Geral</h3>
            </div>
            
            {displayList.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">
                    <History size={48} className="mx-auto mb-3 opacity-20"/>
                    <p>Nenhum membro encontrado neste ministério.</p>
                </div>
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                    {displayList.map((user, idx) => (
                        <div 
                            key={user.memberId} 
                            onClick={() => handleOpenHistory(user)}
                            className={`flex items-center justify-between p-4 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/30 ${user.memberId === currentUser.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`font-bold w-6 text-center text-sm ${idx < 3 ? getMedalColor(idx) : 'text-zinc-400'}`}>
                                    #{idx + 1}
                                </span>
                                
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 font-bold text-xs">
                                        {user.name.charAt(0)}
                                    </div>
                                )}

                                <div>
                                    <p className={`font-bold text-sm ${user.memberId === currentUser.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                        {user.name} {user.memberId === currentUser.id && '(Você)'}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                                        <span className="flex items-center gap-1" title="Escalas Cumpridas"><Check size={10} className="text-green-500"/> {user.stats.confirmedEvents}</span>
                                        <span className="flex items-center gap-1" title="Avisos Lidos"><Info size={10} className="text-blue-500"/> {user.stats.announcementsRead}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="font-black text-zinc-700 dark:text-zinc-300">
                                {user.points} <span className="text-[10px] font-normal text-zinc-400">pts</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* History Modal */}
        {selectedHistory && (
            <HistoryModal 
                isOpen={!!selectedHistory} 
                onClose={() => setSelectedHistory(null)}
                history={selectedHistory.history}
                memberName={selectedHistory.name}
                totalPoints={selectedHistory.points}
            />
        )}

        {/* Rules Modal */}
        {showRules && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                        <h3 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                            <Star size={18} className="text-yellow-500"/> Como Pontuar
                        </h3>
                        <button onClick={() => setShowRules(false)}><X size={20} className="text-zinc-500"/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                            Acumule pontos engajando com a equipe e cumprindo suas escalas.
                        </p>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400">Escala Cumprida (Check-in)</span>
                                <span className="font-black text-green-600">+100 pts</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Curtir Aviso</span>
                                <span className="font-black text-blue-600">+10 pts</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Ler Aviso</span>
                                <span className="font-black text-indigo-600">+5 pts</span>
                            </div>
                            
                            <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-2"></div>

                            <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Solicitar Troca</span>
                                <span className="font-black text-amber-600">-50 pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
