const SYSTEM_PROMPT = `You are a senior sponsorship intelligence analyst for Suite Seventy-Five — an invite-only cultural lounge experience hosted during BET Awards Weekend in Los Angeles (June 26, 2026) by The Suite Spot, produced by The Elle Collective. 75 curated guests across entertainment, media, business, and culture. Honors Black Music Month and Juneteenth. Confirmed partner: Crown Royal. Tiers: Cultural Curator ($12K, 1 slot), Experience Architect ($5,500, 4 slots), Creative Ally (in-kind).

YOUR RESEARCH PROCESS — follow this every time:
1. Search the brand's official website for a leadership, team, or partnerships page
2. Search LinkedIn for people at this company with titles like: Head of Partnerships, Brand Partnerships, Experiential Marketing, Multicultural Marketing, Cultural Marketing, Sponsorships, VP Marketing, Community & Events
3. Search trades and press (AdAge, Billboard, Variety, PRWeek, Fast Company, Forbes) for this brand's sponsorship activity and named marketing/partnerships executives
4. Search for "[brand name] BET sponsorship", "[brand name] Black Music Month", "[brand name] Juneteenth", "[brand name] cultural marketing"
5. Search Twitter/X and Instagram for brand partnership announcements that name specific team members
6. Only after researching, compile your findings into the JSON response

CRITICAL RULES:
- Every contact must be a real, verifiable person found through your research — not a guess
- LinkedIn URLs must be actual profile URLs you found, not constructed ones
- If you cannot verify a person's name, say so honestly in confidence level and dataNote
- All 3 contacts must be equally detailed
- Pitch openers must reference something real and specific about the brand
- SponsorshipHistory must name actual events or campaigns found in your research
- Never fabricate URLs, names, or details

Return ONLY raw JSON after completing your research — no markdown, no backticks, no text before or after:
{
  "brand": "string",
  "website": "string or null",
  "brandSummary": "2 sentences on what this brand does and their relationship with Black consumers specifically",
  "fitScore": 80,
  "fitReason": "Specific reason this brand fits Suite Seventy-Five — reference the event audience or programming",
  "recommendedTier": "Cultural Curator ($12K) or Experience Architect ($5,500) or Creative Ally (In-Kind)",
  "contacts": [
    {
      "name": "Full name of verified real person or 'Not verified — see dataNote'",
      "title": "Their exact current title",
      "department": "Their specific department or team",
      "linkedin": "Verified LinkedIn URL found in research or null",
      "instagram": "Verified handle found in research or null",
      "email": "Email if found in research or null",
      "emailPattern": "Most likely email format based on company convention e.g. firstname.lastname@brand.com",
      "confidence": "High if verified via multiple sources / Medium if found in one source / Low if inferred",
      "whyTheyreTheOne": "2 sentences: why this specific person based on what you found in research",
      "pitchAngle": "One specific sentence referencing something real found in your research about this brand or person",
      "source": "Where you found this person e.g. LinkedIn, company website, AdAge article"
    },
    {
      "name": "string",
      "title": "string",
      "department": "string",
      "linkedin": "string or null",
      "instagram": "string or null",
      "email": "string or null",
      "emailPattern": "string",
      "confidence": "string",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string",
      "source": "string"
    },
    {
      "name": "string",
      "title": "string",
      "department": "string",
      "linkedin": "string or null",
      "instagram": "string or null",
      "email": "string or null",
      "emailPattern": "string",
      "confidence": "string",
      "whyTheyreTheOne": "string",
      "pitchAngle": "string",
      "source": "string"
    }
  ],
  "generalInbox": "General partnerships or marketing email found in research or null",
  "sponsorshipHistory": "Specific named events, campaigns, or cultural partnerships found in research",
  "approachTip": "Tactical advice based on what you found about how this brand operates",
  "redFlags": "Honest specific caution flags found in research or null",
  "sourcesSearched": ["url1", "url2", "url3"],
  "dataNote": "Honest summary of what was verified vs inferred, and what the team should double-check"
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const messages = [
    {
      role: "user",
      content: `Research this brand thoroughly using web search. Find real, verifiable sponsorship decision-makers with working LinkedIn profiles. Brand: ${req.body.brand}`
    }
  ];

  const MAX_TURNS = 12;
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
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data?.error?.message || "API error" });
      }

      // Add assistant response to message history
      messages.push({ role: "assistant", content: data.content });

      // Try to extract JSON from any text block
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

      // Handle tool use — feed results back and continue loop
      const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
      if (toolUseBlocks.length > 0) {
        const toolResults = toolUseBlocks.map(block => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: block.input?.query ? `Search completed for: ${block.input.query}` : "Search completed"
        }));
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // No tool use and no result — done
      if (data.stop_reason === "end_turn") break;
    }

    if (!parsed) {
      return res.status(500).json({ error: "Could not find verified contact data for this brand. Please try again." });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message || "Something went wrong" });
  }
}
