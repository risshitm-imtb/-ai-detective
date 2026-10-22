# Challenge content guide

Do not publish a question until its answer is defensible, source material may be used, and its provenance/verification are recorded. The repository intentionally contains no sample answer keys or demo scores.

## Public challenge JSON

The organizer form accepts JSON shaped like this (replace every placeholder with reviewed content):

```json
{
  "question_type": "multiple_choice",
  "difficulty": "medium",
  "title": "Reviewed challenge title",
  "question": "A source-based question with one defensible answer",
  "options": ["Option one", "Option two", "Insufficient evidence"],
  "evidence": "Evidence and context shown to every team",
  "sources": [
    { "title": "Primary or credible source", "url": "https://example.invalid/source" }
  ]
}
```

Allowed `question_type` values are `multiple_choice`, `classification`, `written`, and `case_report`. Allowed difficulty values are `easy`, `medium`, and `hard`. The public content must not contain `answer`, `correct`, `correct_answer`, `answer_key`, `explanation`, or `scoring` fields. These belong in the separate private key form fields.

The private answer field is JSON and is compared exactly with the submitted JSON value. For an option that is a string, store that string as the answer, for example `"Insufficient evidence"`. Scoring JSON currently takes `{ "points": 1 }`. Round totals are capped at the configured maximum.

The provenance field is a JSON object documenting original human/model material, media origin, source/license, or collection details as relevant. Verification notes and the post-reveal explanation must each be at least 20 characters. These fields are recorded for audit; the application cannot independently establish that organizer-provided provenance is true.

## Fairness guidance

- Human/AI questions need original text, author/model records, and generation metadata. Style alone is not evidence.
- Fact checks need dated, credible source references and should distinguish false from unverified or misleading claims.
- Media questions should include context and avoid relying on detector scores or visual anomalies alone.
- Written and final case reports need a published rubric and human review. Exact-match scoring is suitable only for fixed structured answers.
- Use original, synthetic, or appropriately licensed evidence. Record how synthetic media was generated and checked.
- Keep the challenge bank private until the event is ready. The publishing RPC is organizer-only and locks content after event start.
