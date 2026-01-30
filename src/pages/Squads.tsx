import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Squads() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Squads</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <div className="glass-card p-6 text-center">
          <p className="font-semibold">Coming soon</p>
          <p className="text-sm text-muted-foreground mt-1">
            Squads will show here once real squad data exists.
          </p>
        </div>
      </main>
    </div>
  );
}
