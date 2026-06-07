"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface TopHeaderProps {
  title?: string;
}

export function TopHeader({ title = "Feeds" }: TopHeaderProps) {
  return (
    <header 
      className="md:hidden bg-white dark:bg-black pt-4"
    >
      <div className="max-w-[470px] mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center justify-items-start">
            <h1 
              className="text-4xl font-normal tracking-wide text-[#262626] dark:text-[#f5f5f5]"
              style={{ fontFamily: "'Billabong', cursive" }}
            >
              {title}
            </h1>
          </Link>
          
          {/* Powered by Veritus branding */}
          <a
            href="https://veritus.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-end hover:opacity-80 transition-opacity"
          >
            <span className="text-[8px] text-gray-400 tracking-wide">Powered by</span>
            <div className="flex items-center gap-0.5">
              <Image
                src="/veritus-logo.png"
                alt="Veritus Logo"
                width={14}
                height={14}
              />
              <span className="text-[11px] font-semibold tracking-widest text-[#0A1970]">ERITUS</span>
            </div>
          </a>
        </div>
      </div>
    </header>
  );
}
