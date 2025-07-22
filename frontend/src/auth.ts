// Utility for managing login state
export const isLoggedIn = () => {
  return !!localStorage.getItem('netzero_logged_in');
};

export const setLoggedIn = () => {
  localStorage.setItem('netzero_logged_in', 'true');
};

export const clearLoggedIn = () => {
  localStorage.removeItem('netzero_logged_in');
};

export const setCurrentUsername = (username: string) => {
  localStorage.setItem('netzero_username', username);
};

export const getCurrentUsername = () => {
  return localStorage.getItem('netzero_username') || '';
};

export const clearCurrentUsername = () => {
  localStorage.removeItem('netzero_username');
}; 