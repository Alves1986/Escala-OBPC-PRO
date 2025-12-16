
import React, { useState } from 'react';
import { Announcement, User } from '../types';
import { Megaphone, CheckCircle2, Eye, Clock, AlertTriangle, AlertOctagon, Info, CheckCircle, ChevronDown, ChevronUp, Heart } from 'lucide-react';

interface Props {
  announcement: Announcement;
  currentUser: User;
  onMarkRead: (id: string) => void;
  onToggleLike?: (id: string) => void; 
}

export const AnnouncementCard: React.FC<Props> = ({ announcement, currentUser, onMarkRead, onToggleLike }) => {
  const [showReaders, setShowReaders] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [isReading, setIsReading] = useState(false);

  // Check if current user has read this announcement
  const hasRead = announcement.readBy.some(r => r.userId === currentUser.id);
  const isAdmin = currentUser.role === 'admin';
  
  // Like Logic
  const likes = announcement.likedBy || [];
  const hasLiked = likes.some(l => l.userId === currentUser.id);
  const likeCount = likes.length;

  const handleRead = async () => {
      setIsReading(true);
      await onMarkRead(announcement.id);
      setIsReading(false);
  };

  const getTheme = (type: string) => {
    switch(type) {
        case 'success': return { 
            bg: 'bg-green-50 dark:bg-green-900/10', 
            border: 'border-green-200 dark:border-green-800/30',
            icon: <CheckCircle className="text-green-500" size={24} />,
            accent: 'text-green-700 dark:text-green-400',
            btn: 'bg-green-600 hover:bg-green-700'
        };
        case 'warning': return { 
            bg: 'bg-amber-50 dark:bg-amber-900/10', 
            border: 'border-amber-200 dark:border-amber-800/30',
            icon: <AlertTriangle className="text-amber-500" size={24} />,
            accent: 'text-amber-700 dark:text-amber-400',
            btn: 'bg-amber-600 hover:bg-amber-700'
        };
        case 'alert': return { 
            bg: 'bg-red-50 dark:bg-red-900/10', 
            border: 'border-red-200 dark:border-red-800/30',
            icon: <AlertOctagon className="text-red-500" size={24} />,
            accent: 'text-red-700 dark:text-red-400',
            btn: 'bg-red-600 hover:bg-red-700'
        };
        default: return { 
            bg: 'bg-blue-50 dark:bg-blue-900/10', 
            border: 'border-blue-200 dark:border-blue-800/30',
            icon: <Info className="text-blue-500" size={24} />,
            accent: 'text-blue-700 dark:text-blue-400',
            btn: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const theme = getTheme(announcement.type);

  // Se o usuário já leu e não é admin, ocultamos o card para não poluir (opcional, mas solicitado pelo fluxo "marcar como visto")
  if (hasRead && !isAdmin) return null;

  return (
    <div className={`mb-6 rounded-2xl p-5 border shadow-sm animate-slide-up ${theme.bg} ${theme.border}`}>
        <div className="flex gap-4 items-start">
            <div className="shrink-0 mt-1">
                {theme.icon}
            </div>
            <div className="flex-1 min-w-0"> {/* min-w-0 ensures text wrap works inside flex */}
                <div className="flex justify-between items-start">
                    <h3 className={`font-bold text-lg ${theme.accent}`}>{announcement.title}</h3>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full shrink-0 ml-2">
                        <Clock size={10} /> {new Date(announcement.timestamp).toLocaleDateString('pt-BR')}
                    </span>
                </div>
                
                {/* Safe HTML Rendering for Rich Text */}
                <div 
                    className="text-zinc-700 dark:text-zinc-300 mt-2 text-sm leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: announcement.message }}
                />

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                    <div className="text-xs text-zinc-500">
                        Enviado por: <span className="font-semibold">{announcement.author}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        {/* Botão de Like (Visível para todos) */}
                        <div className="flex items-center gap-1 mr-2">
                            <button
                                onClick={() => onToggleLike && onToggleLike(announcement.id)}
                                className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-1 ${
                                    hasLiked 
                                    ? 'text-red-500 bg-red-100 dark:bg-red-900/20' 
                                    : 'text-zinc-400 hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                }`}
                                title={hasLiked ? "Descurtir" : "Curtir"}
                            >
                                <Heart size={18} fill={hasLiked ? "currentColor" : "none"} />
                            </button>
                            
                            {/* Contador e Toggle de Lista de Likes */}
                            {likeCount > 0 && (
                                <button 
                                    onClick={() => setShowLikers(!showLikers)}
                                    className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:underline"
                                >
                                    {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
                                </button>
                            )}
                        </div>

                        {/* Botão de Marcar como Lido (Para Membros que ainda não leram) */}
                        {!hasRead && (
                            <button 
                                onClick={handleRead}
                                disabled={isReading}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-bold text-sm shadow-md transition-all active:scale-95 ${theme.btn} ${isReading ? 'opacity-70' : ''}`}
                            >
                                {isReading ? 'Marcando...' : <><CheckCircle2 size={16} /> Marcar como Ciente</>}
                            </button>
                        )}

                        {/* Visualização de Admin (Quem leu) */}
                        {isAdmin && (
                            <button 
                                onClick={() => setShowReaders(!showReaders)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <Eye size={14} /> 
                                {showReaders ? 'Ocultar Leituras' : `Visto por ${announcement.readBy.length}`}
                                {showReaders ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista de Quem Curtiu (Pública para a equipe) */}
                {showLikers && likes.length > 0 && (
                    <div className="mt-3 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 text-xs animate-fade-in border border-red-100 dark:border-red-900/20">
                        <p className="font-bold text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-1">
                            <Heart size={12} fill="currentColor"/> Curtido por:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {likes.map((liker, idx) => (
                                <span key={idx} className="bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-sm text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700">
                                    {liker.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista de Leituras (Admin Apenas) */}
                {isAdmin && showReaders && (
                    <div className="mt-3 bg-white/80 dark:bg-black/20 rounded-lg p-3 text-xs animate-fade-in border border-zinc-100 dark:border-zinc-700/50">
                        <p className="font-bold text-zinc-500 uppercase mb-2">Histórico de Visualização</p>
                        {announcement.readBy.length === 0 ? (
                            <p className="text-zinc-400 italic">Ninguém visualizou ainda.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {announcement.readBy.map((reader, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                                        <CheckCircle2 size={12} className="text-green-500" />
                                        <span className="truncate" title={reader.name}>{reader.name}</span>
                                        <span className="text-[10px] text-zinc-400 ml-auto">
                                            {new Date(reader.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
