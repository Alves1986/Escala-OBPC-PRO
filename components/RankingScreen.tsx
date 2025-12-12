
import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Crown, Info, X, RefreshCw, Star, User, Check } from 'lucide-react';
import { RankingEntry, User as UserType } from '../types';
import { fetchRankingData } from '../services/supabaseService';

interface Props {
  ministryId: string;
  currentUser: UserType;
}

export const RankingScreen: React.FC<Props> = ({ ministryId, currentUser }) => {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  const loadData = async () => {
      setLoading(true);
      const data = await fetchRankingData(ministryId);
      setRanking(data);
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

  const getBgGradient = (index: number) => {
      if (index === 0) return 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-yellow-200 dark:from-yellow-900/20 dark:to-yellow-900/5 dark:border-yellow-700/50';
      if (index === 1) return 'bg-gradient-to-br from-zinc-100 to-zinc-50 border-zinc-200 dark:from-zinc-800 dark:to-zinc-900/50 dark:border-zinc-700';
      if (index === 2) return 'bg-gradient-to-br from-orange-100 to-orange-50 border-orange-200 dark:from-orange-900/20 dark:to-orange-900/5 dark:border-orange-800/50';
      return 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700/50';
  };

  const myRank = ranking.findIndex(r => r.memberId === currentUser.id);
  const myData = ranking[myRank];

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
        {!loading && ranking.length > 0 && (
            <div className="grid grid-cols-3 gap-2 md:gap-4 items-end mb-8 relative px-2">
                {/* 2nd Place */}
                {ranking[1] && (
                    <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="relative mb-2">
                            {ranking[1].avatar_url ? (
                                <img src={ranking[1].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xl shadow-lg">
                                    {ranking[1].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-zinc-400 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">2</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{ranking[1].name}</p>
                            <p className="text-zinc-500 text-xs font-bold">{ranking[1].points} pts</p>
                        </div>
                        <div className="h-16 md:h-24 w-full bg-gradient-to-t from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 rounded-t-lg mt-2 opacity-80"></div>
                    </div>
                )}

                {/* 1st Place */}
                {ranking[0] && (
                    <div className="flex flex-col items-center animate-slide-up z-10 w-full" style={{ animationDelay: '0s' }}>
                        <div className="relative mb-3">
                            <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500 drop-shadow-md animate-bounce" size={28} fill="currentColor"/>
                            {ranking[0].avatar_url ? (
                                <img src={ranking[0].avatar_url} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 object-cover shadow-xl" />
                            ) : (
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold text-2xl shadow-xl">
                                    {ranking[0].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-3 -right-2 bg-yellow-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white dark:border-zinc-800">1</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-900 dark:text-white text-sm md:text-base line-clamp-1">{ranking[0].name}</p>
                            <p className="text-yellow-600 dark:text-yellow-400 font-black text-sm md:text-lg">{ranking[0].points} pts</p>
                        </div>
                        <div className="h-24 md:h-32 w-full bg-gradient-to-t from-yellow-200 to-yellow-50 dark:from-yellow-900/40 dark:to-yellow-800/10 rounded-t-xl mt-2 border-x border-t border-yellow-200 dark:border-yellow-800/50"></div>
                    </div>
                )}

                {/* 3rd Place */}
                {ranking[2] && (
                    <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="relative mb-2">
                            {ranking[2].avatar_url ? (
                                <img src={ranking[2].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl shadow-lg">
                                    {ranking[2].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">3</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{ranking[2].name}</p>
                            <p className="text-zinc-500 text-xs font-bold">{ranking[2].points} pts</p>
                        </div>
                        <div className="h-12 md:h-16 w-full bg-gradient-to-t from-orange-100 to-white dark:from-orange-900/30 dark:to-zinc-800 rounded-t-lg mt-2 opacity-80"></div>
                    </div>
                )}
            </div>
        )}

        {/* My Score Card */}
        {myData && !loading && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <Award size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-blue-100 text-xs font-bold uppercase">Sua Pontuação</p>
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
            
            {loading ? (
                <div className="p-8 text-center text-zinc-400">Carregando pontuação...</div>
            ) : ranking.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">Nenhum dado de pontuação ainda.</div>
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                    {ranking.map((user, idx) => (
                        <div key={user.memberId} className={`flex items-center justify-between p-4 ${user.memberId === currentUser.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <div className="flex items-center gap-4">
                                <span className={`font-bold w-6 text-center ${idx < 3 ? getMedalColor(idx) : 'text-zinc-400'}`}>
                                    #{idx + 1}
                                </span>
                                
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 font-bold">
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
                            Acumule pontos engajando com a equipe e cumprindo suas escalas. O ranking é reiniciado anualmente.
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
                            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                <span className="text-sm font-bold text-red-700 dark:text-red-400">Falta (Sem Check-in)</span>
                                <span className="font-black text-red-600">-100 pts</span>
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-zinc-400 text-center pt-2">
                            * Se você não estiver escalado no mês, sua pontuação permanece inalterada (neutra).
                        </p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
