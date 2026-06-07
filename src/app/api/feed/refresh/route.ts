import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Trigger the Inngest function to refresh user's feed
    await inngest.send({
      name: "feed/refresh",
      data: { userId },
    });

    return NextResponse.json({
      success: true,
      message: "Feed refresh triggered",
    });
  } catch (error) {
    console.error("Failed to trigger feed refresh:", error);
    return NextResponse.json(
      { error: "Failed to trigger feed refresh" },
      { status: 500 }
    );
  }
}
