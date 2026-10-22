import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

class NoopWebSocket {}

function getEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local file not found');
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return env;
}

export const builtInChallengePacks = [
  // =========================================================================
  // ROUND 1: HUMAN OR MACHINE? (10 Samples, Max 20 pts, 2 pts each)
  // Options: 'Human-written', 'AI-generated', 'Insufficient evidence'
  // =========================================================================
  {
    round_id: 1,
    sort_order: 0,
    content: {
      question_type: 'classification',
      difficulty: 'medium',
      title: 'Exhibit HM-101: Synthetic Biomimetics Abstract',
      question: 'Who most likely wrote this text?',
      evidence: `Recent advancements in synthetic neuro-biomimetics have prompted renewed exploration into synaptic plasticity emulation. Here, we present a poly-silicon transistor network designed to reproduce dendritic non-linearities under stochastic noise thresholds. Crucially, the system operates by systematically intertwining calcium-ion gating kinetics with deep recurrent feedback matrices. It is important to note that the implications of this methodology extend far beyond conventional architectures, offering a profound, paradigm-shifting transformation in how cognitive interfaces might interface with artificial reasoning frameworks in the foreseeable future. The efficacy of the proposed model was confirmed across numerous test environments, demonstrating consistent superiority.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Look for boilerplate transition phrases ("Crucially", "It is important to note", "paradigm-shifting transformation", "foreseeable future") combined with vague claims of superiority without concrete quantitative metrics.'
    },
    answer: { verdict: 'AI-generated', classification: 'AI-generated' },
    scoring: { points: 2 },
    explanation: 'The excerpt displays hallmarks of autoregressive LLM output: empty hyperbole ("profound, paradigm-shifting transformation", "consistent superiority"), clichéd transition formula ("It is important to note that..."), and an absence of quantitative experimental metrics.',
    provenance: { sources: ['Synthetic academic prose corpus benchmark'] },
    verification_notes: 'Stylometric analysis confirms low burstiness (<0.22) and uniform perplexity distribution characteristic of LLMs.'
  },
  {
    round_id: 1,
    sort_order: 1,
    content: {
      question_type: 'classification',
      difficulty: 'hard',
      title: 'Exhibit HM-102: Async Kernel Architecture Op-Ed',
      question: 'Who most likely wrote this text?',
      evidence: `Let's be completely candid about io_uring and the ongoing Rust-in-Linux holy war: we have repeatedly shot ourselves in the foot by pretending that zero-cost abstractions make kernel lifetime management trivial. They don't. Last Tuesday, our team spent fourteen agonizing hours debugging an ephemeral use-after-free in an eBPF socket filter because three different asynchronous callbacks made conflicting assumptions about buffer ownership. Yes, the borrow checker is brilliant in theory, but when you are interfacing with thirty-year-old DMA ring buffers that expect raw physical pointers, you inevitably end up with an unholy spaghetti of 'unsafe' blocks that nobody wants to touch before their morning coffee. The theoretical purity evangelists never mention that part in their conference slide decks.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Notice the colloquial idioms ("holy war", "shot ourselves in the foot", "unholy spaghetti"), genuine experiential frustration, and asymmetric sentence lengths.'
    },
    answer: { verdict: 'Human-written', classification: 'Human-written' },
    scoring: { points: 2 },
    explanation: 'Authentic human engineering commentary displaying genuine emotional frustration, idiomatic language, specific temporal markers ("Last Tuesday, our team spent fourteen agonizing hours"), and authentic domain idioms.',
    provenance: { sources: ['Systems programming engineering column'] },
    verification_notes: 'High burstiness (0.68) and irregular syntactic rhythm indicate human authorship.'
  },
  {
    round_id: 1,
    sort_order: 2,
    content: {
      question_type: 'classification',
      difficulty: 'hard',
      title: 'Exhibit HM-103: Corporate Logistics Press Excerpt',
      question: 'Who most likely wrote this text?',
      evidence: `OmniTrans Logistics today announced that third-quarter freight throughput increased by 4.2% year-over-year across its North American intermodal network. The company attributes this performance to disciplined capacity allocation and enhanced terminal automation routines. Management reaffirmed its full-year operating margin guidance of 11.5% to 12.0%.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Consider whether three sentences of formulaic SEC corporate press boilerplate contain sufficient stylistic signal to distinguish human PR staff from modern language models.'
    },
    answer: { verdict: 'Insufficient evidence', classification: 'Insufficient evidence' },
    scoring: { points: 2 },
    explanation: 'Standard corporate regulatory boilerplate. The sample is too short and rigid to establish reliable authorship signals. Both human PR specialists and LLMs produce indistinguishable output for formulaic earnings releases.',
    provenance: { sources: ['Corporate SEC press release repository'] },
    verification_notes: 'Sample length is under 50 words and strictly constrained by financial disclosure conventions, precluding defensible attribution.'
  },
  {
    round_id: 1,
    sort_order: 3,
    content: {
      question_type: 'classification',
      difficulty: 'medium',
      title: 'Exhibit HM-104: Linux Memory Management Bug Report',
      question: 'Who most likely wrote this text?',
      evidence: `kworker/u16:2 crashed with NULL pointer deref at virtual address 0000000000000018 in zswap_frontswap_store+0x4c/0x1e0.
I'm seeing this consistently on 6.8.4-arch1 after about 45 mins of heavy compiling under low RAM conditions.
Turns out the zpool allocation check was skipped when the tree lock was released prematurely in commit c39a1f.
Patch below fixes it for me, tested overnight with memhog - please review before Linus pulls for -rc3:

diff --git a/mm/zswap.c b/mm/zswap.c
-   if (!tree->pool) return -EINVAL;
+   spin_lock(&tree->lock);
+   if (!tree->pool) { spin_unlock(&tree->lock); return -EINVAL; }`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Examine the raw terminal crash offset, personal testing commentary ("fixes it for me, tested overnight with memhog"), and git diff.'
    },
    answer: { verdict: 'Human-written', classification: 'Human-written' },
    scoring: { points: 2 },
    explanation: 'Human developer bug report featuring realistic Linux kernel crash logs, practical testing comments ("fixes it for me, tested overnight with memhog"), and standard kernel mailing list shorthand.',
    provenance: { sources: ['LKML bug tracker excerpt'] },
    verification_notes: 'Matches genuine kernel developer patch communication conventions.'
  },
  {
    round_id: 1,
    sort_order: 4,
    content: {
      question_type: 'classification',
      difficulty: 'medium',
      title: 'Exhibit HM-105: CRISPR Gene-Editing Explainer',
      question: 'Who most likely wrote this text?',
      evidence: `CRISPR-Cas9 operates as molecular scissors for genomic DNA. The system consists of two key components: the Cas9 endonuclease enzyme, which performs the physical double-strand cut, and a guide RNA (gRNA) sequence that directs the complex to the exact target gene locus. By harnessing the cell's natural DNA repair pathways—either non-homologous end joining or homology-directed repair—researchers can precisely disable malfunctioning genes or introduce therapeutic sequences. This transformative technology holds immense promise across therapeutics, agriculture, and fundamental biological inquiry, ushering in a new era of precision medicine.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Note the standard textbook "molecular scissors" analogy, perfectly balanced parallelism ("across therapeutics, agriculture, and fundamental biological inquiry"), and predictable summary conclusion ("ushering in a new era").'
    },
    answer: { verdict: 'AI-generated', classification: 'AI-generated' },
    scoring: { points: 2 },
    explanation: 'Synthetically generated explainer featuring textbook LLM tropes: cliché metaphor ("molecular scissors"), balanced tricolon, and familiar optimistic conclusion ("ushering in a new era of precision medicine").',
    provenance: { sources: ['GPT-4 educational summary benchmark'] },
    verification_notes: 'Stylometric analyzer shows uniform sentence complexity and predictable token probabilities.'
  },
  {
    round_id: 1,
    sort_order: 5,
    content: {
      question_type: 'classification',
      difficulty: 'hard',
      title: 'Exhibit HM-106: Urban Alley Rain Vignette',
      question: 'Who most likely wrote this text?',
      evidence: `The rain did not fall so much as collapse. It slapped the rusted corrugated awning of Al's Auto Body with a sound like dropped ball-bearings, then gathered in oily gutters that smelled of sulfur and fried onion oil. A sodden cardboard cat-carrier sat half-under a rusted dumpster, its flap swinging on one soaked hinge like a loose tooth. Nobody came down Mercer Street after four except the water meter inspector, and he was sixty-five with bad knees and no desire to look behind the dumpsters.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Notice the sensory specificity ("dropped ball-bearings", "sulfur and fried onion oil"), gritty texture, and specific character insight.'
    },
    answer: { verdict: 'Human-written', classification: 'Human-written' },
    scoring: { points: 2 },
    explanation: 'Creative human prose with distinctive sensory metaphors, natural observational rhythm, and idiosyncratic storytelling details that avoid typical LLM generic pastoral imagery.',
    provenance: { sources: ['Contemporary short fiction anthology'] },
    verification_notes: 'High burstiness, unique metaphorical collocations, and natural prose variance.'
  },
  {
    round_id: 1,
    sort_order: 6,
    content: {
      question_type: 'classification',
      difficulty: 'hard',
      title: 'Exhibit HM-107: Cloud API Indemnification Clause',
      question: 'Who most likely wrote this text?',
      evidence: `Section 14.2 (Indemnification). Customer shall defend, indemnify, and hold harmless Provider and its affiliates, officers, and employees against any third-party claims, liabilities, losses, or expenses (including reasonable attorneys' fees) arising out of or relating to: (a) Customer Data; (b) Customer's use of the Services in violation of the Acceptable Use Policy; or (c) any breach of Section 8 (Representations and Warranties).`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Standard contract law relies on rigid institutional boilerplate that human lawyers copy from templates and LLMs reproduce identically.'
    },
    answer: { verdict: 'Insufficient evidence', classification: 'Insufficient evidence' },
    scoring: { points: 2 },
    explanation: 'Legal indemnification boilerplate. These provisions are strictly copied from standard institutional contract templates. A classifier cannot legitimately separate human legal drafting from LLM generation for standard legal clauses.',
    provenance: { sources: ['Standard SaaS Terms of Service template'] },
    verification_notes: 'Jurisprudential boilerplate exhibits zero personal stylistic variance.'
  },
  {
    round_id: 1,
    sort_order: 7,
    content: {
      question_type: 'classification',
      difficulty: 'medium',
      title: 'Exhibit HM-108: Wireless Earbuds Audio Review',
      question: 'Who most likely wrote this text?',
      evidence: `When it comes to elevating your personal audio journey, the SonicFlow Pro earbuds are a true game-changer. From the moment you open the sleek packaging, it is clear that meticulous attention has been paid to every single nuance. The bass response is deep yet refined, while the mids and highs weave together into a rich acoustic tapestry that breathes new life into your favorite playlists. Whether you are commuting through a bustling metropolis or delving into focused study sessions, these earbuds deliver an unmatched listening experience that seamlessly balances form and function.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Notice the relentless stream of generic praise ("audio journey", "true game-changer", "meticulous attention", "acoustic tapestry", "delving into", "seamlessly balances form and function") without a single concrete technical spec.'
    },
    answer: { verdict: 'AI-generated', classification: 'AI-generated' },
    scoring: { points: 2 },
    explanation: 'Classic commercial affiliate marketing LLM text: formulaic hype ("true game-changer", "acoustic tapestry", "delving into", "seamlessly balances form and function") with zero technical measurements, battery figures, or specific audio codec names.',
    provenance: { sources: ['Synthetically generated consumer tech review benchmark'] },
    verification_notes: 'Features high-frequency LLM marketing collocations and absent critical evaluation.'
  },
  {
    round_id: 1,
    sort_order: 8,
    content: {
      question_type: 'classification',
      difficulty: 'medium',
      title: 'Exhibit HM-109: Student Forum Problem Set Query',
      question: 'Who most likely wrote this text?',
      evidence: `Hey guys, for Q3 on the ODE set (the damped harmonic oscillator with the weird driving force e^(-2t)*cos(3t)), did anyone else get an amplitude of sqrt(13)/17 or am I losing my mind??
Wait nvm just realized I forgot the integration factor on the homogeneous part. Re-did it and got 2*sqrt(5)/13. But now my phase angle is negative which makes zero sense physically for t -> infty.
Prof. Miller said in OH that damping was undercritical so what am I doing wrong here??`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Look for the informal self-correction mid-post ("Wait nvm just realized..."), spontaneous colloquial expression, and specific university course context.'
    },
    answer: { verdict: 'Human-written', classification: 'Human-written' },
    scoring: { points: 2 },
    explanation: 'Authentic student discussion forum post with real-time thinking, spontaneous self-correction ("Wait nvm just realized..."), authentic math terminology, and informal peer syntax.',
    provenance: { sources: ['STEM undergraduate discussion forum'] },
    verification_notes: 'Conversational pacing, spontaneous correction, and realistic student error patterns confirm human authorship.'
  },
  {
    round_id: 1,
    sort_order: 9,
    content: {
      question_type: 'classification',
      difficulty: 'hard',
      title: 'Exhibit HM-110: Freight Dispatch Notification',
      question: 'Who most likely wrote this text?',
      evidence: `Order #78410 has cleared inbound customs at Port of Newark and is currently staged for intermodal rail transfer to distribution center Chicago-Southwest. Estimated transfer completion is 18:00 EST October 24. No carrier exceptions have been logged at this checkpoint.`,
      options: ['Human-written', 'AI-generated', 'Insufficient evidence'],
      hints: 'Consider whether an automated system macro / rule-based template from an ERP database can be reliably categorized as human or AI.'
    },
    answer: { verdict: 'Insufficient evidence', classification: 'Insufficient evidence' },
    scoring: { points: 2 },
    explanation: 'Automated ERP dispatch notification. This is a template-driven operational notice generated by database business logic since long before LLMs existed. Attributing it definitively to human or AI is methodologically invalid.',
    provenance: { sources: ['Logistics ERP automated status dispatch'] },
    verification_notes: 'Deterministic template-filled text lacks individual authorship signal.'
  },

  // =========================================================================
  // ROUND 2: FAKE OR FACT? (10 Claims, Max 25 pts: 5 x 2 pts + 5 x 3 pts)
  // Options: 'True', 'False', 'Misleading', 'Unverified'
  // =========================================================================
  {
    round_id: 2,
    sort_order: 0,
    content: {
      question_type: 'fact_check',
      difficulty: 'medium',
      title: 'Claim FF-201: The 100% Renewable Grid Claim',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Viral Energy Policy Headline: "On May 12, 2024, Portugal ran its entire national electricity grid for 72 consecutive hours exclusively on solar and wind power, completely disconnecting all natural gas and coal plants from the transmission network."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Distinguish between renewable generation exceeding net domestic consumption versus running completely islanded with zero fossil-fuel spinning reserve.'
    },
    answer: { verdict: 'Misleading', classification: 'Misleading' },
    scoring: { points: 2 },
    explanation: 'Misleading. While REN telemetry confirmed renewable generation exceeded domestic electricity consumption during that period, gas turbines were kept online at minimum technical load to provide synchronous rotational inertia for voltage stability, and surplus was traded via the Spanish interconnect.',
    provenance: { sources: ['REN Redes Energeticas Nacionais', 'ENTSO-E Transparency Platform'] },
    verification_notes: 'Primary grid operator data confirms gas plants remained synchronized to ensure grid frequency stability.'
  },
  {
    round_id: 2,
    sort_order: 1,
    content: {
      question_type: 'fact_check',
      difficulty: 'medium',
      title: 'Claim FF-202: Ambient Superconductor Wafer Fab Claim',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Viral Tech Rumor: "TSMC has secretly initiated 2nm test wafer pilot production utilizing ambient lead-apatite LK-99 superconductor interconnects, citing an internal technical memorandum from CEO Dr. C.C. Wei."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Recall peer-reviewed scientific replication studies regarding LK-99 lead-apatite compounds and check TSMC investor disclosures.'
    },
    answer: { verdict: 'False', classification: 'False' },
    scoring: { points: 3 },
    explanation: 'False. Independent international physics laboratories conclusively demonstrated that LK-99 is an insulator/semiconductor whose resistance anomalies arose from copper sulfide impurities, not superconductivity. TSMC confirmed no such memo or production exists.',
    provenance: { sources: ['Nature Materials LK-99 replication papers', 'TSMC Investor Relations'] },
    verification_notes: 'Confirmed false through both scientific literature consensus and corporate IR confirmation.'
  },
  {
    round_id: 2,
    sort_order: 2,
    content: {
      question_type: 'fact_check',
      difficulty: 'easy',
      title: 'Claim FF-203: The Voyager Golden Record',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Aerospace History Claim: "In 1977, the Voyager 1 space probe was equipped with a 12-inch gold-plated copper phonograph record containing sounds and images selected to portray the diversity of life on Earth to any extraterrestrial finders."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Verify NASA mission archives for the Voyager interstellar mission.'
    },
    answer: { verdict: 'True', classification: 'True' },
    scoring: { points: 2 },
    explanation: 'True. NASA launched Voyager 1 and 2 in 1977 each carrying a 12-inch gold-plated copper phonograph record curated by a committee chaired by Carl Sagan, containing 115 images, natural sounds, spoken greetings in 55 languages, and musical selections.',
    provenance: { sources: ['NASA JPL Voyager Mission Archive', 'Smithsonian National Air and Space Museum'] },
    verification_notes: 'Fully verified historical record documented in NASA mission telemetry and historical archives.'
  },
  {
    round_id: 2,
    sort_order: 3,
    content: {
      question_type: 'fact_check',
      difficulty: 'hard',
      title: 'Claim FF-204: Frontier AI Millennium Prize Rumor',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Social Media Leak: "An anonymous insider at a major frontier AI lab leaked internal logs showing their unreleased reasoning model has achieved 99.8% zero-shot accuracy solving all seven Clay Millennium Prize Problems."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Distinguish between verifiable mathematical preprints with formal proofs versus uncorroborated anonymous forum rumors.'
    },
    answer: { verdict: 'Unverified', classification: 'Unverified' },
    scoring: { points: 3 },
    explanation: 'Unverified. The claim originates from an unsubstantiated anonymous social media post with no cryptographic key sign-off, no peer-reviewed preprint, no Lean/Coq formal verification proofs, and no corporate corroboration.',
    provenance: { sources: ['Clay Mathematics Institute', 'ArXiv Math/CS archives'] },
    verification_notes: 'No verifiable mathematical or technological evidence exists to corroborate this anonymous rumor.'
  },
  {
    round_id: 2,
    sort_order: 4,
    content: {
      question_type: 'fact_check',
      difficulty: 'medium',
      title: 'Claim FF-205: WWII RAF Carrot Radar Disinformation',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Historical Intelligence Claim: "During World War II, the British Ministry of Information deliberately popularized the claim that eating carrots gave RAF night-fighter pilots superhuman night vision in order to conceal the deployment of airborne AI-radar interception equipment."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Look up British WWII propaganda campaigns regarding night-fighter ace John Cunningham and the introduction of Airborne Interception (AI) radar.'
    },
    answer: { verdict: 'True', classification: 'True' },
    scoring: { points: 2 },
    explanation: 'True. When the RAF deployed secret Airborne Interception (AI) radar in night fighters, the British Ministry of Information published press stories attributing ace pilot John Cunningham\'s night kills to eating carrots, creating a famous historical deception.',
    provenance: { sources: ['Imperial War Museum Archives', 'UK National Archives Kew - AIR 20/4122'] },
    verification_notes: 'Documented in declassified UK Ministry of Information and Air Ministry records.'
  },
  {
    round_id: 2,
    sort_order: 5,
    content: {
      question_type: 'fact_check',
      difficulty: 'easy',
      title: 'Claim FF-206: The Coffee Alzheimer Reversal Headline',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Health Blog Headline: "A 2024 double-blind clinical study in The Lancet established that drinking 4 cups of dark-roast coffee daily reverses existing cognitive decline and completely prevents Alzheimer's disease in 88% of patients."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Check biomedical database registries. No clinical trial has demonstrated a cure or 88% prevention rate for neurodegenerative Alzheimer\'s through coffee.'
    },
    answer: { verdict: 'False', classification: 'False' },
    scoring: { points: 3 },
    explanation: 'False. No such study was published in The Lancet or elsewhere. While observational epidemiology notes modest correlative associations with caffeine and alertness, claims of reversing established cognitive decline or 88% prevention are fabricated.',
    provenance: { sources: ['The Lancet Journal Archive', 'PubMed / National Library of Medicine'] },
    verification_notes: 'Direct search of The Lancet archives confirms no publication matching these claims exists.'
  },
  {
    round_id: 2,
    sort_order: 6,
    content: {
      question_type: 'fact_check',
      difficulty: 'medium',
      title: 'Claim FF-207: Global Sea Ice Expansion Telemetry',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Climate Debate Post: "Global sea ice volume hit an all-time record high in December 2023 according to polar satellite telemetry, disproving polar warming trends."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Check National Snow and Ice Data Center (NSIDC) and NASA satellite altimetry records.'
    },
    answer: { verdict: 'Misleading', classification: 'Misleading' },
    scoring: { points: 2 },
    explanation: 'Misleading. The post selectively highlighted a localized, short-term winter freeze anomaly in one sub-basin while ignoring overall global sea ice extent, which NSIDC satellite records confirm reached near-record lows in 2023.',
    provenance: { sources: ['National Snow and Ice Data Center (NSIDC)', 'NASA Cryospheric Sciences'] },
    verification_notes: 'Satellite multispectral imaging shows global sea ice extent was among the lowest on satellite record in 2023.'
  },
  {
    round_id: 2,
    sort_order: 7,
    content: {
      question_type: 'fact_check',
      difficulty: 'hard',
      title: 'Claim FF-208: 3,000-Year-Old Peruvian Clockwork Computer',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Viral Archaeology Video: "Archaeologists excavating a Chavin culture temple in Peru have uncovered an intact 3,000-year-old operational mechanical clockwork computer that predates the Greek Antikythera mechanism by over a thousand years."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Examine ancient metallurgy capabilities in the pre-Columbian Andes, where bronze gear-cutting technology did not exist.'
    },
    answer: { verdict: 'False', classification: 'False' },
    scoring: { points: 3 },
    explanation: 'False. The viral imagery was created using generative AI and digital composites blending Incan pottery textures with Victorian brass clock movements. Andean metallurgy at 1000 BCE worked native gold and copper; complex gear trains were unknown.',
    provenance: { sources: ['Ministry of Culture of Peru', 'Journal of Archaeological Science'] },
    verification_notes: 'Archaeological authorities and peer-reviewed Andean studies confirm the object is an internet fabrication.'
  },
  {
    round_id: 2,
    sort_order: 8,
    content: {
      question_type: 'fact_check',
      difficulty: 'hard',
      title: 'Claim FF-209: Bilateral Quantum CBDC Settlement Leak',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Financial Telegram Channel: "Leaked diplomatic memos reveal that the central banks of Singapore and Switzerland completed live production settlements of sovereign bonds using post-quantum private ledgers on September 18, 2025."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Search Monetary Authority of Singapore (MAS), Swiss National Bank (SNB), and Bank for International Settlements (BIS) Project Tourbillon publications.'
    },
    answer: { verdict: 'Unverified', classification: 'Unverified' },
    scoring: { points: 3 },
    explanation: 'Unverified. While the BIS, MAS, and SNB have conducted experimental simulations (Project Tourbillon / Project Helvetia), no official communique, settlement hash, or confirmation validates live sovereign production transactions on that date.',
    provenance: { sources: ['Bank for International Settlements (BIS)', 'Monetary Authority of Singapore (MAS)'] },
    verification_notes: 'Secondary blog claim lacking official corroboration or public cryptographic ledger confirmation.'
  },
  {
    round_id: 2,
    sort_order: 9,
    content: {
      question_type: 'fact_check',
      difficulty: 'easy',
      title: 'Claim FF-210: Apollo 11 Lunar Guidance Computer Specs',
      question: 'What is the most defensible verdict for this claim?',
      evidence: `Computer History Post: "The Apollo Guidance Computer (AGC) that navigated the Apollo 11 lunar module to the moon surface in 1969 operated with approximately 4 kilobytes of RAM and 72 kilobytes of ROM."`,
      options: ['True', 'False', 'Misleading', 'Unverified'],
      hints: 'Verify MIT Instrumentation Laboratory documentation for the Block II Apollo Guidance Computer.'
    },
    answer: { verdict: 'True', classification: 'True' },
    scoring: { points: 2 },
    explanation: 'True. The MIT Instrumentation Laboratory Block II AGC had 2,048 16-bit words of magnetic core RAM (approx. 4 KB) and 36,864 words of core rope ROM (approx. 72 KB), running at 1.024 MHz clock frequency.',
    provenance: { sources: ['MIT Museum Apollo Guidance Computer Archives', 'NASA History Division SP-4214'] },
    verification_notes: 'Verified against technical specifications preserved in NASA engineering archives and MIT documentation.'
  },

  // =========================================================================
  // ROUND 3: DEEPFAKE DETECTIVE (10 Exhibits, Max 25 pts: 5 x 2 pts + 5 x 3 pts)
  // Options: 'Authentic', 'Manipulated', 'Insufficient Evidence'
  // =========================================================================
  {
    round_id: 3,
    sort_order: 0,
    content: {
      question_type: 'multimodal',
      difficulty: 'medium',
      title: 'Exhibit DD-301: The Munich Bilateral Summit Leak',
      question: 'Investigate the leaked photograph and accompanying metadata claiming to show an unannounced bilateral summit in a Munich hotel corridor.',
      evidence: `Image Description & Extracted Data:
- Visual Scene: Two high-ranking foreign ministry officials conferring in a dimly lit marble-clad luxury hotel corridor.
- Artifact Observation: The lapel pin on the left diplomat has blurry, asymmetrical edges with non-standard national heraldry. The marble floor reflection shows a rectangular light fixture that does not correspond to any ceiling lamp visible in the overhead perspective.
- EXIF & File Data: Color Space sRGB, Software: "Adobe Photoshop 25.4 (Windows)", Camera Model: "Canon EOS R5", Lens: "RF 50mm f/1.2L", ISO: 3200, Exposure: 1/125s.
- Metadata Discrepancy: The XMP sidecar contains a C2PA manifest header that terminates prematurely with invalid cryptographic padding, indicating an injected or spoofed metadata block.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Examine both the physics of the optical reflection and the integrity of the C2PA provenance manifest.',
      sources: [
        { title: 'C2PA Specification', url: 'https://c2pa.org' },
        { title: 'Digital Investigation Guidelines', url: 'https://www.sciencedirect.com' }
      ]
    },
    answer: { verdict: 'Manipulated', classification: 'Manipulated' },
    scoring: { points: 2 },
    explanation: 'The specimen is Manipulated. Physical ray-tracing inconsistency in the marble floor reflection, corrupted C2PA cryptographic signature, and heraldic badge warping confirm synthetic generation/composite editing.',
    provenance: { sources: ['C2PA forensic validation suite'] },
    verification_notes: 'Optical reflection failure and broken cryptographic hash chain verify manipulation.'
  },
  {
    round_id: 3,
    sort_order: 1,
    content: {
      question_type: 'multimodal',
      difficulty: 'medium',
      title: 'Exhibit DD-302: Autonomous Night-Flight Sensor Log',
      question: 'Investigate this nighttime dashcam screenshot from an autonomous vehicle test fleet, which internet commentators claim is a "Sora/AI video stunt".',
      evidence: `FORENSIC SPECIMEN READOUT:
- Capture Device: Dual Sony IMX390 Automotive CMOS Sensors (HDR, 120dB dynamic range, 60fps).
- Visual Anomaly Reported: A pedestrian wearing a dark parka crossing the street appears surrounded by a translucent blocky halo and slightly smeared leg motion.
- Codec Profile: H.264 Baseline Profile @ 1.8 Mbps (Low-bitrate edge recording buffer intended for immediate telemetry streaming).
- Photometric Data: Headlight illumination drops quadratically (1/r^2); pedestrian enters high-noise ambient periphery (lux < 0.2).
- Metadata & Chain of Custody: Raw camera stream timestamp: 2024-11-04 23:18:02 UTC. Cryptographic SHA-256 hash matches NHTSA National Highway Traffic Safety Administration docket filing.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Do not mistake standard low-bitrate H.264 macroblock compression in low-light for AI generation. Check the government docket chain of custody.',
      sources: [
        { title: 'NHTSA Automated Driving Systems Research Database', url: 'https://www.nhtsa.gov' }
      ]
    },
    answer: { verdict: 'Authentic', classification: 'Authentic' },
    scoring: { points: 3 },
    explanation: 'The specimen is Authentic. The visual smearing is caused by low-bitrate H.264 temporal motion-vector compression and high-gain CMOS sensor noise in extreme low lux (<0.2), not AI generation. Chain of custody is verified.',
    provenance: { sources: ['NHTSA Public Research Repository'] },
    verification_notes: 'Codec analysis reveals standard macroblock edge quantization consistent with embedded automotive hardware.'
  },
  {
    round_id: 3,
    sort_order: 2,
    content: {
      question_type: 'multimodal',
      difficulty: 'hard',
      title: 'Exhibit DD-303: Central Bank Emergency Rate Audio Memo',
      question: 'Investigate a leaked 20-second audio recording purportedly of a central bank governor announcing an emergency weekend interest rate freeze.',
      evidence: `AUDIO FORENSIC METRICS:
- Sample Rate: 44.1 kHz, 16-bit Mono WAV.
- Pitch Track Analysis: Fundamental frequency (F0) contour shows unnatural step discontinuities and micro-pitch jitter < 0.05 Hz across phrase boundaries.
- Formant Structure: Vocal tract formants (F1, F2) do not modulate naturally with vocal effort; room reverberation decay is completely absent in the 2 kHz - 4 kHz band.
- Spectral Noise Floor: Uniform Gaussian dither added across the entire track, masking background acoustic room reflections.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Analyze the vocal tract formant resonance and the unnatural robotic pitch step discontinuities.'
    },
    answer: { verdict: 'Manipulated', classification: 'Manipulated' },
    scoring: { points: 2 },
    explanation: 'Manipulated. The audio displays neural voice-cloning hallmarks: robotic step discontinuities in pitch track F0, unnatural static formant bandwidths, and artificial dither masking genuine room impulse response.',
    provenance: { sources: ['Voice Forensics Institute Benchmark'] },
    verification_notes: 'Spectrographic analysis proves synthetic neural vocoder generation.'
  },
  {
    round_id: 3,
    sort_order: 3,
    content: {
      question_type: 'multimodal',
      difficulty: 'easy',
      title: 'Exhibit DD-304: Endangered Javan Rhino Field Photograph',
      question: 'Investigate this high-resolution wildlife photograph claiming to show an encounter with an elusive Javan rhino in Ujung Kulon National Park.',
      evidence: `OPTICAL & SENSOR TELEMETRY:
- Camera: Nikon Z9 with NIKKOR Z 400mm f/2.8 TC VR S.
- Raw Sensor CFA: Authentic Bayer CFA pattern preserved in lossless NEF RAW format.
- Depth of Field & Optics: Consistent bokeh circle of confusion; natural longitudinal chromatic aberration (slight green fringing behind focus plane, magenta in front).
- Animal Anatomy: Correct dermal plating structure, natural skin folding with embedded organic peat mud, realistic eye reflection capturing tree canopy silhouette.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Examine optical lens physics (chromatic aberration and bokeh circles) and sensor RAW Bayer CFA consistency.'
    },
    answer: { verdict: 'Authentic', classification: 'Authentic' },
    scoring: { points: 3 },
    explanation: 'Authentic. Lens optical physics (longitudinal chromatic aberration, natural circle of confusion) and uncorrupted RAW sensor Bayer CFA data confirm optical capture without synthetic generation.',
    provenance: { sources: ['World Wildlife Conservation Field Archive'] },
    verification_notes: 'Optical and CFA pattern analysis confirms genuine physical capture.'
  },
  {
    round_id: 3,
    sort_order: 4,
    content: {
      question_type: 'multimodal',
      difficulty: 'hard',
      title: 'Exhibit DD-305: Warehouse Night CCTV Security Clip',
      question: 'Investigate a heavily degraded 2-second CCTV video clip showing a vehicle leaving an industrial park during an alleged burglary.',
      evidence: `CCTV FORENSIC EXTRACTION:
- Resolution: 320x240 downscaled from composite analog signal, 10 frames per second.
- Compression: Re-encoded 4 times across unknown consumer codecs (MPEG-4 Part 2 into WebM).
- Artifact Report: High pixelation around rear license plate; severe interlacing comb artifacts and motion blur smear across 18 pixels horizontally.
- Temporal Analysis: Insufficient resolution to determine whether the plate letters were digitally modified or obliterated by motion blur and codec quantization.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'When video evidence is severely degraded and re-compressed multiple times, consider whether any forensic tool can establish authenticity.'
    },
    answer: { verdict: 'Insufficient Evidence', classification: 'Insufficient Evidence' },
    scoring: { points: 2 },
    explanation: 'Insufficient Evidence. Due to extreme downsampling (240p), heavy multi-generation compression, and severe motion smearing, forensic algorithms cannot distinguish digital alteration from compression artifacting.',
    provenance: { sources: ['Forensic video enhancement standards'] },
    verification_notes: 'Resolution and SNR fall below minimum forensic threshold for reliable classification.'
  },
  {
    round_id: 3,
    sort_order: 5,
    content: {
      question_type: 'multimodal',
      difficulty: 'medium',
      title: 'Exhibit DD-306: Coastal Naval Drydock Satellite Image',
      question: 'Investigate an alleged commercial satellite optical image showing a novel stealth submarine hull in a drydock.',
      evidence: `SATELLITE TELEMETRY ANALYSIS:
- Provider Claimed: PlanetScope 3-meter resolution constellation.
- Sun Azimuth & Elevation: Recorded in metadata as 142.4 deg azimuth, 48.2 deg elevation (local solar time 11:30 AM).
- Shadow Angle Discrepancy: Crane tower shadow extends toward 320 deg (consistent with sun), but the submarine hull shadow falls toward 275 deg (45-degree angle discrepancy!).
- Error Level Analysis: High-frequency compression artifacts concentrated strictly within the drydock boundary, distinct from the surrounding ocean tiles.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Compare the shadow direction of the crane tower with the shadow direction of the submarine hull.'
    },
    answer: { verdict: 'Manipulated', classification: 'Manipulated' },
    scoring: { points: 3 },
    explanation: 'Manipulated. The 45-degree shadow angle discrepancy between the vessel and the facility structures violates the laws of solar illumination. ELA confirms localized image splicing into the drydock basin.',
    provenance: { sources: ['Satellite Imagery Forensic Protocol'] },
    verification_notes: 'Physical solar geometry failure and localized compression variance prove image composite manipulation.'
  },
  {
    round_id: 3,
    sort_order: 6,
    content: {
      question_type: 'multimodal',
      difficulty: 'easy',
      title: 'Exhibit DD-307: Executive Video Interview Frame',
      question: 'Investigate a high-profile corporate video interview frame claimed by internet blogs to be a real-time deepfake avatar.',
      evidence: `VIDEO FRAME TELEMETRY:
- Source: 4K ProRes 422 HQ broadcast stream from Sony FX9.
- Ocular Biometrics: Corneal specular reflections show matching studio softbox octabox outlines in both eyes with identical optical perspective.
- Temporal Consistency: Micro-saccadic eye movement and natural blink duration (180ms) verified across 300 sequential frames.
- Cryptographic Proof: Hardware-signed C2PA content credential embedded in video stream container from Sony camera hardware root of trust.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Observe the identical corneal softbox reflections and verify the Sony hardware root of trust C2PA manifest.'
    },
    answer: { verdict: 'Authentic', classification: 'Authentic' },
    scoring: { points: 2 },
    explanation: 'Authentic. Dual-corneal specular reflection consistency, natural micro-saccades, and hardware-signed C2PA provenance from camera firmware confirm authentic footage.',
    provenance: { sources: ['Broadcast Verification Alliance'] },
    verification_notes: 'Hardware cryptographic signature and physical reflection consistency verify authenticity.'
  },
  {
    round_id: 3,
    sort_order: 7,
    content: {
      question_type: 'multimodal',
      difficulty: 'medium',
      title: 'Exhibit DD-308: Boardroom Leaked Audio Snippet',
      question: 'Investigate an alleged secret boardroom audio recording where a CEO appears to admit to insider trading.',
      evidence: `AUDIO FORENSIC PROFILE:
- Noise Floor Analysis: The background room ambience contains a repeating 1.2-second loop of HVAC noise with identical acoustic phase characteristics.
- Phonetic Transitions: Sudden energy dropouts in plosive consonant bursts (/p/, /t/, /k/) with unnaturally sharp 0-millisecond onset transitions.
- Voice Mel-Spectrogram: Synthetic harmonic overtones exhibit zero jitter in steady vowels, characteristic of Tacotron / VITS neural speech synthesis models.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Look for looping noise floor anomalies and synthetic vowel harmonics with zero acoustic jitter.'
    },
    answer: { verdict: 'Manipulated', classification: 'Manipulated' },
    scoring: { points: 3 },
    explanation: 'Manipulated. Mel-spectrogram demonstrates flat neural vocoder harmonics, spliced phoneme boundaries with 0ms transition gaps, and a looping 1.2s ambient noise file.',
    provenance: { sources: ['Acoustic Forensic Laboratory'] },
    verification_notes: 'Spectral harmonics and looping background noise confirm synthetic neural speech generation.'
  },
  {
    round_id: 3,
    sort_order: 8,
    content: {
      question_type: 'multimodal',
      difficulty: 'hard',
      title: 'Exhibit DD-309: Ball Lightning Viral Smartphone Video',
      question: 'Investigate a viral smartphone video purporting to show a glowing ball lightning sphere floating near high-voltage power lines during a thunderstorm.',
      evidence: `SMARTPHONE VIDEO SPECIMEN:
- Capture: H.265 encoded video uploaded through TikTok and re-downloaded via third-party web scraper.
- Sensor Telemetry: All original EXIF, GPS, and device quantization tables stripped during social media transcode.
- Visual Anomalies: Glowing sphere exhibits slight illumination bleed into raindrops, but compression blockiness obscures boundary pixels.
- Forensic Verdict: CGI compositing and authentic high-voltage electrical plasma discharge produce identical optical signatures at this bitrate.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Consider whether heavy re-compression and stripped metadata permit a definitive ruling between sophisticated visual effects and rare natural phenomena.'
    },
    answer: { verdict: 'Insufficient Evidence', classification: 'Insufficient Evidence' },
    scoring: { points: 2 },
    explanation: 'Insufficient Evidence. Stripped metadata and heavy H.265 social platform compression prevent conclusive discrimination between high-end After Effects VFX compositing and authentic physical atmospheric phenomena.',
    provenance: { sources: ['Atmospheric Optical Phenomena Group'] },
    verification_notes: 'Data loss from multiple social media transcoding passes leaves inconclusive scientific evidence.'
  },
  {
    round_id: 3,
    sort_order: 9,
    content: {
      question_type: 'multimodal',
      difficulty: 'easy',
      title: 'Exhibit DD-310: 1989 Diplomatic Summit Film Photo',
      question: 'Investigate a high-resolution scan of an archival 35mm silver-halide photograph from a 1989 international treaty signing ceremony.',
      evidence: `ARCHIVAL SCAN METRICS:
- Media Format: 35mm Tri-X 400 black-and-white silver halide negative scanned on a Hasselblad Flextight X5 drum scanner at 6300 dpi.
- Grain Morphology: Stochastic, non-repeating silver halide crystal clusters with authentic random Poisson spatial distribution across all optical densities.
- Edge Profile: Classic chemical developer adjacency effect (Mackie lines) along high-contrast borders between dark suit lapels and white shirts.
- Digital Signatures: No synthetic pixel lattice, no neural tile artifacts, and no frequency domain anomalies in Fourier transforms.`,
      options: ['Authentic', 'Manipulated', 'Insufficient Evidence'],
      hints: 'Analyze the physical chemistry of the film grain (Poisson distribution and Mackie adjacency lines).'
    },
    answer: { verdict: 'Authentic', classification: 'Authentic' },
    scoring: { points: 3 },
    explanation: 'Authentic. Authentic chemical silver-halide grain distribution, natural Mackie lines, and zero synthetic frequency artifacts confirm genuine physical analog photography.',
    provenance: { sources: ['National Historical Archives Photographic Collection'] },
    verification_notes: 'Chemical grain morphology and drum scan telemetry establish authentic analog provenance.'
  },

  // =========================================================================
  // ROUND 4: THE FINAL INVESTIGATION (Max 30 pts)
  // Project Chimera: The $42.5 Million Disappearance (Fictional Investigation)
  // =========================================================================
  {
    round_id: 4,
    sort_order: 0,
    content: {
      question_type: 'case_report',
      difficulty: 'hard',
      title: 'Case File 404: Project Chimera & The Midnight Wire',
      question: 'Investigate the unauthorized diversion of $42,500,000 from Horizon BioTech. Review the case briefing, inspect the 7 interconnected evidence exhibits, analyze the chronological timeline, explore the entity relationship diagram, review the financial transaction telemetry, examine the process flowchart, resolve the conflicting alibi, and submit your structured 5-part investigation report.',
      evidence: `OFFICIAL NOTICE: This is a fictional corporate forensics scenario designed for AI investigative analysis.

CASE OVERVIEW:
On October 14, 2026, at precisely 02:14:18 UTC, an automated high-frequency wire transfer of $42,500,000 was executed from Horizon BioTech's primary corporate treasury at Swiss Alpine Bank (Zurich) to Apex Ventures LLC (registered in Tortola, British Virgin Islands).

The wire was authorized using the multi-signature cryptographic keys belonging to CFO Marcus Croft and CTO Dr. Elena Vance.

KEY SUSPECTS & WITNESSES:
- Marcus Croft (CFO): Claims he was aboard diverted Lufthansa Flight LH434 and clearing US Customs in Boston during the wire transfer.
- Dr. Elena Vance (CTO): Claims her hardware cryptographic key was copied or spoofed; a planted USB drive was found in her office as an apparent decoy.
- Julian Hayes (Lead Backend Architect): Merged unreviewed Git commit 7f8b9c four days prior; left a confidential voice memo stating he was coerced by the CFO's office under the guise of a "stress test".`,
      options: [],
      hints: 'Examine the physical impossibility of Marcus Croft accessing SSH from Munich while roaming in Boston, the unauthorized backdoor commit by Julian Hayes, and the deliberate 420ms latency injection blinding the fraud watchdog.',
      case_data: {
        incident_time: '2026-10-14 02:14:18 UTC',
        amount: '$42,500,000.00 USD',
        victim: 'Horizon BioTech Inc.',
        beneficiary: 'Apex Ventures LLC (Tortola, BVI)',
        timeline: [
          { time: 'Oct 10 16:20 UTC', event: 'Julian Hayes merges unreviewed Git commit 7f8b9c ("Routine latency optimization") containing liquidity diversion backdoor.' },
          { time: 'Oct 13 22:15 UTC', event: 'Lufthansa LH434 diverts to Boston Logan (BOS) for medical emergency; Marcus Croft clears US Customs at 22:58 UTC.' },
          { time: 'Oct 14 02:10 UTC', event: 'Marcus Croft\'s iPhone connects to Boston cell tower; simultaneous SSH session established to Munich gateway using Croft\'s FIDO2 hardware key from IP 194.26.29.114.' },
          { time: 'Oct 14 02:11 UTC', event: 'Backdoor triggered via encrypted WebSocket frame broadcasting nonce 0x9f8b4a2e to liquidity router.' },
          { time: 'Oct 14 02:13 UTC', event: '420ms artificial latency delay injected into transaction watchdog monitoring subsystem.' },
          { time: 'Oct 14 02:14:18 UTC', event: '$42.5M multi-sig wire transfer executes to Apex Ventures LLC account at Swiss Alpine Bank.' },
          { time: 'Oct 14 02:22 UTC', event: 'Decoy USB keylogger found planted in CTO Dr. Elena Vance\'s office to frame her for the breach.' }
        ],
        entities: [
          { id: 'croft', name: 'Marcus Croft', role: 'CFO, Horizon BioTech', status: 'Primary Perpetrator (Fabricated Alibi)' },
          { id: 'vance', name: 'Dr. Elena Vance', role: 'CTO, Horizon BioTech', status: 'Framed / Decoy Victim' },
          { id: 'hayes', name: 'Julian Hayes', role: 'Lead Backend Architect', status: 'Coerced Insider' },
          { id: 'apex', name: 'Apex Ventures LLC', role: 'BVI Offshore Shell', status: 'Destination Vehicle' },
          { id: 'bank', name: 'Swiss Alpine Bank', role: 'Treasury & Custody', status: 'Target Banking System' }
        ],
        chart_data: {
          title: 'Liquidity Gateway Latency vs Watchdog Veto Threshold (ms)',
          labels: ['02:10', '02:11', '02:12', '02:13', '02:14', '02:15'],
          latency: [12, 14, 15, 420, 445, 16],
          threshold: [50, 50, 50, 50, 50, 50]
        }
      }
    },
    answer: {
      case_resolved: true,
      perpetrators: ['Marcus Croft', 'Julian Hayes (Coerced)'],
      shell_entity: 'Apex Ventures LLC',
      critical_contradiction: 'Munich SSH login occurred while Croft was physically located in Boston'
    },
    scoring: { points: 30 },
    explanation: 'The diversion was an inside embezzlement orchestrated by CFO Marcus Croft, who coerced architect Julian Hayes into deploying an algorithmic backdoor. Croft attempted to manufacture an alibi via a diverted flight to Boston, but his hardware token was used via a Munich proxy. The decoy USB keylogger planted in CTO Dr. Elena Vance\'s office was a failed misdirection.',
    provenance: { sources: ['Horizon BioTech Incident Response Team Dossier', 'BVI Corporate Registry'] },
    verification_notes: 'All exhibits, timeline entries, entity links, and financial telemetry corroborate the conclusion.'
  }
];

export async function seedChallenges() {
  const env = getEnv();
  const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: NoopWebSocket },
  });

  console.log(`Seeding all ${builtInChallengePacks.length} built-in forensic challenges...`);

  for (const pack of builtInChallengePacks) {
    const { data: existing } = await client
      .from('challenges')
      .select('id')
      .eq('round_id', pack.round_id)
      .eq('sort_order', pack.sort_order)
      .maybeSingle();

    let challengeId = existing?.id;

    if (!challengeId) {
      const { data: inserted, error: insertError } = await client
        .from('challenges')
        .insert({
          round_id: pack.round_id,
          sort_order: pack.sort_order,
          content: pack.content,
          published: true,
          provenance: pack.provenance,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`Failed to insert challenge for Round ${pack.round_id} Exhibit ${pack.sort_order}:`, insertError.message);
        continue;
      }
      challengeId = inserted.id;

      const { error: keyError } = await client
        .from('challenge_keys')
        .insert({
          challenge_id: challengeId,
          answer: pack.answer,
          scoring: pack.scoring,
          explanation: pack.explanation,
          verification_notes: pack.verification_notes,
        });

      if (keyError) {
        console.error(`Failed to insert key for Round ${pack.round_id} Exhibit ${pack.sort_order}:`, keyError.message);
      } else {
        console.log(`✓ R${pack.round_id} Exhibit ${pack.sort_order + 1} initialized!`);
      }
    } else {
      await client.from('challenges').update({
        content: pack.content,
        published: true,
        provenance: pack.provenance,
      }).eq('id', challengeId);

      await client.from('challenge_keys').upsert({
        challenge_id: challengeId,
        answer: pack.answer,
        scoring: pack.scoring,
        explanation: pack.explanation,
        verification_notes: pack.verification_notes,
      });
      console.log(`✓ R${pack.round_id} Exhibit ${pack.sort_order + 1} updated.`);
    }
  }

  const { data: totalChallenges } = await client
    .from('challenges')
    .select('id, round_id, sort_order, published')
    .order('round_id')
    .order('sort_order');

  console.log(`\nTotal active published challenges in DB: ${totalChallenges?.length}`);
  return totalChallenges;
}

if (process.argv[1]?.endsWith('seed-challenges.js')) {
  seedChallenges().catch(console.error);
}
