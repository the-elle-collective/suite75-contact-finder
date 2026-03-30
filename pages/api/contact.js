const SYSTEM_PROMPT = `You are a sponsorship analyst for Suite Seventy-Five — an invite-only cultural lounge during BET Awards Weekend, June 26 2026, Los Angeles. 75 curated guests. Honors Black Music Month and Juneteenth. Confirmed partner: Crown Royal. Tiers: Cultural Curator ($12K), Experience Architect ($5,500), Creative Ally (in-kind).

Search the web to find 3 real, current decision-makers at the given brand who handle sponsorships, partnerships, or cultural/experiential marketing. Search their company website, LinkedIn, and press coverage. Prioritize people in: Brand Partnerships, Experiential Marketing, Multicultural Marketing, Cultural Marketing, Sponsorships.

Rules:
- Only include people you actually find via search — no guesses
- LinkedIn URLs must be ones you found, not constructed
- If you cannot verify someone, say so in confidence level
- All 3 contacts must be equally detailed
- Pitch openers must reference something real about the brand

Return ONLY raw JSON, no markdown, no backticks:
{
  "brand": "string",
  "website": "string or null",
  "brandSummary": "string",
  "fitScore": 80,
  "fitReason": "string",
  "recommendedTier": "string",
  "contacts": [
    {
      "name": "string",
      "title": "string",
      "department": "string",
      "linkedin": "verified URL or null",
      "instagram": "handle or null",
      "email": "string or null",
      "emailPattern": "string",
      "confidence": "High or Medium or Low",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string",
      "source": "where you found them"
    },
    {
      "name": "string",
      "title": "string",
      "department": "string",
      "linkedin": "verified URL or null",
      "instagram": "handle or null",
      "email": "string or null",
      "emailPattern": "string",
      "confidence": "High or Medium or Low",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string",
      "source": "string"
    },
    {
      "name": "string",
      "title": "string",
      "department": "string",
      "linkedin": "verified URL or null",
      "instagram": "handle or null",
      "email": "string or null",
      "emailPattern": "string",
      "confidence": "High or Medium or Low",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string",
      "source": "string"
    }
  ],
  "generalInbox": "string or null",
  "sponsorshipHistory": "string",
  "approachTip": "string",
  "redFlags": "string or null",
  "sourcesSearched": ["url1", "url2"],
  "dataNote": "string"
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { brand } = req.body;
  if (!brand) return res.status(400).json({ error: "Brand name required" });

  const messages = [
    {
      role: "user",
      content: `Search the web and find real, current sponsorship contacts at: ${brand}. Check their website, LinkedIn, and recent press.`
    }
  ];

  const MAX_TURNS = 6;
  let parsed = null;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Rate limit — tell frontend to wait and retry
        if (response.status === 429) {
          return res.status(429).json({ error: "Rate limit hit — please wait 30 seconds and try again." });
        }
        return res.status(response.status).json({ error: data?.error?.message || "API error" });
      }

      // Add assistant turn to history
      messages.push({ role: "assistant", content: data.content });

      // Try to extract JSON from text blocks
      const textBlocks = data.content.filter(b => b.type === "text");
      for (const block of textBlocks) {
        const text = block.text.replace(/```json|```/g, "").trim();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          try {
            const candidate = JSON.parse(text.slice(start, end + 1));
            if (candidate.brand && candidate.contacts?.length) {
              parsed = candidate;
              break;
            }
          } catch {}
        }
      }

      if (parsed) break;

      // Feed tool results back and continue
      const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
      if (toolUseBlocks.length > 0) {
        const toolResults = toolUseBlocks.map(block => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Search completed for: ${block.input?.query || "query"}`
        }));
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      if (data.stop_reason === "end_turn") break;
    }

    if (!parsed) {
      return res.status(500).json({ error: "Could not find verified contacts for this brand. Please try again." });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message || "Something went wrong" });
  }
}
