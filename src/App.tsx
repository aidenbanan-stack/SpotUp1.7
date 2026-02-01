import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGate from "@/auth/AuthGate";
import { AppProvider } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";

import Home from "./pages/Home";
import MapView from "./pages/MapView";
import CreateGame from "./pages/CreateGame";
import EditGame from "./pages/EditGame";
import GameDetail from "./pages/GameDetail";
import LiveGame from "./pages/LiveGame";
import PostGame from "./pages/PostGame";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Leaderboards from "./pages/Leaderboards";
import Tournaments from "./pages/Tournaments";
import CreateTournament from "./pages/CreateTournament";
import TournamentDetail from "./pages/TournamentDetail";
import Notifications from "./pages/Notifications";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Friends from "./pages/Friends";
import GameHistory from "./pages/GameHistory";
import Messages from "./pages/Messages";
import Squads from "./pages/Squads";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthGate>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/create-game" element={<CreateGame />} />

              <Route path="/game/:id" element={<GameDetail />} />
              <Route path="/game/:id/edit" element={<EditGame />} />
              <Route path="/game/:id/live" element={<LiveGame />} />
              <Route path="/game/:id/postgame" element={<PostGame />} />

              <Route path="/profile" element={<Profile />} />
              <Route path="/edit-profile" element={<EditProfile />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/leaderboards" element={<Leaderboards />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/create-tournament" element={<CreateTournament />} />
              <Route path="/tournament/:id" element={<TournamentDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/history" element={<GameHistory />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/squads" element={<Squads />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </AuthGate>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
