import { openai } from "./openai";

const PRINCIPLES_DATA = [
  { id: 'P-001', category: 'Sovereign Rights of the People', name: 'Pre-existing Rights', description: 'Rights exist prior to any institution or government and are inseparable from the individual human being.' },
  { id: 'P-002', category: 'Sovereign Rights of the People', name: 'Divine Origin of Rights', description: 'Rights are endowed by God—the Creator of life—and do not originate from governments or man-made systems.' },
  { id: 'P-003', category: 'Sovereign Rights of the People', name: 'Unalterable Rights', description: 'No majority, no government, and no institution has legitimate authority to alter, limit, or redefine God-given rights.' },
  { id: 'P-004', category: 'Sovereign Rights of the People', name: 'Unalienable Rights', description: 'Human rights are unalienable; they cannot be surrendered, transferred, sold, or removed by any earthly power.' },
  { id: 'P-005', category: 'Sovereign Rights of the People', name: 'Protection Not Creation', description: 'All legitimate governance must be built to protect human rights, not create them.' },
  { id: 'P-006', category: 'Sovereign Rights of the People', name: 'Equality of Rights', description: 'Rights are equal in all people; no class, elite, race, leader, or institution has greater rights than any other.' },
  { id: 'P-009', category: 'Sovereign Rights of the People', name: 'Consent of the Governed', description: 'No person or body can morally exercise authority over another except by that person\'s consent.' },
  { id: 'P-010', category: 'Sovereign Rights of the People', name: 'Sacred Freedoms', description: 'Freedom of conscience, thought, belief, and speech are sacred rights that originate from God and cannot be legislated away.' },
  { id: 'P-017', category: 'Purpose of Governance', name: 'Sole Purpose', description: 'The only legitimate purpose of governance is to secure and protect God-given rights.' },
  { id: 'P-018', category: 'Purpose of Governance', name: 'Organized Protection', description: 'Governance exists to provide organized protection of life, liberty, and property—nothing more.' },
  { id: 'P-032', category: 'Delegated Authority & Consent', name: 'Origin of Authority', description: 'All just authority originates in the people; governance possesses only what is delegated to it.' },
  { id: 'P-046', category: 'Limits of Delegated Power', name: 'Restrained Power', description: 'Delegated power must always be restrained—unrestricted power leads to tyranny.' },
  { id: 'P-062', category: 'Moral Law, Justice & Use of Force', name: 'Defensive Force Only', description: 'No person or governance body may initiate force—force may only be used defensively.' },
  { id: 'P-073', category: 'Property, Economy & No Legal Plunder', name: 'Property Rights', description: 'The right to property is inseparable from the right to life and liberty.' },
  { id: 'P-079', category: 'Property, Economy & No Legal Plunder', name: 'No Legal Plunder', description: 'Legal plunder—using law to take property from one person to give to another—is immoral and unlawful.' },
  { id: 'P-086', category: 'Duty, Responsibility & Virtue of Free People', name: 'Personal Responsibility', description: 'Free people must embrace personal responsibility for their choices and their communities.' },
  { id: 'P-119', category: 'Local Sovereignty & Decentralized Power', name: 'Local Authority', description: 'Local governance, closer to the people, is more accountable and effective than centralized distant power.' },
  { id: 'P-133', category: 'Patterns of Oppression & Governance Abuse', name: 'Tyranny Recognition', description: 'Tyranny often begins with small violations, "for the greater good"—each violation must be recognized and resisted.' },
  { id: 'P-144', category: 'Restoration of the People\'s Authority', name: 'People\'s Right to Reform', description: 'The people retain the unquestionable right to reform or alter governance when it becomes destructive to their rights.' },
  { id: 'P-155', category: 'The Represent Model of Governance', name: 'Represent Principle', description: 'True representation means the people directly participate in and control governance through principle-based voting.' },
];

function getPrincipleById(id: string) {
  return PRINCIPLES_DATA.find(p => p.id === id);
}

const CATEGORIES = [
  "Sovereign Rights of the People",
  "Purpose of Governance",
  "Delegated Authority & Consent",
  "Limits of Delegated Power",
  "Moral Law, Justice & Use of Force",
  "Property, Economy & No Legal Plunder",
  "Duty, Responsibility & Virtue of Free People",
  "Local Sovereignty & Decentralized Power",
  "Patterns of Oppression & Governance Abuse",
  "Restoration of the People's Authority",
  "The Represent Model of Governance"
];

