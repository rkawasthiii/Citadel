"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BookMarked, 
  Heart, 
  Loader2,
  X,
  Building2,
  FileText,
  ChevronRight,
  LogOut
} from "lucide-react";
import Link from "next/link";

interface UserStats {
  papersLiked: number;
  papersBookmarked: number;
  comments: number;
  nichesFollowing: number;
}

interface LikedPaper {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  niche: {
    slug: string;
    displayName: string;
  } | null;
  likedAt: string;
}

interface FollowedNiche {
  id: string;
  slug: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
}

// Get initials from name
function getInitials(name?: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return "U";
}

// Generate avatar URL
function getAvatarUrl(seed: string, size: number = 128) {
  return `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}

// Generate niche avatar URL
function getNicheAvatarUrl(seed: string, size: number = 64) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export default function ProfilePage() {
  const { user, appUser, syncUser } = useUser();
  const [activeTab, setActiveTab] = useState<"liked" | "saved">("liked");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [likedPapers, setLikedPapers] = useState<LikedPaper[]>([]);
  const [savedPapers, setSavedPapers] = useState<LikedPaper[]>([]);
  const [followedNiches, setFollowedNiches] = useState<FollowedNiche[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = appUser?.name || user?.displayName || "User";
  const username = appUser?.username || user?.primaryEmail?.split("@")[0] || "user";
  const avatarUrl = appUser?.avatar || user?.profileImageUrl || null;
  const initials = getInitials(displayName);
  const bio = appUser?.bio || null;
  const institution = appUser?.institution || null;

  useEffect(() => {
    async function fetchProfileData() {
      if (!user?.id) return;
      
      try {
        const res = await fetch(`/api/profile?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setLikedPapers(data.likedPapers || []);
          setSavedPapers(data.savedPapers || []);
          setFollowedNiches(data.followedNiches || []);
        }
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfileData();
  }, [user?.id]);

  // Initialize edit form
  useEffect(() => {
    if (showEditModal && appUser) {
      setEditName(appUser.name || "");
      setEditUsername(appUser.username || "");
      setEditBio(appUser.bio || "");
      setEditInstitution(appUser.institution || "");
    }
  }, [showEditModal, appUser]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showEditModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // Prevent layout shift
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [showEditModal]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: editName,
          username: editUsername,
          bio: editBio,
          institution: editInstitution,
        }),
      });

      if (res.ok) {
        await syncUser();
        setShowEditModal(false);
      } else {
        // Try to parse error, but handle if response is empty
        try {
          const errorData = await res.json();
          alert(errorData.error || "Failed to save profile");
        } catch {
          alert("Failed to save profile");
        }
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const currentPapers = activeTab === "liked" ? likedPapers : savedPapers;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">
      {/* Profile Card */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="bg-linear-to-br from-muted/50 to-muted/20 rounded-3xl p-4 mb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className="h-16 w-16 ring-4 ring-background shadow-xl shrink-0">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : (
                <AvatarImage src={getAvatarUrl(username, 160)} alt={displayName} />
              )}
              <AvatarFallback className="text-xl bg-linear-to-br from-violet-500 to-pink-500 text-white font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{displayName}</h1>
              <p className="text-muted-foreground text-xs">@{username}</p>
              
              {institution && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1.5">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{institution}</span>
                </p>
              )}
              
              {bio && (
                <p className="text-xs mt-2 line-clamp-2">{bio}</p>
              )}
            </div>
          </div>

          {/* Edit button */}
          <button
            onClick={() => setShowEditModal(true)}
            className="w-full mt-4 py-2 px-4 bg-foreground text-background rounded-xl font-semibold text-xs hover:opacity-90 transition-opacity"
          >
            Edit profile
          </button>

          {/* Logout button - visible only on mobile */}
          <button
            onClick={() => window.location.href = "/handler/sign-out"}
            className="w-full mt-2 py-2 px-4 bg-muted text-foreground rounded-xl font-semibold text-xs hover:bg-muted/80 transition-opacity flex items-center justify-center gap-2 md:hidden"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>

          {/* Stats */}
          <div className="flex justify-around mt-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-lg font-bold">{stats?.papersLiked || 0}</p>
              <p className="text-[10px] text-muted-foreground">Liked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{stats?.papersBookmarked || 0}</p>
              <p className="text-[10px] text-muted-foreground">Saved</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{stats?.nichesFollowing || 0}</p>
              <p className="text-[10px] text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        {/* Following Niches */}
        {followedNiches.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">FOLLOWING</h2>
            <div className="flex gap-3 overflow-x-auto py-2 -mx-4 px-4 scrollbar-hide">
              {followedNiches.map((niche) => (
                <Link
                  key={niche.id}
                  href={`/niche/${niche.slug}`}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <Avatar className="h-12 w-12 ring-2 ring-border">
                    <AvatarImage src={getNicheAvatarUrl(niche.slug, 112)} />
                    <AvatarFallback
                      style={{ backgroundColor: niche.avatarColor }}
                      className="text-white text-xs font-bold"
                    >
                      {niche.avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground max-w-[60px] truncate text-center">
                    {niche.displayName}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border mb-3">
          <button
            onClick={() => setActiveTab("liked")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "liked"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === "liked" ? "fill-current" : ""}`} />
            Liked
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "saved"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookMarked className={`w-3.5 h-3.5 ${activeTab === "saved" ? "fill-current" : ""}`} />
            Saved
          </button>
        </div>

        {/* Papers List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentPapers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              {activeTab === "liked" ? (
                <Heart className="w-7 h-7 text-muted-foreground" />
              ) : (
                <BookMarked className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium mb-1">
              No {activeTab} papers yet
            </p>
            <p className="text-sm text-muted-foreground">
              Papers you {activeTab === "liked" ? "like" : "save"} will show up here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentPapers.map((paper) => (
              <Link
                key={paper.id}
                href={paper.niche ? `/niche/${paper.niche.slug}` : "#"}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {paper.title}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {paper.authors}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {paper.niche && (
                      <span className="text-primary font-medium">{paper.niche.displayName}</span>
                    )}
                    {paper.year && <span>• {paper.year}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-3" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-background w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 mb-0 sm:mb-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-sm">Edit profile</h2>
              <button
                onClick={handleSaveProfile}
                disabled={saving || !editName.trim() || editUsername.length < 3}
                className="text-primary font-semibold text-xs disabled:opacity-50"
              >
                {saving ? "Saving..." : "Done"}
              </button>
            </div>

            {/* Form */}
            <div className="p-4 pb-6 space-y-4 overflow-y-auto overscroll-contain max-h-[calc(90vh-56px)] sm:max-h-[calc(85vh-56px)]">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-20 w-20 ring-4 ring-muted">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={displayName} />
                    ) : (
                      <AvatarImage src={getAvatarUrl(editUsername || username, 192)} alt={displayName} />
                    )}
                    <AvatarFallback className="text-2xl bg-linear-to-br from-violet-500 to-pink-500 text-white">
                      {getInitials(editName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  placeholder="Your name"
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:border-foreground/30 outline-none transition-all text-sm"
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                    placeholder="username"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:border-foreground/30 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Institution */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Institution</label>
                <input
                  type="text"
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  placeholder="Where do you work or study?"
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:border-foreground/30 outline-none transition-all text-sm"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  placeholder="Tell us about yourself"
                  rows={3}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:border-foreground/30 outline-none transition-all text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
