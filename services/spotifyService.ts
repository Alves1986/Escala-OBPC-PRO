
interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
    external_urls: { spotify: string };
    uri: string;
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    images: { url: string }[];
    tracks: { total: number };
}

// Cache para tokens de APPLICATIVO (Client Credentials)
let appToken: string | null = null;
let tokenExpiry: number = 0;

// Helper para obter credenciais (Prioridade: LocalStorage/DB > Env Vars)
const getCredentials = (ministryId: string) => {
    const cleanMid = (ministryId || "").trim().toLowerCase().replace(/\s+/g, '-');
    
    // 1. Tenta pegar das configurações salvas no banco (via localStorage)
    let clientId = localStorage.getItem(`spotify_cid_${cleanMid}`);
    let clientSecret = localStorage.getItem(`spotify_sec_${cleanMid}`);

    // 2. Se não tiver, tenta pegar das variáveis de ambiente (.env)
    if (!clientId) {
        clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
    }
    if (!clientSecret) {
        clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || "";
    }

    return { clientId, clientSecret };
};

// --- 1. AUTENTICAÇÃO DO APLICATIVO (Client Credentials - Para busca genérica se não logado) ---
export const getClientCredentialsToken = async (ministryId: string): Promise<string | null> => {
    if (appToken && Date.now() < tokenExpiry) return appToken;

    const { clientId, clientSecret } = getCredentials(ministryId);

    if (!clientId || !clientSecret) return null;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });

        const data = await response.json();
        if (data.access_token) {
            appToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; 
            return appToken;
        }
    } catch (e) {
        console.error("Erro auth app spotify:", e);
    }
    return null;
};

// --- 2. AUTENTICAÇÃO DO USUÁRIO (Implicit Grant - Para Playlists) ---

// Gera a URL de login
export const getLoginUrl = (ministryId: string) => {
    const { clientId } = getCredentials(ministryId);
    
    if (!clientId) {
        console.error("Client ID not found for", ministryId);
        return null;
    }

    const redirectUri = window.location.origin; 
    const scopes = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative"
    ].join(" ");

    return `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;
};

// Salva token da URL (Hash) e persiste no LocalStorage
export const handleLoginCallback = () => {
    const hash = window.location.hash;
    
    // Regex robusto para pegar o access_token mesmo se houver outros parâmetros ou lixo na URL
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    const expiresInMatch = hash.match(/expires_in=([^&]*)/);

    if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        const expiresIn = expiresInMatch ? expiresInMatch[1] : "3600";
        
        // Salva no localStorage para persistir após refresh
        localStorage.setItem('spotify_user_token', token);
        
        // Define expiração (padrão 1 hora geralmente)
        const expiryTime = Date.now() + (Number(expiresIn) || 3600) * 1000;
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

        // Limpa a URL para ficar limpa e remover o token da barra de endereço
        window.history.replaceState(null, '', ' ');
        return token;
    }
    
    return null;
};

export const logoutSpotify = () => {
    localStorage.removeItem('spotify_user_token');
    localStorage.removeItem('spotify_token_expiry');
};

export const isUserLoggedIn = () => {
    const token = localStorage.getItem('spotify_user_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    
    if (!token) return false;
    if (expiry && Date.now() > Number(expiry)) {
        logoutSpotify();
        return false;
    }
    return true;
};

const getUserToken = () => {
    if (isUserLoggedIn()) {
        return localStorage.getItem('spotify_user_token');
    }
    return null;
};

// --- 3. FUNÇÕES DE DADOS ---

const fetchSpotify = async (endpoint: string, token: string) => {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
        logoutSpotify(); // Token expirou na API
        throw new Error("Token expirado");
    }
    return res.json();
};

export const getUserProfile = async () => {
    const token = getUserToken();
    if (!token) return null;
    try {
        return await fetchSpotify('/me', token);
    } catch (e) { return null; }
};

export const getUserPlaylists = async (): Promise<SpotifyPlaylist[]> => {
    const token = getUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify('/me/playlists?limit=50', token);
        return data.items || [];
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const getPlaylistTracks = async (playlistId: string): Promise<SpotifyTrack[]> => {
    const token = getUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify(`/playlists/${playlistId}/tracks?limit=50`, token);
        return data.items.map((item: any) => item.track).filter((t: any) => t && t.id);
    } catch (e) { return []; }
};

export const searchSpotifyTracks = async (query: string, ministryId: string): Promise<SpotifyTrack[]> => {
    // 1. Tenta User Token (Melhor, pois usa a conta de quem está logado)
    let token = getUserToken();
    
    // 2. Se não tiver, tenta App Token (Client Credentials - fallback genérico)
    if (!token) {
        token = await getClientCredentialsToken(ministryId);
    }

    if (!token) {
        console.warn("Nenhum token disponível para busca.");
        return []; 
    }

    try {
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, token);
        return data.tracks?.items || [];
    } catch (e) {
        console.error("Erro busca Spotify:", e);
        return [];
    }
};
