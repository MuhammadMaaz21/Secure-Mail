// Utility to get user settings (with caching)
let settingsCache = null;
let settingsCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getSettings = async () => {
  // Return cached settings if still valid
  if (settingsCache && settingsCacheTime && Date.now() - settingsCacheTime < CACHE_DURATION) {
    return settingsCache;
  }

  try {
    const api = (await import('../api/api')).default;
    const response = await api.get('/settings');
    if (response.data.success) {
      settingsCache = response.data.data;
      settingsCacheTime = Date.now();
      return settingsCache;
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  // Return default settings if fetch fails
  return {
    defaultSelfDestructTimer: 'none',
    blockedSenders: [],
    disableExternalImages: false,
    autoMarkSpam: true,
    autoMarkPhishing: true
  };
};

export const clearSettingsCache = () => {
  settingsCache = null;
  settingsCacheTime = null;
};

