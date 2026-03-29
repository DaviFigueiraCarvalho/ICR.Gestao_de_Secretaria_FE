import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Redirect } from "wouter";
import { canAccessPathByScope, getScopeLevel } from "./lib/scope-access";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ICRAuthProvider, useICRAuth } from "./contexts/ICRAuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Federacoes from "./pages/Federations";
import Igrejas from "./pages/Churchs";
import Celulas from "./pages/Cell";
import Familias from "./pages/Family";
import Membros from "./pages/Members";
import Ministros from "./pages/Ministers";
import DatasPastores from "./pages/DatesMinister";
import DatasMembers from "./pages/DatesMembers";
import Repasses from "./pages/Repass";
import Usuarios from "./pages/UserRole";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useICRAuth();
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

  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  if (!canAccessPathByScope(scopeLevel, location)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/federations" component={() => <ProtectedRoute component={Federacoes} />} />
      <Route path="/churches" component={() => <ProtectedRoute component={Igrejas} />} />
      <Route path="/cells" component={() => <ProtectedRoute component={Celulas} />} />
      <Route path="/families" component={() => <ProtectedRoute component={Familias} />} />
      <Route path="/members" component={() => <ProtectedRoute component={Membros} />} />
      <Route path="/ministers" component={() => <ProtectedRoute component={Ministros} />} />
      <Route path="/ministers-dates" component={() => <ProtectedRoute component={DatasPastores} />} />
      <Route path="/members-dates" component={() => <ProtectedRoute component={DatasMembers} />} />
      <Route path="/repasses" component={() => <ProtectedRoute component={Repasses} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />

      {/* Legacy PT-BR route aliases */}
      <Route path="/federacoes" component={() => <Redirect to="/federations" />} />
      <Route path="/igrejas" component={() => <Redirect to="/churches" />} />
      <Route path="/celulas" component={() => <Redirect to="/cells" />} />
      <Route path="/familias" component={() => <Redirect to="/families" />} />
      <Route path="/membros" component={() => <Redirect to="/members" />} />
      <Route path="/ministros" component={() => <Redirect to="/ministers" />} />
      <Route path="/datas-pastores" component={() => <Redirect to="/ministers-dates" />} />
      <Route path="/datas-membros" component={() => <Redirect to="/members-dates" />} />
      <Route path="/configuracoes" component={() => <Redirect to="/settings" />} />
      <Route path="/perfil" component={() => <Redirect to="/profile" />} />

      <Route path="/users" component={() => <ProtectedRoute component={Usuarios} />} />
      <Route path="/usuarios" component={() => <Redirect to="/users" />} />
      <Route component={() => <Redirect to="/" />} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" defaultMode="system" switchable>
        <ICRAuthProvider>
          <TooltipProvider>
            <Toaster position="top-right" />
            <Router />
          </TooltipProvider>
        </ICRAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
