"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useAI } from "@/context/AIContext";
import { Button } from "@/components/ui/Button";

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
        className={clsx(
          "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
          enabled
            ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
            : "border-slate-700 text-slate-400 hover:border-slate-500"
        )}
      >
        <span
          className={clsx(
            "w-1.5 h-1.5 rounded-full",
            enabled ? "bg-indigo-400" : "bg-slate-600"
          )}
        />
        {enabled ? "AI Mode: On" : "AI Mode: Off"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
            <p className="text-slate-100 font-semibold text-sm mb-1">
              AI Mode
            </p>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              Enter your Groq API key to get AI-generated explanations.
              Stored in localStorage only — never sent to our servers.
            </p>
            <input
              type="password"
              placeholder="gsk_..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && keyInput.trim() && handleSave()
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 mb-3"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!keyInput.trim()}
              >
                Save & Enable
              </Button>
              {enabled && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    toggleEnabled();
                    setOpen(false);
                  }}
                >
                  Disable
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
