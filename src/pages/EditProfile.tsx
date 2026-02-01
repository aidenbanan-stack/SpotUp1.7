import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SportGrid } from '@/components/SportSelector';
import type { Sport } from '@/types';
import { ArrowLeft, Camera, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateMyProfile, uploadMyAvatar } from '@/lib/profileApi';

export default function EditProfile() {
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

  const canSave = useMemo(() => Boolean(username.trim()) && Boolean(city.trim()) && primarySport.length > 0, [username, city, primarySport.length]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPhotoFile(f);
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error('Username, city, and a primary sport are required.');
      return;
    }

    const ageNum = age.trim() ? Number(age) : undefined;
    if (age.trim() && (!Number.isFinite(ageNum) || (ageNum as number) < 10 || (ageNum as number) > 100)) {
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
      });

      setUser(updated);
      toast.success('Profile updated.');
      navigate('/profile');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-lg font-bold">Edit Profile</h1>
          <Button onClick={handleSave} disabled={!canSave || saving} className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
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
            <label className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/60 cursor-pointer', saving && 'opacity-60 pointer-events-none')}>
              <Camera className="w-4 h-4" />
              <span className="text-sm">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            </label>
          </div>
        </section>

        <section className="glass-card p-4">
          <h2 className="font-semibold mb-3">Basics</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Username *</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Age</label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Height</label>
              <Input value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">City *</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-sm text-muted-foreground">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
        </section>

        <section className="glass-card p-4">
          <h2 className="font-semibold mb-3">Sports</h2>

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
              <SportGrid selected={secondarySports} onChange={setSecondarySports} maxSelection={6} />
            </div>
          </div>
        </section>

        <Button onClick={handleSave} disabled={!canSave || saving} className="w-full gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </main>
    </div>
  );
}
