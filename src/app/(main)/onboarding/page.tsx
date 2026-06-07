"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";

// Generate DiceBear avatar URL for niches
function getNicheAvatarUrl(seed: string, size: number = 64) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Generate user avatar
function getUserAvatarUrl(seed: string, size: number = 128) {
  return `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}

interface NicheOption {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string | null;
  avatarColor: string;
  avatarInitials: string;
}

const CAREER_STAGES = [
  { id: "undergraduate", label: "Undergrad", emoji: "📚" },
  { id: "masters", label: "Master's", emoji: "🎓" },
  { id: "phd", label: "PhD", emoji: "🔬" },
  { id: "postdoc", label: "Postdoc", emoji: "🧪" },
  { id: "faculty", label: "Faculty", emoji: "👨‍🏫" },
  { id: "industry", label: "Industry", emoji: "💼" },
  { id: "independent", label: "Independent", emoji: "🌟" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, appUser, syncUser } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [niches, setNiches] = useState<NicheOption[]>([]);
  const [loadingNiches, setLoadingNiches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [institution, setInstitution] = useState("");
  const [bio, setBio] = useState("");
  const [careerStage, setCareerStage] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  // Redirect if already onboarded
  useEffect(() => {
    if (appUser?.onboardingCompleted) {
      router.replace("/");
    }
  }, [appUser, router]);

  // Initialize from existing data
  useEffect(() => {
    if (appUser) {
      setName(appUser.name || "");
      setUsername(appUser.username || "");
      setInstitution(appUser.institution || "");
      setBio(appUser.bio || "");
    } else if (user) {
      setName(user.displayName || "");
      setUsername(user.primaryEmail?.split("@")[0]?.replace(/[^a-z0-9_]/g, "") || "");
    }
  }, [appUser, user]);

  // Fetch available niches
  useEffect(() => {
    async function fetchNiches() {
      try {
        setLoadingNiches(true);
        setError(null);
        const res = await fetch("/api/niches");
        if (res.ok) {
          const data = await res.json();
          setNiches(data.niches || []);
        } else {
          setError("Failed to load topics");
        }
      } catch (err) {
        console.error("Failed to fetch niches:", err);
        setError("Failed to load topics");
      } finally {
        setLoadingNiches(false);
      }
    }
    fetchNiches();
  }, []);

  const toggleNiche = (nicheId: string) => {
    setSelectedNiches((prev) =>
      prev.includes(nicheId)
        ? prev.filter((id) => id !== nicheId)
        : [...prev, nicheId]
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name,
          username,
          institution,
          bio,
          careerStage,
          selectedNiches,
        }),
      });

      if (res.ok) {
        await syncUser();
        router.push("/");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to complete setup");
      }
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && username.trim().length >= 3;
      case 2:
        return careerStage !== "";
      case 3:
        return selectedNiches.length >= 1;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
          <span 
            className="text-xl"
            style={{ fontFamily: "'Billabong', cursive" }}
          >
            Feeds
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-500 ${
                  s === step
                    ? "w-8 bg-foreground"
                    : s < step
                    ? "w-1 bg-foreground"
                    : "w-1 bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-16 pb-20 px-4 min-h-screen flex items-center">
        <div className="w-full max-w-lg mx-auto">
          
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Avatar preview */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Avatar className="h-20 w-20 ring-4 ring-background shadow-xl">
                    <AvatarImage src={getUserAvatarUrl(username || name || "user", 192)} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white">
                      {name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-foreground rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-background" />
                  </div>
                </div>
              </div>

              <div className="text-center mb-5">
                <h1 className="text-lg font-semibold">Set up your profile</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  How should we know you?
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    id="name"
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-foreground/30 transition-all text-sm"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-foreground/30 transition-all text-sm"
                  />
                </div>

                <div>
                  <input
                    id="institution"
                    type="text"
                    placeholder="Institution (optional)"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-foreground/30 transition-all text-[15px]"
                  />
                </div>

                <div>
                  <textarea
                    id="bio"
                    placeholder="Short bio (optional)"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-foreground/30 transition-all resize-none text-[15px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Career Stage */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-8">
                <div className="text-4xl mb-4">🎯</div>
                <h1 className="text-xl font-semibold">What's your role?</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll personalize your feed
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CAREER_STAGES.map((stage) => {
                  const isSelected = careerStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setCareerStage(stage.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-foreground bg-foreground/5 scale-[1.02]"
                          : "border-border hover:border-foreground/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-2xl">{stage.emoji}</span>
                      <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                        {stage.label}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-foreground ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Select Niches */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">🔬</div>
                <h1 className="text-xl font-semibold">Pick your interests</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Follow topics to see papers in your feed
                </p>
              </div>

              {loadingNiches ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading topics...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setLoadingNiches(true);
                      setError(null);
                      fetch("/api/niches")
                        .then((res) => res.json())
                        .then((data) => setNiches(data.niches || []))
                        .catch(() => setError("Failed to load topics"))
                        .finally(() => setLoadingNiches(false));
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : niches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <p className="text-sm text-muted-foreground">No topics available yet</p>
                  <p className="text-xs text-muted-foreground">You can skip this step</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pb-2 -mx-1 px-1">
                    {niches.map((niche) => {
                      const isSelected = selectedNiches.includes(niche.id);
                      return (
                        <button
                          key={niche.id}
                          onClick={() => toggleNiche(niche.id)}
                          className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:border-foreground/30"
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={getNicheAvatarUrl(niche.slug, 64)} />
                            <AvatarFallback
                              style={{ backgroundColor: niche.avatarColor }}
                              className="text-white text-[10px] font-bold"
                            >
                              {niche.avatarInitials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[13px] font-medium truncate flex-1">
                            {niche.displayName}
                          </span>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-foreground rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-background" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {selectedNiches.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      {selectedNiches.length} topic{selectedNiches.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fixed footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/40 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="rounded-full px-8 h-11 text-[15px] font-semibold"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={(!canProceed() && niches.length > 0) || loading}
              className="rounded-full px-8 h-11 text-[15px] font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Get started"
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
