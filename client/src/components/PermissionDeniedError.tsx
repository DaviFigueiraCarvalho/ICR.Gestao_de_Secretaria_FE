interface PermissionDeniedErrorProps {
  message?: string;
  compact?: boolean;
}

export default function PermissionDeniedError({
  message = "Você não tem permissão para acessar este conteúdo",
  compact = false,
}: PermissionDeniedErrorProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <span className="material-icons text-amber-500/60 text-3xl">lock</span>
          <p className="text-white/60 font-['Nunito'] text-sm">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 rounded-full blur-lg" />
          <span className="material-icons text-amber-500/80 text-5xl relative">lock</span>
        </div>
        <div>
          <h2 className="text-white font-['Nunito'] font-semibold text-lg mb-1">Acesso Restrito</h2>
          <p className="text-white/60 font-['Nunito'] text-sm">{message}</p>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-amber-500/0 via-amber-500/20 to-amber-500/0 mt-2" />
        <p className="text-white/40 font-['Nunito'] text-xs">
          Contate um administrador se acredita que deveria ter acesso
        </p>
      </div>
    </div>
  );
}
