
import React, { useState, useEffect } from 'react';
import { Music, Plus, Trash2, ExternalLink, PlayCircle, Calendar, Settings, ListMusic, Sparkles, Loader2, Search, Youtube, LogOut, LogIn, ChevronRight, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import { RepertoireItem, User } from '../types';
import { useToast } from './Toast';
import { addToRepertoire, deleteFromRepertoire } from '../services/supabaseService';
import { suggestRepertoireAI } from '../services/aiService';
import { searchSpotifyTracks, getLoginUrl, handleLoginCallback, isUserLoggedIn, logoutSpotify, getUserProfile, getUserPlaylists, getPlaylistTracks } from '../services/spotifyService';

interface Props {
  repertoire: RepertoireItem[];
  setRepertoire: (items: RepertoireItem[]) => Promise<void>;
  currentUser: User | null;
  mode: 'view' | 'manage';
  onItemAdd?: (title: string) => void;
  ministryId?: string | null;
}

export const RepertoireScreen: React.FC<Props> = ({ repertoire, setRepertoire, currentUser, mode, onItemAdd, ministryId }) => {
  const { addToast, confirmAction } = useToast();
  
  // UI State
  const [activeTab, setActiveTab] = useState<'manual' | 'spotify' | 'playlists'>('spotify');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Persist Date in LocalStorage to survive redirects
  const [date, setDate] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('repertoire_draft_date') || "";
      }
      return "";
  });

  // Manual Form
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");

  // Spotify Auth & Data
  const [isSpotifyLoggedIn, setIsSpotifyLoggedIn] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Search State
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTheme, setAiTheme] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{title: string, artist: string, reason: string}[]>([]);

  // Init - Verifica login e persistência
  useEffect(() => {
      // 1. Verifica token do hash (Redirecionamento) com prioridade máxima
      const tokenFromHash = handleLoginCallback();
      
      if (tokenFromHash) {
          setIsSpotifyLoggedIn(true);
          setActiveTab('playlists');
          addToast("Spotify conectado com sucesso!", "success");
      } else if (isUserLoggedIn()) {
          // 2. Verifica token armazenado se não veio do hash
          setIsSpotifyLoggedIn(true);
      }

      // Se estiver logado, carrega perfil
      if (isUserLoggedIn()) {
          loadUserProfile();
      }
  }, []);

  // Update date persistence
  const handleDateChange = (val: string) => {
      setDate(val);
      localStorage.setItem('repertoire_draft_date', val);
  };

  const loadUserProfile = async () => {
      const profile = await getUserProfile();
      if (profile) setSpotifyUser(profile);
  };

  const handleSpotifyLogin = () => {
      if (!ministryId) {
          addToast("Erro: ID do ministério não encontrado.", "error");
          return;
      }
      // Salva estado antes de ir
      if(date) localStorage.setItem('repertoire_draft_date', date);
      
      const url = getLoginUrl(ministryId);
      if (url) {
          window.location.href = url;
      } else {
          addToast("Client ID não configurado! Vá em Configurações > Integração Spotify e salve o ID.", "error");
      }
  };

  const handleSpotifyLogout = () => {
      logoutSpotify();
      setIsSpotifyLoggedIn(false);
      setSpotifyUser(null);
      setUserPlaylists([]);
      addToast("Desconectado do Spotify.", "info");
  };

  const handleLoadPlaylists = async () => {
      setIsLoadingPlaylists(true);
      const playlists = await getUserPlaylists();
      setUserPlaylists(playlists);
      setIsLoadingPlaylists(false);
  };

  const handleOpenPlaylist = async (playlist: any) => {
      setSelectedPlaylist(playlist);
      setIsLoadingPlaylists(true);
      const tracks = await getPlaylistTracks(playlist.id);
      setPlaylistTracks(tracks);
      setIsLoadingPlaylists(false);
  };

  const handleSpotifySearch = async () => {
      if (!spotifyQuery.trim() || !ministryId) return;
      setSpotifyLoading(true);
      const results = await searchSpotifyTracks(spotifyQuery, ministryId);
      setSpotifyResults(results);
      setSpotifyLoading(false);
      
      if (results.length === 0) {
          addToast("Nenhum resultado encontrado. Verifique se o Client Secret foi configurado.", "warning");
      }
  };

  const handleAdd = async (overrideTitle?: string, overrideLink?: string) => {
    const finalTitle = overrideTitle || title;
    const finalLink = overrideLink || link;

    if (!finalTitle) {
        addToast("O título da música é obrigatório.", "error");
        return;
    }

    if (!date) {
        addToast("ATENÇÃO: Selecione a Data do Culto acima antes de adicionar músicas!", "warning");
        // Highlight date input
        const dateInput = document.getElementById('date-input');
        if (dateInput) {
            dateInput.focus();
            dateInput.classList.add('ring-4', 'ring-red-500');
            setTimeout(() => dateInput.classList.remove('ring-4', 'ring-red-500'), 2000);
        }
        return;
    }

    if (!currentUser?.ministryId) {
        addToast("Erro: Ministério não identificado. Faça login novamente.", "error");
        return;
    }

    setIsSubmitting(true);
    
    // Agora capturamos o sucesso/falha explicitamente
    const success = await addToRepertoire(currentUser.ministryId, {
        title: finalTitle,
        link: finalLink,
        date,
        addedBy: currentUser.name
    });

    if (success) {
        if (onItemAdd) onItemAdd(finalTitle);
        await setRepertoire([]); // Reload list to force refresh from DB
        
        // Clear forms but keep date
        setTitle("");
        setLink("");
        addToast("Música adicionada com sucesso!", "success");
    } else {
        addToast("Erro ao salvar música no banco de dados. Tente novamente.", "error");
    }
    
    setIsSubmitting(false);
  };

  const handleAiSuggest = async () => {
      if (!aiTheme) return;
      setAiLoading(true);
      const results = await suggestRepertoireAI(aiTheme);
      setAiSuggestions(results);
      setAiLoading(false);
  };

  const handleDelete = (id: string) => {
      confirmAction("Excluir Item", "Tem certeza que deseja remover este item do repertório?", async () => {
          await deleteFromRepertoire(id);
          await setRepertoire([]); // Trigger reload
          addToast("Item removido.", "success");
      });
  };

  // Helpers de Visualização
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getSpotifyId = (url: string) => {
      const match = url.match(/track\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
  };

  const getPlaylistId = (url: string) => {
    const regExp = /[?&]list=([^#\&\?]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = Math.abs(hash % 360);
    const c2 = (c1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${c1}, 70%, 60%), hsl(${c2}, 70%, 40%))`;
  };

  const groupedRepertoire = repertoire.reduce((acc, item) => {
      const dateKey = item.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
  }, {} as Record<string, RepertoireItem[]>);

  const sortedDates = Object.keys(groupedRepertoire).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            {mode === 'manage' ? <Settings className="text-pink-500"/> : <Music className="text-pink-500"/>}
            {mode === 'manage' ? 'Gerenciar Repertório' : 'Repertório Musical'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'manage' 
                ? 'Adicione músicas do Spotify, YouTube ou sugestões de IA.' 
                : 'Lista de louvores para os próximos cultos.'}
          </p>
        </div>
      </div>

      {mode === 'manage' && (
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in">
              {/* Header do Form */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <div className="flex items-center gap-2">
                      <div className="bg-green-500 text-white p-1.5 rounded-lg shadow-sm">
                          <Music size={16}/> 
                      </div>
                      <div>
                          <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Adicionar Música</h3>
                          {isSpotifyLoggedIn && spotifyUser ? (
                              <p className="text-[10px] text-zinc-500">Logado como: <span className="font-bold text-green-600">{spotifyUser.display_name}</span></p>
                          ) : isSpotifyLoggedIn ? (
                              <p className="text-[10px] text-green-600 font-bold">● Conectado ao Spotify</p>
                          ) : null}
                      </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => setShowAiModal(!showAiModal)}
                        className="flex-1 sm:flex-none justify-center text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-purple-100 transition-colors"
                      >
                          <Sparkles size={14} /> Sugestão IA
                      </button>
                      
                      {/* Lógica do Botão Spotify Atualizada */}
                      <button 
                          onClick={isSpotifyLoggedIn ? undefined : handleSpotifyLogin}
                          disabled={isSpotifyLoggedIn}
                          className={`flex-1 sm:flex-none justify-center text-xs font-bold text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                              isSpotifyLoggedIn 
                              ? "bg-green-800 cursor-default opacity-90 border border-green-700" 
                              : "bg-[#1DB954] hover:bg-[#1ed760]"
                          }`}
                      >
                          {isSpotifyLoggedIn ? (
                              <>
                                  <Check size={14} className="text-green-200"/>
                                  <span>Spotify Conectado</span>
                              </>
                          ) : (
                              <>
                                  <LogIn size={14} />
                                  <span>Conectar Spotify</span>
                              </>
                          )}
                      </button>

                      {/* Botão Sair separado para manter funcionalidade */}
                      {isSpotifyLoggedIn && (
                          <button onClick={handleSpotifyLogout} className="text-xs bg-zinc-100 dark:bg-zinc-700 p-2 rounded-lg text-zinc-500 hover:text-red-500 flex items-center justify-center transition-colors" title="Desconectar">
                              <LogOut size={16}/>
                          </button>
                      )}
                  </div>
              </div>

              {/* Data Selection - IMPORTANT: Controlled Input with LocalStorage persistence */}
              <div className="mb-4 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block flex items-center gap-1"><Calendar size={10}/> Data do Culto (Obrigatório)</label>
                  <input 
                      id="date-input"
                      type="date" 
                      value={date} 
                      onChange={e => handleDateChange(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500 font-medium transition-all"
                  />
                  {!date && <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={10}/> Selecione uma data para habilitar a adição.</p>}
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-1 overflow-x-auto">
                  <button onClick={() => setActiveTab('spotify')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'spotify' ? 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/10' : 'text-zinc-500 border-transparent'}`}>
                      <Search size={14}/> Busca
                  </button>
                  {isSpotifyLoggedIn && (
                      <button onClick={() => { setActiveTab('playlists'); if(userPlaylists.length === 0) handleLoadPlaylists(); }} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'playlists' ? 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/10' : 'text-zinc-500 border-transparent'}`}>
                          <ListMusic size={14}/> Minhas Playlists
                      </button>
                  )}
                  <button onClick={() => setActiveTab('manual')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'manual' ? 'text-pink-600 border-pink-500 bg-pink-50 dark:bg-pink-900/10' : 'text-zinc-500 border-transparent'}`}>
                      <Youtube size={14}/> Manual / YouTube
                  </button>
              </div>

              {/* AI Panel (Condicional) */}
              {showAiModal && (
                  <div className="mb-6 p-4 bg-purple-50 dark:bg-zinc-900/50 rounded-xl border border-purple-100 dark:border-zinc-700">
                      <div className="flex gap-2 mb-4">
                          <input 
                             placeholder="Tema (Ex: Gratidão, Cruz, Natal...)" 
                             value={aiTheme}
                             onChange={e => setAiTheme(e.target.value)}
                             className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button 
                             onClick={handleAiSuggest}
                             disabled={aiLoading || !aiTheme}
                             className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                          >
                              {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                          </button>
                      </div>
                      
                      {aiSuggestions.length > 0 && (
                          <div className="space-y-2">
                              {aiSuggestions.map((sug, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3 rounded-lg border border-purple-100 dark:border-zinc-700">
                                      <div>
                                          <p className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{sug.title} <span className="font-normal text-zinc-500">- {sug.artist}</span></p>
                                          <p className="text-xs text-purple-500 italic">{sug.reason}</p>
                                      </div>
                                      <button 
                                        onClick={() => {
                                            setSpotifyQuery(`${sug.title} ${sug.artist}`);
                                            setActiveTab('spotify');
                                            setShowAiModal(false);
                                            handleSpotifySearch(); // Auto trigger search
                                        }}
                                        className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded font-bold"
                                      >
                                          Buscar
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* === SEARCH TAB === */}
              {activeTab === 'spotify' && (
                  <div className="space-y-4 animate-fade-in">
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              placeholder="Digite música ou artista..."
                              value={spotifyQuery} 
                              onChange={e => setSpotifyQuery(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSpotifySearch()}
                              className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button 
                              onClick={handleSpotifySearch}
                              disabled={spotifyLoading}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50"
                          >
                              {spotifyLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                          </button>
                      </div>

                      {spotifyResults.length > 0 && (
                          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">
                              {spotifyResults.map(track => (
                                  <div key={track.id} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                                      <div className="flex items-center gap-3 overflow-hidden">
                                          <img src={track.album.images[2]?.url || track.album.images[0]?.url} className="w-10 h-10 rounded shadow-sm shrink-0" alt="Album" />
                                          <div className="min-w-0">
                                              <p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{track.name}</p>
                                              <p className="text-xs text-zinc-500 truncate">{track.artists[0].name}</p>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => handleAdd(`${track.name} - ${track.artists[0].name}`, track.external_urls.spotify)}
                                          disabled={isSubmitting || !date}
                                          className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors disabled:opacity-50 ${
                                              !date ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800'
                                          }`}
                                          title={!date ? "Selecione uma data primeiro" : "Adicionar à escala"}
                                      >
                                          Adicionar
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* === PLAYLISTS TAB === */}
              {activeTab === 'playlists' && isSpotifyLoggedIn && (
                  <div className="animate-fade-in">
                      {selectedPlaylist ? (
                          // TRACKS VIEW
                          <div className="space-y-3">
                              <button onClick={() => setSelectedPlaylist(null)} className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2">
                                  <ArrowLeft size={14}/> Voltar para Playlists
                              </button>
                              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg mb-2">
                                  {selectedPlaylist.images?.[0] && <img src={selectedPlaylist.images[0].url} className="w-12 h-12 rounded shadow-sm" />}
                                  <div>
                                      <h4 className="font-bold text-sm text-zinc-800 dark:text-white">{selectedPlaylist.name}</h4>
                                      <p className="text-xs text-zinc-500">{playlistTracks.length} músicas</p>
                                  </div>
                              </div>
                              
                              {isLoadingPlaylists ? (
                                  <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-green-500" /></div>
                              ) : (
                                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                      {playlistTracks.map((track, idx) => (
                                          <div key={idx} className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg group">
                                              <div className="flex-1 min-w-0 pr-2">
                                                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{track.name}</p>
                                                  <p className="text-xs text-zinc-500 truncate">{track.artists[0].name}</p>
                                              </div>
                                              <button 
                                                  onClick={() => handleAdd(`${track.name} - ${track.artists[0].name}`, track.external_urls.spotify)}
                                                  disabled={isSubmitting || !date}
                                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                                                      !date ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-green-500 hover:text-white'
                                                  }`}
                                              >
                                                  Add
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      ) : (
                          // PLAYLISTS LIST VIEW
                          <div>
                              {isLoadingPlaylists ? (
                                  <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-green-500"/></div>
                              ) : userPlaylists.length === 0 ? (
                                  <div className="text-center py-8 text-zinc-400 text-sm">Nenhuma playlist encontrada.</div>
                              ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto custom-scrollbar">
                                      {userPlaylists.map(pl => (
                                          <button 
                                              key={pl.id}
                                              onClick={() => handleOpenPlaylist(pl)}
                                              className="flex flex-col items-start p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors text-left group"
                                          >
                                              <img src={pl.images?.[0]?.url || '/icon.png'} className="w-full aspect-square object-cover rounded-lg mb-2 shadow-sm group-hover:shadow-md transition-shadow bg-zinc-200" />
                                              <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 line-clamp-1 w-full">{pl.name}</span>
                                              <span className="text-[10px] text-zinc-500">{pl.tracks.total} músicas</span>
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              )}

              {/* === MANUAL TAB === */}
              {activeTab === 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                      <div className="md:col-span-1">
                          <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Título</label>
                          <input type="text" placeholder="Ex: Todavia Me Alegrarei" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"/>
                      </div>
                      <div className="md:col-span-1">
                          <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Link YouTube</label>
                          <input type="text" placeholder="Link do vídeo ou playlist..." value={link} onChange={e => setLink(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"/>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                          <button onClick={() => handleAdd()} disabled={isSubmitting || !date} className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                              {isSubmitting ? 'Salvando...' : 'Adicionar Manualmente'}
                          </button>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Listagem de Músicas (Card View) */}
      <div className="space-y-8">
          {sortedDates.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Music className="mx-auto mb-3 opacity-20" size={48}/>
                  <p>Nenhum louvor cadastrado ainda.</p>
              </div>
          ) : (
              sortedDates.map(dateKey => {
                  const [y, m, d] = dateKey.split('-');
                  const formattedDate = `${d}/${m}/${y}`;
                  
                  return (
                      <div key={dateKey} className="animate-slide-up">
                          <div className="flex items-center gap-2 mb-3 px-1">
                              <div className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 p-1.5 rounded-lg">
                                  <Calendar size={16} />
                              </div>
                              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-lg">Culto {formattedDate}</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {groupedRepertoire[dateKey].map(item => {
                                  const spotifyId = getSpotifyId(item.link);
                                  const videoId = getYouTubeId(item.link);
                                  const isPlaylist = getPlaylistId(item.link);
                                  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

                                  return (
                                      <div key={item.id} className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all group">
                                          <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                                              {spotifyId ? (
                                                  <div className="w-full h-full bg-[#1DB954] flex items-center justify-center relative">
                                                      <iframe src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator&theme=0`} width="100%" height="100%" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="absolute inset-0"></iframe>
                                                  </div>
                                              ) : thumbnailUrl ? (
                                                  <>
                                                      <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform z-20">
                                                              {isPlaylist ? <ListMusic size={24} /> : <PlayCircle size={28} fill="white" />}
                                                          </a>
                                                      </div>
                                                  </>
                                              ) : (
                                                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-4 text-center relative" style={{ background: getGradient(item.title + item.id) }}>
                                                      <div className="absolute inset-0 bg-black/20" />
                                                      <div className="relative z-10">
                                                          <ListMusic size={32} className="mb-2 opacity-90 mx-auto drop-shadow-md"/>
                                                          <span className="text-xs font-bold uppercase tracking-widest opacity-90 drop-shadow-sm line-clamp-2">{item.title}</span>
                                                      </div>
                                                  </div>
                                              )}
                                              
                                              {mode === 'manage' && (
                                                  <button onClick={() => handleDelete(item.id)} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 z-30" title="Excluir"><Trash2 size={14} /></button>
                                              )}
                                          </div>
                                          
                                          <div className="p-4">
                                              <h4 className="font-bold text-zinc-800 dark:text-white line-clamp-1" title={item.title}>{item.title}</h4>
                                              <div className="flex justify-between items-center mt-2">
                                                  <span className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${spotifyId ? 'text-green-600' : 'text-zinc-500'}`}>
                                                      {spotifyId ? <><Music size={10}/> Spotify</> : isPlaylist ? 'YouTube Playlist' : 'YouTube'}
                                                  </span>
                                                  {!spotifyId && (
                                                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 font-medium">Abrir <ExternalLink size={12} /></a>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })
          )}
      </div>
    </div>
  );
};
