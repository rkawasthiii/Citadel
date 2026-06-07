"use client";

import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Volume2, VolumeX, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Story {
  id: string;
  username: string;
  avatar?: string;
  timestamp: string;
  content: string;
  type: "image" | "video";
}

interface StoriesViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export function StoriesViewer({ stories, initialIndex = 0, onClose }: StoriesViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const currentStory = stories[currentIndex];

  const STORY_DURATION = 5000; // 5 seconds per story

  // Prevent body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    const increment = 100 / (STORY_DURATION / 50);

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + increment;
      });
    }, 50);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, isPaused]);

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width / 2) {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const getColorFromName = (name: string) => {
    const colors = [
      "#f97316", "#3b82f6", "#10b981", "#8b5cf6", 
      "#ec4899", "#06b6d4", "#f59e0b", "#6366f1"
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const bgColor = getColorFromName(currentStory.username);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Left Arrow Button */}
      {currentIndex > 0 && (
        <button
          onClick={goToPrevious}
          className="absolute left-8 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all hover:scale-110"
        >
          <ChevronLeft className="h-8 w-8 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* Right Arrow Button */}
      {currentIndex < stories.length - 1 && (
        <button
          onClick={goToNext}
          className="absolute right-8 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all hover:scale-110"
        >
          <ChevronRight className="h-8 w-8 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* Background overlay for other stories */}
      <div className="absolute inset-0 flex items-center justify-center gap-4 px-4">
        {stories.map((story, index) => {
          if (Math.abs(index - currentIndex) > 2) return null;
          
          const offset = (index - currentIndex) * 380;
          const scale = index === currentIndex ? 1 : 0.85;
          const opacity = index === currentIndex ? 1 : 0.3;
          const blur = index === currentIndex ? 0 : 8;

          return (
            <div
              key={story.id}
              className="absolute transition-all duration-300 ease-out"
              style={{
                transform: `translateX(${offset}px) scale(${scale})`,
                opacity,
                filter: `blur(${blur}px)`,
                pointerEvents: index === currentIndex ? "auto" : "none",
              }}
            >
              <div className="w-[360px] h-[640px] bg-[#262626] rounded-2xl overflow-hidden relative">
                {/* Story content placeholder */}
                <div className="w-full h-full flex items-center justify-center text-white text-lg">
                  Story {index + 1}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active story */}
      <div className="relative z-10 w-[360px] h-[640px] bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{
                  width: index < currentIndex ? "100%" : index === currentIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-4 px-4 pb-8 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 ring-2 ring-white">
                <AvatarImage src={currentStory.avatar} />
                <AvatarFallback 
                  style={{ backgroundColor: bgColor }}
                  className="text-white text-xs font-semibold"
                >
                  {getInitials(currentStory.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-semibold">
                  {currentStory.username}
                </span>
                <span className="text-white/70 text-xs">
                  {currentStory.timestamp}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="text-white hover:scale-110 transition-transform"
              >
                {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-white hover:scale-110 transition-transform"
              >
                {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <button className="text-white hover:scale-110 transition-transform">
                <MoreHorizontal className="h-6 w-6" />
              </button>
              <button
                onClick={onClose}
                className="text-white hover:scale-110 transition-transform"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Story content */}
        <div 
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={handleAreaClick}
        >
          {currentStory.type === "image" ? (
            <img
              src={currentStory.content}
              alt="Story"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={currentStory.content}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted={isMuted}
            />
          )}
        </div>

        {/* Navigation areas (invisible) */}
        <div className="absolute inset-0 flex">
          <div className="w-1/2 h-full" onClick={goToPrevious} />
          <div className="w-1/2 h-full" onClick={goToNext} />
        </div>
      </div>
    </div>
  );
}
