import { Store } from "@tanstack/store";

interface AuthState {
  access_token: string | null;
  refresh_token: string | null;
}

const authStore = new Store<AuthState>({
  access_token: null,
  refresh_token: null,
});

// Load tokens from localStorage on initialization
const storedTokens = localStorage.getItem("auth");
if (storedTokens) {
  const { access_token, refresh_token } = JSON.parse(storedTokens);
  authStore.setState({
    access_token,
    refresh_token,
  });
}

// Sync tokens to localStorage whenever they change
authStore.subscribe((state) => {
  localStorage.setItem("auth", JSON.stringify({
    access_token: state.currentVal.access_token,
    refresh_token: state.currentVal.refresh_token,
  }));
});

export const setTokens = (access_token: string, refresh_token: string) => {
  authStore.setState({
    access_token,
    refresh_token,
  });
};

export const clearTokens = () => {
  authStore.setState({
    access_token: null,
    refresh_token: null,
  });
};

export const getTokens = () => {
  return authStore.state;
};

export default authStore;
