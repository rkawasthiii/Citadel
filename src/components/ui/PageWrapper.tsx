"use client";

import { ReactNode, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

interface PageWrapperProps {
  children: ReactNode;
}

const routes = ["/", "/search", "/create", "/dm", "/profile"];

export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathnameRef = useRef<string | null>(null);
  const directionRef = useRef(0);

  const currentIndex = routes.findIndex(route => 
    pathname === route || pathname?.startsWith(route + "/")
  );

  // Calculate direction based on route changes
  useEffect(() => {
    if (prevPathnameRef.current && prevPathnameRef.current !== pathname) {
      const prevIndex = routes.findIndex(route => 
        prevPathnameRef.current === route || prevPathnameRef.current?.startsWith(route + "/")
      );
      
      if (prevIndex !== -1 && currentIndex !== -1) {
        directionRef.current = currentIndex > prevIndex ? 1 : -1;
      }
    }
    prevPathnameRef.current = pathname;
  }, [pathname, currentIndex]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 75;
    const { offset, velocity } = info;

    // Swipe right (going back/left in navigation)
    if ((offset.x > threshold && velocity.x > 0) || velocity.x > 800) {
      if (currentIndex > 0) {
        directionRef.current = -1;
        router.push(routes[currentIndex - 1]);
      }
    }
    // Swipe left (going forward/right in navigation)
    else if ((offset.x < -threshold && velocity.x < 0) || velocity.x < -800) {
      if (currentIndex < routes.length - 1) {
        directionRef.current = 1;
        router.push(routes[currentIndex + 1]);
      }
    }
  };

  const direction = directionRef.current;
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : direction < 0 ? "-100%" : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : direction < 0 ? "100%" : 0,
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: "tween", ease: "easeInOut", duration: 0.3 },
          opacity: { duration: 0.2 },
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
