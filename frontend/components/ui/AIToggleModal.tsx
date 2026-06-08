"use client";

import { useState } from "react";
import { useAI } from "@/context/AIContext";

export function AIToggle() {
  const { enabled, toggleEnabled, setApiKey } = useAI();
  const [open, setOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  function handleSave() {
    setApiKey(keyInput.trim());
    setKeyInput("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded border transition-colors",
          enabled
            ? "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
            : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-700",
        ].join(" ")}
      >
        <span className={[
          "w-1.5 h-1.5 rounded-full",
          enabled ? "bg-blue-500" : "bg-gray-300",
        ].join(" ")} />
        {enabled ? "AI on" : "AI off"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
            <p className="text-gray-900 font-semibold text-sm mb-0.5">AI Mode</p>
            <p className="text-gray-500 text-xs mb-3 leading-relaxed">
              Enter your Groq API key for AI-generated explanations.
              Stored in localStorage only — never sent to our servers.
            </p>
            <input
              type="password"
              placeholder="gsk_..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && keyInput.trim() && handleSave()}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 mb-3 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!keyInput.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
              >
                Save & enable
              </button>
              {enabled && (
                <button
                  onClick={() => { toggleEnabled(); setOpen(false); }}
                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Disable
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
