import { useState } from 'react';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import icrLogo from '../assets/icr-logo.svg';

const ICR_LOGO = icrLogo;

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useICRAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={ICR_LOGO} alt="ICR Logo" className="w-32 h-32 object-contain mb-4" />
          <p className="text-white/50 text-xs font-['Nunito'] text-center mt-1">
            FEDERAÇÃO<br />IGREJA CRISTÃ REFORMADA AVIVALISTA DO BRASIL
          </p>
        </div>

        {/* Login form */}
        <div className="bg-[#2b2b2b] rounded-2xl p-8">
          <h2 className="text-white text-xl font-['Nunito'] font-semibold mb-6 text-center">
            Sistema de Gestão de Secretaria
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-3 text-white font-['Nunito'] focus:outline-none focus:border-[#017158] transition-colors"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-3 text-white font-['Nunito'] focus:outline-none focus:border-[#017158] transition-colors"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#017158] hover:bg-[#01a07e] text-white font-['Nunito'] font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-icons animate-spin text-[18px]">refresh</span>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-white/30 text-xs text-center mt-6 font-['Nunito']">
          © 2025 ICR - Sistema de Gestão de Secretaria
        </p>
      </div>
    </div>
  );
}