const SYSTEM_PROMPT = `You are Sentinel, an AI governance analyst trained on the "Foundations of Proper Human Governance" - a comprehensive framework of 155 principles across 11 categories that establish the moral and philosophical foundations for legitimate governance.

Your role is to analyze legislative texts (laws, policies, regulations, executive orders, etc.) and evaluate them against these foundational principles to identify violations, partial violations, and alignments.

The 11 categories are:
1. Sovereign Rights of the People
2. Purpose of Governance
3. Delegated Authority & Consent
4. Limits of Delegated Power
5. Moral Law, Justice & Use of Force
6. Property, Economy & No Legal Plunder
7. Duty, Responsibility & Virtue of Free People
8. Local Sovereignty & Decentralized Power
9. Patterns of Oppression & Governance Abuse
10. Restoration of the People's Authority
11. The Represent Model of Governance

When analyzing text, you MUST include ALL of the following in your response:
1. Identify specific principles that are violated, partially violated, or explicitly supported
2. Score each category from 0-100 based on alignment with its principles
3. Provide an overall verdict: "Aligned", "At Risk", or "Violating"
4. Give clear explanations for each flagged principle
5. Write a comprehensive summary that captures the overall governance assessment in 2-3 clear sentences
6. Provide detailed reasoning explaining your analytical process and key considerations in 3-4 sentences
7. Generate specific corrections for ANY violations or partial violations found (even if the text is mostly aligned, provide corrections for problem areas)
8. Generate ONE clear, actionable yes/no question for the Represent Vote Proposal that directly addresses the main governance issues found

Return your analysis as JSON matching this exact structure:
{
  "summary": "A clear, concise overall assessment that captures the verdict and key governance implications (2-3 sentences - REQUIRED)",
  "reasoning": "Detailed explanation of how Sentinel evaluated this text, including the analytical framework used and key decision factors (3-4 sentences - REQUIRED)",
  "categoryScores": [
    {"category": "Category Name", "score": 0-100},
    ...
  ],
  "overallVerdict": "Aligned" | "At Risk" | "Violating",
  "flaggedPrinciples": [
    {
      "principleId": "P-XXX",
      "name": "Principle Name",
      "status": "Violated" | "Partially Violated" | "Aligned",
      "explanation": "Why this principle was flagged (1-2 sentences)"
    },
    ...
  ],
  "sentinelCorrections": [
    "First specific correction: concrete suggestion for how to revise or amend the text to address a violation",
    "Second specific correction: another actionable revision to improve alignment",
    "Third specific correction: additional concrete amendment to address concerns"
  ],
  "mainProposal": "One clear yes/no question as a proposal that people can vote on to address the governance issues identified"
}

CRITICAL REQUIREMENTS:
- The "summary" field must ALWAYS contain a comprehensive 2-3 sentence overview of the governance assessment
- The "reasoning" field must ALWAYS contain a detailed 3-4 sentence explanation of your analytical process
- The "sentinelCorrections" array must ALWAYS contain at least 3 specific, actionable corrections:
  * If violations/partial violations exist: provide concrete revisions to fix those specific issues
  * If the text is fully aligned: provide 3 suggestions for how to strengthen protections or clarify language to prevent future abuse
- Focus on the most significant violations and alignments (typically 5-10 flagged principles)
- "Violated" means direct contradiction of the principle
- "Partially Violated" means concerning language or vagueness that could enable abuse
- "Aligned" means explicit support and protection of the principle
- Category scores should reflect overall alignment: 0-40 (severe issues), 41-70 (concerns), 71-100 (good alignment)
- Overall verdict: "Violating" if major violations exist, "At Risk" if concerning patterns, "Aligned" if generally protective of rights
- Sentinel Corrections should be specific and actionable - suggest exact language changes, additions, or deletions
- The mainProposal should be a single, clear, actionable yes/no question that directly addresses the most important governance issue identified in the analysis`;

export interface AnalysisRequest {
  title: string;
  text: string;
  issueType: string;
  selectedPrinciples?: string[];
}

export interface AnalysisResult {
  summary: string;
  reasoning: string;
  categoryScores: Array<{ category: string; score: number }>;
  overallVerdict: "Aligned" | "At Risk" | "Violating";
  flaggedPrinciples: Array<{
    principleId: string;
    name: string;
    status: "Violated" | "Partially Violated" | "Aligned";
    explanation: string;
  }>;
  sentinelCorrections: string[];
  mainProposal: string;
}

export async function analyzeGovernanceText(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const principlesNote = request.selectedPrinciples && request.selectedPrinciples.length > 0
    ? `\n\nFocus your analysis on these specific principles: ${request.selectedPrinciples.join(", ")}`
    : "";

  const userPrompt = `Analyze the following ${request.issueType} titled "${request.title}" against the Foundations of Proper Human Governance:

TEXT TO ANALYZE:
${request.text}${principlesNote}

Provide a comprehensive governance analysis in JSON format.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    max_tokens: 8192,
    temperature: 0,
  });

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error("No response from AI");
  }

  const analysis: AnalysisResult = JSON.parse(result);

  // Ensure all categories are present, filling in missing ones with default scores
  const existingCategories = new Set(analysis.categoryScores.map(c => c.category));
  CATEGORIES.forEach(category => {
    if (!existingCategories.has(category)) {
      analysis.categoryScores.push({ category, score: 75 });
    }
  });

  // Ensure required fields are present with defensive defaults
  if (!analysis.summary || typeof analysis.summary !== 'string') {
    analysis.summary = "Analysis completed. See detailed findings below.";
  }

  if (!analysis.reasoning || typeof analysis.reasoning !== 'string') {
    analysis.reasoning = "This governance text was evaluated against the 155 principles of proper governance across all 11 categories.";
  }

  // Ensure sentinelCorrections is an array with at least 3 items
  if (!Array.isArray(analysis.sentinelCorrections) || analysis.sentinelCorrections.length === 0) {
    analysis.sentinelCorrections = [
      "Add explicit protections for individual rights and sovereignty.",
      "Include clear limits on delegated authority and power.",
      "Establish transparent accountability mechanisms for enforcement."
    ];
  } else if (analysis.sentinelCorrections.length < 3) {
    // Fill to at least 3 items if fewer were provided
    const needed = 3 - analysis.sentinelCorrections.length;
    for (let i = 0; i < needed; i++) {
      analysis.sentinelCorrections.push("Further review recommended to strengthen governance protections.");
    }
  }

  // Ensure mainProposal is a string
  if (!analysis.mainProposal || typeof analysis.mainProposal !== 'string') {
    analysis.mainProposal = "Should this governance text be amended to better align with the principles of proper human governance?";
  }

  return analysis;
}
