// The five Side Quests (plan: "Side Quests"). These are optional, lightweight
// handoffs — a suggestion and a copyable prompt, nothing more. RizzCode never
// teaches or hosts the subject; it points you somewhere and gets out of the way.

import type { SideQuest } from "../domain/types";

export const sideQuests: SideQuest[] = [
  {
    id: "learn-guitar",
    title: "Learn Guitar",
    whyItFits:
      "You already love music. Guitar gives you a creative outlet and something genuine to share. Some people find musicians attractive, sure — but the stronger reason is that you'd actually enjoy it.",
    starterAction:
      "Search YouTube for \"beginner guitar day one\" and give it fifteen honest minutes today.",
    handoffPrompt:
      "I'm a complete guitar beginner who likes [your music]. Build me a free 14-day plan at 15 minutes a day, and help me play one simple song by day 14.",
  },
  {
    id: "speak-without-freezing",
    title: "Speak Without Freezing",
    whyItFits:
      "If you go blank the second someone looks at you, this is the rep. It's the same muscle you use to open a conversation — just practiced somewhere safe first.",
    starterAction:
      "Record a 60-second story about your week on your phone, listen once, then tell it again a little more naturally.",
    handoffPrompt:
      "Search for Vinh Giang's free communication videos, or ask an AI: \"Give me a 5-minute daily drill to sound calmer and clearer when I talk to new people.\"",
  },
  {
    id: "follow-through",
    title: "Follow Through",
    whyItFits:
      "Reliability is the whole game once the exciting beginning wears off. Practice it now, on something small, before a relationship depends on it.",
    starterAction:
      "Send one honest reply you've been postponing — a text, an email, a thanks you owe someone. Just one, today.",
    handoffPrompt:
      "Ask yourself, or an AI: \"Help me draft a short, honest message to reconnect with someone I've been avoiding replying to.\"",
  },
  {
    id: "learn-household-skill",
    title: "Learn One Household Skill",
    whyItFits:
      "Not because 'every woman wants a handyman' — that's nonsense. Because basic competence in your own space is quietly good for you, and it feels good to fix your own stuff.",
    starterAction:
      "Pick one small repair you genuinely want to know — a leaky tap, a wobbly shelf — and find a free beginner tutorial for exactly that.",
    handoffPrompt:
      "Search YouTube for \"how to [the specific repair] for beginners,\" or ask an AI to list the three tools you'll need before you start.",
  },
  {
    id: "presentation-reset",
    title: "Presentation Reset",
    whyItFits:
      "This is about controllable preparation, never an attractiveness score. Clean, put-together, and comfortable in your own clothes changes how you carry yourself before you say a word.",
    starterAction:
      "Before your next social event, do a 5-minute check: clean clothes that fit, fresh breath, tidy hair, shoulders back.",
    handoffPrompt:
      "Ask an AI: \"Give me a simple, no-shopping-required checklist to look put-together for a casual [event] with what I already own.\"",
  },
];
