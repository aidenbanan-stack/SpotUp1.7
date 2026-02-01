import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SportGrid } from '@/components/SportSelector';
import type { Sport } from '@/types';
import spotupLogo from '@/assets/SpotUpLogoOld.png';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadMyAvatar, updateMyProfile } from '@/lib/profileApi';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [height, setHeight] = useState(user?.height ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [primarySport, setPrimarySport] = useState<Sport[]>(user?.primarySport ? [user.primarySport] : []);
  const [secondarySports, setSecondarySports] = useState<Sport[]>(user?.secondarySports ?? []);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(username.trim()) && Boolean(age.trim()) && Boolean(city.trim()) && primarySport.length > 0;
  }, [username, age, city, primarySport.length]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <img src={spotupLogo} alt="SpotUp" className="w-20 h-20 mx-auto mb-4 rounded-2xl" />
          <p className="text-muted-foreground">Please sign in first.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Go back</Button>
        </div>
      </div>
    );
  }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPhotoFile(f);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Please fill in username, age, city, and choose a primary sport.');
      return;
    }

    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 100) {
      toast.error('Please enter a valid age.');
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined = undefined;
      if (photoFile) {
        photoUrl = await uploadMyAvatar(photoFile);
      }

      const updated = await updateMyProfile({
        username: username.trim(),
        bio: bio.trim(),
        age: ageNum,
        height: height.trim() || undefined,
        city: city.trim(),
        primarySport: primarySport[0],
        secondarySports: secondarySports.filter(s => s !== primarySport[0]),
        profilePhotoUrl: photoUrl,
        onboardingCompleted: true,
      });

      setUser(updated);
      toast.success('Profile created!');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={spotupLogo} alt="SpotUp" className="w-9 h-9 rounded-xl" />
            <div>
              <p className="text-sm text-muted-foreground">Finish setup</p>
              <h1 className="text-lg font-bold">Create your profile</h1>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Required: username, age, city, primary sport</div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <section className="glass-card p-4">
          <h2 className="font-semibold mb-3">Basics</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Username *</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aidenhoops" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Age *</label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="20" inputMode="numeric" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Height</label>
              <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`5'10"`} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">City *</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Aliso Viejo, CA" />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-sm text-muted-foreground">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Quick intro..." />
          </div>
        </section>

        <section className="glass-card p-4">
          <h2 className="font-semibold mb-3">Sports</h2>
          <p className="text-sm text-muted-foreground mb-3">Pick 1 primary sport, then any secondary sports.</p>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Primary sport *</p>
              <SportGrid
                selected={primarySport}
                // Single-select: tapping a new sport should switch immediately.
                single
                onChange={(sports) => setPrimarySport(sports)}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Secondary sports</p>
              <SportGrid
                selected={secondarySports}
                onChange={setSecondarySports}
                maxSelection={6}
              />
            </div>
          </div>
        </section>

        <section className="glass-card p-4">
          <h2 className="font-semibold mb-3">Profile picture</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary/60 overflow-hidden flex items-center justify-center">
              {photoFile ? (
                <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" />
              ) : (
                <img src={user.profilePhotoUrl} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <label className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/60 cursor-pointer', saving && 'opacity-60 pointer-events-none')}>
                <Camera className="w-4 h-4" />
                <span className="text-sm">Upload (optional)</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
              </label>
              <p className="text-xs text-muted-foreground mt-2">If upload fails, create a Storage bucket named <b>avatars</b> and set it public in Supabase.</p>
            </div>
          </div>
        </section>

        <Button disabled={!canSubmit || saving} onClick={handleSubmit} className="w-full">
          {saving ? 'Saving...' : 'Finish setup'}
        </Button>
      </main>
    </div>
  );
}
