import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Heart, HeartHandshake, ShieldCheck, Smile, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brand } from './components';
import { useCareStore } from './store';
import { api, getCurrentParentProfile, getAuthToken } from '@/lib/api';

export function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const parent = getCurrentParentProfile();
    const token = getAuthToken();
    if (parent) {
      navigate({ to: '/parent/home', replace: true });
    } else if (token) {
      navigate({ to: '/dashboard', replace: true });
    }
  }, [navigate]);
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <Brand />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-xs">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-8 md:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-primary dark:bg-blue-950/60 dark:text-blue-300">
              <HeartHandshake className="size-3.5" /> Care that feels closer
            </span>
            <h1 className="mt-6 max-w-2xl font-display text-5xl leading-[1.06] tracking-[-.04em] text-slate-900 dark:text-slate-50 md:text-7xl">
              A little more <em className="text-primary not-italic">together</em>, every day.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              CareCircle makes the everyday care of an aging parent feel clear, shared, and human — for the whole family.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 rounded-xl px-6 text-base font-bold shadow-lg shadow-blue-500/15">
                <Link to="/register">
                  Start family circle <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-13 rounded-xl border-border bg-card px-6 text-base font-semibold text-foreground hover:bg-muted">
                <Link to="/parent/scan">
                  <UserRound className="size-4 mr-1 text-primary" /> Parent connection
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center sm:text-left">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-primary hover:underline">
                Sign in here
              </Link>
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-border/70 pt-8 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-green-600" /> Private & family-first
              </div>
              <div className="flex items-center gap-2">
                <Smile className="size-4 text-primary" /> Gentle for older adults
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" /> Multi-caregiver sync
              </div>
            </div>
          </div>

          <div className="relative animate-rise">
            <div className="absolute -left-6 -top-6 size-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-900/20" />
            <div className="relative rounded-[2rem] border border-border bg-card p-6 shadow-2xl shadow-slate-200/60 dark:shadow-none sm:p-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Live Routine</p>
                  <h3 className="mt-1 font-display text-2xl text-foreground">Margaret's Day</h3>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  92% on track
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3.5 rounded-xl border border-border bg-muted/40 p-3.5">
                  <span className="grid size-8 place-items-center rounded-full bg-green-500 text-white">
                    <Check className="size-4 stroke-[3]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-muted-foreground line-through">Blood pressure medicine</p>
                    <p className="text-xs text-muted-foreground">Completed at 8:30 AM</p>
                  </div>
                  <span className="text-xs font-bold text-green-600">Done</span>
                </div>

                <div className="flex items-center gap-3.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-white">
                    <Clock3 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">Hydration & afternoon stretch</p>
                    <p className="text-xs text-primary font-medium">Scheduled · 2:00 PM</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Next up</span>
                </div>

                <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5">
                  <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Clock3 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Evening dinner & check-in</p>
                    <p className="text-xs text-muted-foreground">Scheduled · 7:30 PM</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Upcoming</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-blue-50/80 p-4 dark:bg-blue-950/30">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
                  <Heart className="size-3.5 fill-primary text-primary" />
                  Shared with Alex (Son) & Dr. Sharma
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthPage({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (register && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (register) {
        await api.auth.register({
          email: email.trim(),
          password,
          full_name: name.trim() || 'Family Admin',
        });
      } else {
        await api.auth.login({
          email: email.trim(),
          password,
        });
      }
      useCareStore.getState().reset();
      await useCareStore.getState().init();
      navigate({ to: '/dashboard' });
    } catch (err: any) {
      setError(err?.message || (register ? 'Could not create account.' : 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f7f9fc] dark:bg-background">
      <header className="mx-auto max-w-6xl px-6 py-6">
        <Brand />
      </header>

      <main className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-8 md:grid-cols-2 md:py-20">
        <div className="hidden md:block">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-primary dark:bg-blue-950/60 dark:text-blue-300">
            A kinder way to coordinate
          </span>
          <h1 className="mt-5 max-w-md font-display text-4xl lg:text-5xl leading-tight text-foreground">
            The family routine, in one calm place.
          </h1>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">
            See what is done, what needs attention, and how to help next — without overwhelming anyone.
          </p>

          <div className="mt-10 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <ShieldCheck className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Private by design. Simple by nature.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-xl shadow-slate-200/50 dark:shadow-none md:p-9">
          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back home
          </Link>

          <h2 className="font-display text-3xl text-foreground">
            {register ? 'Create your family space' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {register
              ? 'You can invite the rest of your circle in a minute.'
              : 'Your family routine is waiting for you.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {register && (
              <div>
                <Label htmlFor="name" className="text-sm font-semibold">Your full name</Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g. Alex Ellis"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-2 h-12 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-2 h-12 rounded-xl"
              />
            </div>

            {register && (
              <div>
                <Label htmlFor="confirm" className="text-sm font-semibold">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  minLength={6}
                  required
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
            )}

            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="mt-3 h-12 w-full rounded-xl text-base font-bold shadow-md shadow-blue-500/10"
            >
              {loading ? 'Please wait...' : (register ? 'Create family space' : 'Sign in')}
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {register ? 'Already have an account? ' : 'New to CareCircle? '}
            <Link
              to={register ? '/login' : '/register'}
              className="font-bold text-primary hover:underline"
            >
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>

          <p className="mt-5 rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">
            Demo account: aditya@example.com / password123
          </p>
        </div>
      </main>
    </div>
  );
}
