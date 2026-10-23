import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import {
  createPanelSession,
  endPanelSession,
  restorePanelSession,
  setAuthMode,
  verifyAdminToken,
} from "@/utils/api";
import { resetChainTesterState } from "@/composables/useChainTesterState";

// In a session the admin token is never held: the credential is an HttpOnly cookie the page cannot read. The pages
// still pass `adminStore.token` to the API functions and test it to know whether anybody is signed in, so it holds
// this marker, which is not a secret and which the API layer ignores in session mode.
const SESSION_MARKER = "session";

/**
 * Admin store - who is signed in. Nothing is persisted.
 *
 * A backend that knows admin sessions exchanges the admin token once for an HttpOnly cookie (`authMode` "session"):
 * the token is not kept in the page and a reload restores the session. Against an older backend, or with sessions
 * turned off, the token stays in memory as it always did (`authMode` "token").
 */
export const useAdminStore = defineStore("admin", () => {
  // State - the token (token mode only) is kept in memory, not persisted
  const token = ref("");
  const isAuthenticated = ref(false);
  const authMode = ref("token");
  const sessionEnds = ref(null); // { idle, absolute } of the session, when there is one

  // Computed
  const hasToken = computed(() => !!token.value);

  function clear() {
    token.value = "";
    isAuthenticated.value = false;
    authMode.value = "token";
    sessionEnds.value = null;
    setAuthMode("token");
  }

  function enterSession(ends) {
    token.value = SESSION_MARKER;
    isAuthenticated.value = true;
    authMode.value = "session";
    sessionEnds.value = {
      idle: ends.expires_at,
      absolute: ends.absolute_expires_at,
    };
    setAuthMode("session");
  }

  // Actions
  async function login(adminToken) {
    try {
      enterSession(await createPanelSession(adminToken));
      return true;
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        clear();
        return false;
      }
      if (status !== 404) {
        // A wait (429), a weak token (503), a network error: the login page says what happened
        clear();
        throw error;
      }
      // 404: this backend does not know sessions. Fall through to the token in memory.
    }

    // Verify token is valid before storing
    try {
      const valid = await verifyAdminToken(adminToken);
      if (valid) {
        token.value = adminToken;
        isAuthenticated.value = true;
        return true;
      } else {
        clear();
        return false;
      }
    } catch (error) {
      clear();
      throw error;
    }
  }

  // After a reload: is there a live session behind the cookie? Anything else (no cookie, an older backend, sessions
  // off, the backend not answering) simply means the administrator signs in as usual.
  async function restore() {
    try {
      enterSession(await restorePanelSession());
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    const inSession = authMode.value === "session";
    clear();
    // Reset module-level chain tester state so the next operator's
    // session starts clean (the state survives SPA route switches
    // intentionally — see useChainTesterState for the rationale —
    // but a logout should always wipe it).
    resetChainTesterState();
    // End the session on the server too; if it was already over there is nothing to tell
    return inSession ? endPanelSession().catch(() => {}) : Promise.resolve();
  }

  return {
    token,
    isAuthenticated,
    authMode,
    sessionEnds,
    hasToken,
    login,
    restore,
    logout,
  };
});

// Hot-replace this store on edit instead of full-reloading the page.
// Without this, editing admin.js would full-reload and dump the in-memory
// token, making local development of auth-related code painful.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAdminStore, import.meta.hot));
}
