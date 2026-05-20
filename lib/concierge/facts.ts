// Static curated rotation — used when Gemini is rate-limited / offline.
// 'Did You Know?' AI-evolution facts plus VYAN-aware greetings.

export const GREETINGS: Record<string, string[]> = {
  morning: [
    'Good morning, Yatra-traveller. The Vyoma is calm today.',
    'A fresh sunrise across the void. Where shall we begin?',
    'Morning glints across the orbs. Which Vigraha calls to you?',
  ],
  afternoon: [
    'Mid-day cognition runs warm. How can I guide you?',
    'The void hums softly. Would you like to engage with Vistāra?',
    'You seem to be drifting. Shall I point you to a Vigraha?',
  ],
  evening: [
    'Evening hush across the cosmos. Take your time.',
    'The orbs glow softer now. Shall I introduce you to Medhā?',
    'Twilight in the void. Tell me, what shall we explore?',
  ],
  night: [
    'A nocturnal traveller. The void is quietest now.',
    'Late hours, deep cognition. Shall we visit Sandhi?',
    'The orbs respect your night. Where would you like to wander?',
  ],
};

export const NUDGES = [
  'You’ve been here a while. Anything I can help find?',
  'Tap any Vigraha—I’ll bring you there instantly.',
  'Curious about VYAN Mudrā? It’s in the Vistāra void.',
  'For deep questions, Medhā is always listening.',
  'I’m here whenever the cosmos feels vast.',
];

export const FACTS = [
  'Did you know? GPT-2 (2019) had 1.5B params; modern flagships are 1000× larger.',
  'Did you know? The first neural language model was Bengio’s in 2003.',
  'Did you know? Attention-is-All-You-Need (2017) made today’s LLMs possible.',
  'Did you know? Multimodal AI now understands text, images, audio AND video simultaneously.',
  'Did you know? Reasoning models think in tokens before answering you.',
  'Did you know? Constitutional AI lets models self-critique against principles.',
  'Did you know? Embedding spaces can map analogies like king − man + woman = queen.',
  'Did you know? RLHF (human feedback) is what makes LLMs polite.',
  'Did you know? Mixture-of-Experts routes each token to a specialist sub-network.',
  'Did you know? Vision transformers split images into 16×16 patches and treat them like words.',
  'Did you know? Vector databases let AI “remember” without retraining.',
  'Did you know? Diffusion models run in reverse — from noise to clarity.',
  'Did you know? The longest context windows now exceed 2M tokens.',
  'Did you know? Speculative decoding speeds up LLM inference by 3–5×.',
  'Did you know? Quantization can shrink models 8× with minimal quality loss.',
  'Did you know? AI agents can now book, code, and reason for hours autonomously.',
  'Did you know? Cognitive architectures combine multiple AIs for complex tasks.',
  'Did you know? Self-rewarding LLMs improve themselves without new human data.',
  'Did you know? Distillation shrinks a giant model into a faster student model.',
  'Did you know? Embeddings encode meaning — cosine similarity reveals relationships.',
];

export const STUCK_PROMPTS = [
  'Have been waiting a while. Anything I can help you with?',
  'Need me to take you somewhere?',
  'Curious about anything specific? Medhā can answer in depth.',
];

export function getTimeBucket(): keyof typeof GREETINGS {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
