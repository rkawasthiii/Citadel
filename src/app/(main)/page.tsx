import { FeedList, Stories } from "@/components/feed";
import { RightSidebar } from "@/components/navigation/RightSidebar";
import { TopHeader } from "@/components/navigation/TopHeader";

export default function Home() {
  return (
    <>
      <TopHeader />
      <div className="flex justify-center gap-8 px-0 md:px-4">
        <div className="w-full max-w-[470px] md:w-[470px] pt-0 md:pt-4">
        <Stories />
        
        {/* Feed container with scroll fade effects */}
        <div className="relative">
          {/* Top gradient fade */}
          <div className="sticky top-0 h-8 bg-gradient-to-b from-white dark:from-black to-transparent z-10 pointer-events-none" />
          
          <FeedList />
          
          {/* Bottom gradient fade */}
          <div className="fixed bottom-0 h-24 bg-gradient-to-t from-white dark:from-black to-transparent z-10 pointer-events-none w-full max-w-[470px] md:w-[470px]" />
        </div>
      </div>
      
      <div className="hidden lg:block w-[319px] shrink-0">
        <RightSidebar />
      </div>
    </div>
    </>
  );
}
