import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ICRAuthProvider, useICRAuth } from "./contexts/ICRAuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Federacoes from "./pages/Federacoes";
import Igrejas from "./pages/Igrejas";
import Celulas from "./pages/Celulas";
import Familias from "./pages/Familias";
import Membros from "./pages/Membros";
import Ministros from "./pages/Ministros";
import DatasPastores from "./pages/DatasPastores";
import Repasses from "./pages/Repasses";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useICRAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-icons animate-spin text-[#017158] text-4xl">refresh</span>
          <p className="text-white/50 font-['Nunito']">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/federacoes" component={() => <ProtectedRoute component={Federacoes} />} />
      <Route path="/igrejas" component={() => <ProtectedRoute component={Igrejas} />} />
      <Route path="/celulas" component={() => <ProtectedRoute component={Celulas} />} />
      <Route path="/familias" component={() => <ProtectedRoute component={Familias} />} />
      <Route path="/membros" component={() => <ProtectedRoute component={Membros} />} />
      <Route path="/ministros" component={() => <ProtectedRoute component={Ministros} />} />
      <Route path="/datas-pastores" component={() => <ProtectedRoute component={DatasPastores} />} />
      <Route path="/repasses" component={() => <ProtectedRoute component={Repasses} />} />
      <Route component={() => <Redirect to="/" />} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ICRAuthProvider>
          <TooltipProvider>
            <Toaster position="top-right" theme="dark" />
            <Router />
          </TooltipProvider>
        </ICRAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
