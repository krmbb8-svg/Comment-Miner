import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // youtube.com/watch?v=ID
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname === "/watch"
    ) {
      return parsed.searchParams.get("v");
    }

    // youtu.be/ID
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    // youtube.com/shorts/ID
    if (
      (parsed.hostname === "www.youtube.com" ||
        parsed.hostname === "youtube.com") &&
      parsed.pathname.startsWith("/shorts/")
    ) {
      return parsed.pathname.split("/")[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchComments(videoId: string): Promise<string[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured.");
  }

  const params = new URLSearchParams({
    part: "snippet",
    videoId,
    maxResults: "100",
    order: "relevance",
    textFormat: "plainText",
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?${params}`
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason =
      body?.error?.errors?.[0]?.reason || body?.error?.message || res.statusText;

    if (res.status === 403 && reason === "commentsDisabled") {
      throw new Error("Comments are disabled on this video.");
    }
    if (res.status === 404) {
      throw new Error("Video not found. Please check the URL.");
    }
    console.error("YouTube API error response:", JSON.stringify(body, null, 2));
    throw new Error(`YouTube API error (${res.status}): ${reason}`);
  }

  interface CommentThread {
    snippet: {
      topLevelComment: {
        snippet: {
          textDisplay: string;
        };
      };
    };
  }

  const data = await res.json();
  const comments: string[] = (data.items || []).map(
    (item: CommentThread) => item.snippet.topLevelComment.snippet.textDisplay
  );

  if (comments.length === 0) {
    throw new Error("No comments found on this video.");
  }

  return comments;
}

async function analyzeComments(comments: string[]) {
  const joined = comments
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are analyzing YouTube video comments to help a content creator find new content ideas.

Here are the comments:

${joined}

Analyze these comments and return a JSON object with exactly this structure (no other text, just valid JSON):

{
  "contentIdeas": ["idea 1", "idea 2", ...],
  "topQuestions": ["question 1", "question 2", ...],
  "recurringThemes": ["theme 1", "theme 2", ...],
  "sentiment": "overall sentiment summary in 1-2 sentences",
  "sentimentScore": 75,
  "sentimentBreakdown": { "positive": 60, "neutral": 25, "negative": 15 },
  "themeCounts": [{ "theme": "theme name", "count": 12 }, ...],
  "engagementSignals": { "questionsCount": 8, "suggestionsCount": 5, "complaintsCount": 3 }
}

Guidelines:
- contentIdeas: 3-7 specific video/content ideas suggested or implied by commenters
- topQuestions: 3-7 questions viewers are asking in the comments
- recurringThemes: 3-7 recurring topics, complaints, or praise themes
- sentiment: a concise 1-2 sentence summary of the overall comment sentiment
- sentimentScore: 0-100 integer representing overall positivity (0=very negative, 100=very positive)
- sentimentBreakdown: percentage of comments that are positive, neutral, and negative (must sum to 100)
- themeCounts: each recurring theme with an estimated count of comments mentioning it, sorted descending
- engagementSignals: count of comments that contain questions, suggestions, or complaints

Return ONLY valid JSON. No markdown, no code fences, no explanation.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return Response.json(
        { error: "Please provide a YouTube URL." },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return Response.json(
        { error: "Invalid YouTube URL. Please paste a valid video link." },
        { status: 400 }
      );
    }

    const comments = await fetchComments(videoId);
    const analysis = await analyzeComments(comments);

    // Inject server-side data and ensure fallback defaults
    analysis.commentCount = comments.length;
    analysis.sentimentScore = analysis.sentimentScore ?? 50;
    analysis.sentimentBreakdown = analysis.sentimentBreakdown ?? { positive: 33, neutral: 34, negative: 33 };
    analysis.themeCounts = analysis.themeCounts ?? [];
    analysis.engagementSignals = analysis.engagementSignals ?? { questionsCount: 0, suggestionsCount: 0, complaintsCount: 0 };

    return Response.json(analysis);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return Response.json({ error: message }, { status: 500 });
  }
}
