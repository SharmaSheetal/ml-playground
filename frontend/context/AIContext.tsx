"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

const STORAGE_KEY = "ml_playground_ai_key";
const ENABLED_KEY = "ml_playground_ai_enabled";

interface AIContextValue {
  enabled: boolean;
  apiKey: string;
  toggleEnabled: () => void;
  setApiKey: (key: string) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKeyState] = useState("");

  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY) ?? "";
    const storedEnabled = localStorage.getItem(ENABLED_KEY) === "true";
    setApiKeyState(storedKey);
    setEnabled(storedEnabled && storedKey.length > 0);
  }, []);

  function toggleEnabled() {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(ENABLED_KEY, String(next));
      return next;
    });
  }

  function setApiKey(key: string) {
    setApiKeyState(key);
    localStorage.setItem(STORAGE_KEY, key);
    if (key.length > 0) {
      setEnabled(true);
      localStorage.setItem(ENABLED_KEY, "true");
    }
  }

  return (
    <AIContext.Provider value={{ enabled, apiKey, toggleEnabled, setApiKey }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be used within AIProvider");
  return ctx;
}
