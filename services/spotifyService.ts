
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

// Cache para tokens
let appToken: string | null = null;
let userToken: string | null = null; // Token do usuário logado
let tokenExpiry: number = 0;

// --- 1. AUTENTICAÇÃO DO APLICATIVO (Client Credentials - Para busca genérica se não logado) ---
export const getClientCredentialsToken = async (ministryId: string): Promise<string | null> => {
    if (appToken && Date.now() < tokenExpiry) return appToken;

    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const clientId = localStorage.getItem(`spotify_cid_${cleanMid}`);
    const clientSecret = localStorage.getItem(`spotify_sec_${cleanMid}`);

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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const clientId = localStorage.getItem(`spotify_cid_${cleanMid}`);
    
    if (!clientId) return null;

    const redirectUri = window.location.origin; // A própria página
    const scopes = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative"
    ].join(" ");

    return `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;
};

// Salva token da URL (Hash)
export const handleLoginCallback = () => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            userToken = token;
            // Limpa a URL para ficar limpa
            window.history.replaceState(null, '', ' ');
            return token;
        }
    }
    return null;
};

export const logoutSpotify = () => {
    userToken = null;
};

export const isUserLoggedIn = () => !!userToken;

// --- 3. FUNÇÕES DE DADOS ---

const fetchSpotify = async (endpoint: string, token: string) => {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
        userToken = null; // Token expirou
        throw new Error("Token expirado");
    }
    return res.json();
};

export const getUserProfile = async () => {
    if (!userToken) return null;
    try {
        return await fetchSpotify('/me', userToken);
    } catch (e) { return null; }
};

export const getUserPlaylists = async (): Promise<SpotifyPlaylist[]> => {
    if (!userToken) return [];
    try {
        const data = await fetchSpotify('/me/playlists?limit=50', userToken);
        return data.items || [];
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const getPlaylistTracks = async (playlistId: string): Promise<SpotifyTrack[]> => {
    if (!userToken) return [];
    try {
        const data = await fetchSpotify(`/playlists/${playlistId}/tracks?limit=50`, userToken);
        return data.items.map((item: any) => item.track).filter((t: any) => t && t.id);
    } catch (e) { return []; }
};

export const searchSpotifyTracks = async (query: string, ministryId: string): Promise<SpotifyTrack[]> => {
    // Usa token de usuário se tiver, senão usa credentials do app
    let token = userToken;
    if (!token) {
        token = await getClientCredentialsToken(ministryId);
    }

    if (!token) throw new Error("Credenciais do Spotify não configuradas.");

    try {
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, token);
        return data.tracks?.items || [];
    } catch (e) {
        console.error("Erro busca Spotify:", e);
        return [];
    }
};
