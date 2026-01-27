import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';

export default function Messages() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="glass-card p-8 text-center">
          <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">
            Messages are stubbed for now. Next step is wiring this to real users and squads.
          </p>
        </div>
      </main>
    </div>
  );
}
