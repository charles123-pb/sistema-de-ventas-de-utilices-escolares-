import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../services/api";
import type { User } from "../types";
// Comparte la identidad y las acciones de sesión entre todas las pantallas.
const Auth = createContext<{
  user: User | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("uv:session-expired", expire);
    return () => window.removeEventListener("uv:session-expired", expire);
  }, []);
  // Al abrir la aplicación se recupera la sesión existente mediante /me.
  useEffect(() => {
    let active = true;
    api<User>("/me")
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Ignora respuestas que lleguen después de desmontar el proveedor.
    return () => {
      active = false;
    };
  }, []);
  return (
    <Auth.Provider
      value={{
        user,
        loading,
        login: async (u, p) => {
          setUser(await api("/login", "POST", { usuario: u, password: p }));
        },
        logout: async () => {
          await api("/logout", "POST", {});
          setUser(null);
        },
      }}
    >
      {children}
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
