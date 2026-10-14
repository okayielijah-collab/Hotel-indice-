import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Voice search is not configured yet." },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Please record your trip description first." },
        { status: 400 },
      );
    }

    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Recording must be smaller than 20 MB." },
        { status: 413 },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", audio, audio.name || "recording.webm");
    upstreamForm.append("model", "whisper-1");

    const upstream = await fetch(
      "https://api.openai.com/v1/audio/translations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: upstreamForm,
        signal: AbortSignal.timeout(60_000),
      },
    );

    const result = (await upstream.json()) as {
      text?: string;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      console.error(
        "[voice] Transcription provider returned:",
        upstream.status,
      );

      return NextResponse.json(
        { error: "We couldn't translate that recording. Please try again." },
        { status: 502 },
      );
    }

    const text = result.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "We couldn't hear a clear trip description. Try again." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[voice] Request failed:", error);

    return NextResponse.json(
      { error: "Voice search failed. Please try again." },
      { status: 500 },
    );
  }
}
