import { useState, useEffect } from 'react';
import { buildChampion } from '@/lib/championEngine';
import { DD, setData } from '@/lib/gameData';
import { refixIds } from '@/lib/dataLoader';

const CACHE_KEY = 'draftmaster_champions_cache';
const CACHE_VERSION_KEY = 'draftmaster_cache_version';

// Data Dragon autorise les appels directs depuis le navigateur : plus besoin du proxy Base44 (riotProxy)
async function ddragonFetch(path) {
  const res = await fetch(`${DD}${path}`);
  if (!res.ok) throw new Error(`Data Dragon ${res.status}`);
  return res.json();
}
const CACHE_RAW_KEY = 'draftmaster_champions_raw';

function publish(raw, version) {
  setData({ champs: raw, version });
  refixIds();
}

export function useChampions() {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    // Clear old cache on app startup to force fresh data
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (cachedVersion && cachedVersion.startsWith('1')) {
      // Clear cache if it's a very old version (starts with 1x.x.x)
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
    }
    loadChampions();
  }, []);

  async function loadChampions() {
    setLoading(true);
    setError(null);

    let latestVersion = null;

    // Always try to get latest patch version via proxy first
    try {
      const versions = await ddragonFetch('/api/versions.json');
      if (versions && versions[0]) {
        latestVersion = versions[0];
        setVersion(latestVersion);
      }
    } catch (e) {
      // Only use cache if API fails
      console.warn("Erreur API version, utilisation du cache");
    }

    // If API failed and no version set yet, use cache
    if (!latestVersion) {
      const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
      if (cachedVersion) {
        latestVersion = cachedVersion;
        setVersion(cachedVersion);
        console.warn('Hors ligne : champions du cache');
      } else {
        setError("Impossible de charger les données des champions. Vérifiez votre connexion et réessayez.");
        setLoading(false);
        return;
      }
    }

    if (!latestVersion) {
      setError("Impossible de déterminer la version du patch. Vérifiez votre connexion et réessayez.");
      setLoading(false);
      return;
    }

    // Clear old cache if version changed
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (cachedVersion && cachedVersion !== latestVersion) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
    }

    // Check if we have cached data for this version
    const cached = localStorage.getItem(CACHE_KEY);
    if (cachedVersion === latestVersion && cached) {
      try {
        const parsed = JSON.parse(cached);
        const raw = JSON.parse(localStorage.getItem(CACHE_RAW_KEY) || 'null');
        if (parsed && parsed.length > 100 && raw) {
          publish(raw, latestVersion);
          setChampions(parsed);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Cache corrupted, continue to fetch
      }
    }

    // Fetch champion data via proxy (fr_FR, fallback to en_US)
    let data = null;
    const langs = ['fr_FR', 'en_US'];
    for (const lang of langs) {
      try {
        data = await ddragonFetch(`/cdn/${latestVersion}/data/${lang}/champion.json`);
        if (data && data.data) break;
      } catch (e) {
        // Try next language
      }
    }

    if (!data || !data.data) {
      setError("Impossible de charger les données des champions. Vérifiez votre connexion et réessayez.");
      setLoading(false);
      return;
    }

    const rawChampions = Object.values(data.data);
    publish(data.data, latestVersion);
    const enriched = rawChampions.map(c => buildChampion({ ...c, iconVersion: latestVersion }));
    const withIcons = enriched.map(c => ({
      ...c,
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${c.id}.png`
    }));

    // Cache the result
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(withIcons));
      localStorage.setItem(CACHE_RAW_KEY, JSON.stringify(data.data));
      localStorage.setItem(CACHE_VERSION_KEY, latestVersion);
    } catch (e) {
      // Ignore storage errors
    }

    setChampions(withIcons);
    setLoading(false);
  }

  return { champions, loading, error, version, reload: loadChampions };
}