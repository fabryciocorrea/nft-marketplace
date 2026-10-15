import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { login } from "../services/auth";
import { SESSION_KEY } from "../hooks/useSession";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_KEY, user);
      setPassword("");
      onClose();
    },
  });

  if (!isOpen) return null;

  const errorMessage = mutation.isError
    ? (axios.isAxiosError(mutation.error) &&
        mutation.error.response?.data?.error?.message) ||
      "Não foi possível entrar. Tente novamente."
    : null;

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 relative"
      >
        <button
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-6 text-center">
          <h3 id="login-title" className="text-2xl font-bold text-slate-900">
            Entrar na Conta
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Acesse o seu perfil do NFT Marketplace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold uppercase text-slate-600 mb-1"
            >
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="ana@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold uppercase text-slate-600 mb-1"
            >
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 mt-2"
          >
            {mutation.isPending ? "Autenticando..." : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Conta de teste: ana@exemplo.com / Senha@123
        </p>
      </div>
    </div>
  );
}
