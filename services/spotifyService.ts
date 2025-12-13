
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

// Cache para tokens de APPLICATIVO
let appToken: string | null = null;
let tokenExpiry: number = 0;

const getCredentials = (ministryId: string) => {
    const cleanMid = (ministryId || "").trim().toLowerCase().replace(/\s+/g, '-');
    let clientId = localStorage.getItem(`spotify_cid_${cleanMid}`);
    let clientSecret = localStorage.getItem(`spotify_sec_${cleanMid}`);

    try {
        // @ts-ignore
        if (!clientId && import.meta.env) clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
        // @ts-ignore
        if (!clientSecret && import.meta.env) clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || "";
    } catch(e) {}

    return { clientId, clientSecret };
};

// --- 1. AUTENTICAÇÃO DO APLICATIVO (Client Credentials) ---
export const getClientCredentialsToken = async (ministryId: string): Promise<string | null> => {
    if (appToken && Date.now() < tokenExpiry) return appToken;

    const { clientId, clientSecret } = getCredentials(ministryId);
    if (!clientId || !clientSecret) return null;

    try {
        // CORREÇÃO: URL OFICIAL DO SPOTIFY
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

// --- 2. AUTENTICAÇÃO DO USUÁRIO (Implicit Grant) ---
export const getLoginUrl = (ministryId: string) => {
    const { clientId } = getCredentials(ministryId);
    if (!clientId) return null;

    const redirectUri = window.location.origin; // Redireciona para a própria página
    const scopes = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative"
    ].join(" ");

    // CORREÇÃO: URL OFICIAL DE AUTORIZAÇÃO
    return `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;
};

export const handleLoginCallback = () => {
    const hash = window.location.hash;
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    const expiresInMatch = hash.match(/expires_in=([^&]*)/);

    if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        const expiresIn = expiresInMatch ? expiresInMatch[1] : "3600";
        
        localStorage.setItem('spotify_user_token', token);
        const expiryTime = Date.now() + (Number(expiresIn) || 3600) * 1000;
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

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
    if (isUserLoggedIn()) return localStorage.getItem('spotify_user_token');
    return null;
};

// --- 3. FUNÇÕES DE DADOS ---
const fetchSpotify = async (endpoint: string, token: string) => {
    // CORREÇÃO: URL OFICIAL DA API
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
        logoutSpotify();
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
    } catch (e) { return []; }
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
    let token = getUserToken();
    if (!token) token = await getClientCredentialsToken(ministryId);

    if (!token) return [];

    try {
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, token);
        return data.tracks?.items || [];
    } catch (e) { return []; }
};
