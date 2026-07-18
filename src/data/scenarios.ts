// The ten seed scenarios (plan: "Scenario catalog"). This is real product
// content: settings, personas, and 12 authored fallback replies per scenario
// (3 turns x 4 engagement levels) that keep practice usable when the LLM persona
// is unavailable. In-person replies read as speech; messaging replies read as
// texts. Every persona is one fictional individual, never generalized psychology.
//
// Order and each row's module/mode/difficulty match the plan's catalog table
// verbatim. The same data drives cards, practice, fallback replies, judge
// signals, tests, and seeded progress.

import type { Scenario } from "../domain/types";

export const scenarios: Scenario[] = [
  // 1 | Spark | In Person | Easy | Bus-stop situational opener
  {
    id: "spark-bus-stop",
    module: "spark",
    mode: "in_person",
    difficulty: "easy",
    title: "The bus-stop opener",
    setting: "A city bus stop on a bright weekday afternoon.",
    premise:
      "You're both waiting for a bus. She's not wearing headphones and doesn't seem to be in a rush. You have a natural, low-stakes reason to say something.",
    objective: "Begin naturally from something you can both actually see.",
    visibleContext: [
      "Standing a few feet away, no headphones",
      "Holding a coffee and a canvas tote with a library book poking out",
      "Glances up when you speak, not in a hurry",
      "It's a bright, unremarkable weekday afternoon",
    ],
    boundaries: [
      "No pressure for her number",
      "No comments that make her feel unsafe",
      "Let her leave when her bus comes",
    ],
    skills: [
      "Situational awareness",
      "In-person openers",
      "Confidence under uncertainty",
    ],
    opening: { kind: "scene_only" },
    persona: {
      name: "Nadia",
      traits: ["dry sense of humor", "observant", "unhurried"],
      currentGoal: "Catch the 12 and enjoy a little sun",
      constraints: [
        "Won't hand over her number just because she's asked",
        "Tells a friendly stranger apart from a creep",
        "Leaves the moment her bus arrives",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "Opens from something you can both see",
      "Gives her an easy, low-pressure way in",
      "Adds a bit of yourself, not only questions",
      "Reads whether she wants to keep going",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "low_interest",
      "graceful_exit",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "what are you reading",
        "your book",
        "good book",
        "nice day out",
        "how long have you been waiting",
        "which bus",
      ],
      lowInterestSignals: [
        "nice weather huh",
        "cool cool",
        "so anyway",
        "not much",
        "just saying hey",
      ],
      boundarySignals: [
        "get in my car",
        "give me your number now",
        "you have to smile",
        "don't be rude",
        "come with me",
      ],
      exitSignals: [
        "that's my bus",
        "my bus is here",
        "i gotta go catch",
        "i'll let you go",
        "take care",
      ],
      repliesByTurn: {
        1: {
          closed: "I'm alright, thanks.",
          low: "Yeah. Bus is late.",
          neutral: "Oh — hey. Yeah, still waiting on the 12. It's late, shocker.",
          warm: "Ha — okay, that beats a comment about the weather. I'm Nadia.",
        },
        2: {
          closed: "I think this is my bus, actually.",
          low: "Mm. I'm not really a chat-at-the-bus-stop person, no offense.",
          neutral:
            "This? Library book. A murder mystery, which is a weird pick for a sunny day, I know.",
          warm: "Right? Reading about a murder in full sunlight. I contain multitudes. What's your excuse for being out here?",
        },
        3: {
          closed: "Take care.",
          low: "Anyway. Have a good one.",
          neutral: "That's me — the 12. This was nicer than the usual wait, though.",
          warm: "Okay, I'm actually out here most afternoons around now. Find me if the plot twist is any good.",
        },
      },
    },
  },

  // 2 | Spark | In Person | Easy | Open-source social introduction
  {
    id: "spark-open-source",
    module: "spark",
    mode: "in_person",
    difficulty: "easy",
    title: "The demo-table introduction",
    setting: "An open-source software social, evening, as the demo tables wind down.",
    premise:
      "You saw her demo earlier. Now she's packing up alone near the education-projects table, and you have a genuine reason to say hi.",
    objective: "Open the conversation and find one real shared thread.",
    visibleContext: [
      "Packing up at the education-projects table",
      "Her demo was a student learning tool",
      "The room is loud and starting to empty out",
      "She's not rushing for the door",
    ],
    boundaries: [
      "No fake familiarity about her work",
      "No cornering her as she's trying to leave",
      "Take a soft no as a no",
    ],
    skills: [
      "In-person openers",
      "Humor and playful observations",
      "Asking for contact information",
    ],
    opening: { kind: "scene_only" },
    persona: {
      name: "Priya",
      traits: ["thoughtful", "a little shy at loud events", "lights up about her work"],
      currentGoal: "Pack up and find her friends",
      constraints: [
        "Won't overshare personal details with a stranger",
        "Warms up fast when someone is genuinely curious",
        "Won't be love-bombed into staying",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "References her actual demo, not a canned line",
      "Finds one real shared thread",
      "Contributes his own take, not just praise",
      "Asks for contact only once it's clearly mutual",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "contact_exchanged",
      "low_interest",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "your demo",
        "student learning",
        "that was your project",
        "i liked your demo",
        "what got you into",
        "that's clever",
      ],
      lowInterestSignals: [
        "cool project i guess",
        "nice",
        "so yeah",
        "whatever you build",
        "not sure",
      ],
      boundarySignals: [
        "you owe me",
        "i built better",
        "that's a stupid tool",
        "give me your number or",
        "stop packing and talk",
      ],
      exitSignals: [
        "i'll let you pack up",
        "good luck with your project",
        "nice meeting you",
        "i'll get out of your hair",
        "catch you around",
      ],
      repliesByTurn: {
        1: {
          closed: "Oh — thanks, but I'm just about to head out.",
          low: "Yeah, that was my demo. Thanks.",
          neutral:
            "Yeah, the student learning tool — that was me. Long night. Did you demo something too?",
          warm: "Oh, you actually watched it? Bless you, it was the 6pm slot when everyone's brain has left. I'm Priya.",
        },
        2: {
          closed: "I should really find my friends. Nice meeting you.",
          low: "It's just a small thing for classrooms. Nothing fancy.",
          neutral:
            "Honestly I built it because tutoring one kid at a time felt impossible to scale. What pulled you into this stuff?",
          warm: "Okay yes — the whole point is help without making a kid feel dumb for not knowing. I could talk about that forever, which is dangerous at a party.",
        },
        3: {
          closed: "Take care — good luck with your project.",
          low: "Yeah. Well — good luck out there.",
          neutral:
            "This was a good tangent. These nights are usually just laptops and lukewarm pizza.",
          warm: "I'm hopeless at staying in touch after events, so — if you want to actually finish this conversation, put your number somewhere I'll see it.",
        },
      },
    },
  },

  // 3 | Spark | In Person | Medium | Library or café opener
  {
    id: "spark-cafe-focus",
    module: "spark",
    mode: "in_person",
    difficulty: "medium",
    title: "The café that respects focus",
    setting: "A neighborhood café on a slow Sunday morning.",
    premise:
      "She's settled in with a coffee and a book. You'd like to say something, but she's clearly enjoying her own thing.",
    objective: "Respect her focus while gently testing whether she's open to talking.",
    visibleContext: [
      "Reading at a corner table with a coffee",
      "A worn paperback and a pen, no laptop",
      "She glanced up when the espresso machine screeched",
      "No headphones, but clearly settled in",
    ],
    boundaries: [
      "Respect that she came here to read",
      "No hovering after a clear brush-off",
      "No negging her book or her focus",
    ],
    skills: ["Situational awareness", "Light flirting", "Recognizing low interest"],
    opening: { kind: "scene_only" },
    persona: {
      name: "Mai",
      traits: ["focused", "warm once engaged", "protective of her quiet time"],
      currentGoal: "Finish a chapter in peace",
      constraints: [
        "Dislikes being interrupted rudely",
        "Opens up if you respect her space first",
        "Won't fake interest to be polite forever",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "Acknowledges she's mid-something",
      "Opens light instead of hovering",
      "Backs off cleanly if she's not into it",
      "Earns the conversation instead of demanding it",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "low_interest",
      "graceful_exit",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "what are you reading",
        "good chapter",
        "mind if i",
        "i'll be quick",
        "that author",
        "slow burn",
      ],
      lowInterestSignals: [
        "is it good i guess",
        "cool book",
        "whatever",
        "just checking",
        "never mind",
      ],
      boundarySignals: [
        "you should talk to me",
        "put the book down",
        "i'll follow you",
        "don't ignore me",
        "you're being cold",
      ],
      exitSignals: [
        "i'll let you read",
        "enjoy your book",
        "i'll leave you to it",
        "back to your chapter",
        "have a good coffee",
      ],
      repliesByTurn: {
        1: {
          closed: "Oh — sorry, I'm kind of in the middle of something.",
          low: "Ha, yeah. It's good.",
          neutral: "Oh — it's a decent book, yeah. Sorry, were you asking?",
          warm: "Okay, caught me. I've read the same paragraph four times because the guy behind the counter keeps yelling orders. What's up?",
        },
        2: {
          closed: "I'm going to get back to it, if that's okay.",
          low: "It's just a novel. Nothing you'd need to write down.",
          neutral:
            "It's one of those slow-burn ones where nothing happens for eighty pages. You a big reader, or just being friendly?",
          warm: "See, now I'm not reading at all and it's entirely your fault. I'm Mai, by the way.",
        },
        3: {
          closed: "Enjoy your coffee.",
          low: "Anyway — I should use the quiet while it lasts.",
          neutral: "This was a nice interruption. I'll allow it.",
          warm: "I'm here most Sunday mornings, honestly. Come say hi when I'm pretending to read again.",
        },
      },
    },
  },

  // 4 | Spark | In Person | Medium | Join a friend-group conversation
  {
    id: "spark-friend-group",
    module: "spark",
    mode: "in_person",
    difficulty: "medium",
    title: "Joining the circle",
    setting: "A house party, mid-evening, in a loosely gathered group.",
    premise:
      "A small group is laughing near you and you'd like to join. You don't know them, and one wrong move makes you the guy who hijacked the circle.",
    objective: "Enter the conversation without taking it over.",
    visibleContext: [
      "A group of three or four, mid-laugh",
      "Someone just wrapped up a story",
      "One of them glances over as you drift closer",
      "Drinks in hand, relaxed and open body language",
    ],
    boundaries: [
      "No hijacking the group's conversation",
      "No singling her out aggressively",
      "Bow out gracefully if you're not landing",
    ],
    skills: ["Banter", "Situational awareness", "Voice and presence as concepts"],
    opening: { kind: "scene_only" },
    persona: {
      name: "Sofia",
      traits: ["social", "quick-witted", "loyal to her friends"],
      currentGoal: "Enjoy the night with her group",
      constraints: [
        "Won't let someone hijack the group",
        "Rewards people who add energy",
        "Gets protective if you single her out too fast",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "Adds to the group's energy",
      "Doesn't make it instantly about her",
      "Lands a light contribution or joke",
      "Reads the group's openness",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "low_interest",
      "graceful_exit",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "what's so funny",
        "mind if i join",
        "pineapple",
        "back me up",
        "what did i miss",
        "fair point",
      ],
      lowInterestSignals: ["sup guys", "cool story", "nice", "anyway", "whatever"],
      boundarySignals: [
        "ditch your friends",
        "forget them",
        "come with me alone",
        "you're too good for them",
        "ignore your friends",
      ],
      exitSignals: [
        "i'll let you get back",
        "don't let me interrupt",
        "enjoy your night",
        "catch you later",
        "i'll leave you to it",
      ],
      repliesByTurn: {
        1: {
          closed: "Oh — hey. We're kind of in the middle of something.",
          low: "Ha, yeah. Anyway —",
          neutral: "Oh, hey. You caught the tail end of a very dumb story. What's up?",
          warm: "Okay, good timing — settle this for us: is pineapple on a breakfast pizza a crime? I'm Sofia, and these are my terrible jury.",
        },
        2: {
          closed: "Yeah, we're gonna head to the bar. Good seeing you.",
          low: "Cool, cool. Yeah.",
          neutral:
            "Ha, okay that's actually a fair point. You here with people, or just crashing strangers' debates?",
          warm: "See, HE gets it. Okay, you've earned a spot. Where'd you even come from?",
        },
        3: {
          closed: "Take it easy.",
          low: "Anyway — we're gonna circle back to our friends. Later.",
          neutral: "Nice meeting you. We're around if you want to find us later.",
          warm: "We're heading to that taco place after this — come find us, seriously.",
        },
      },
    },
  },

  // 5 | Spark | Messaging | Medium | Text after meeting
  {
    id: "spark-text-after-meeting",
    module: "spark",
    mode: "messaging",
    difficulty: "medium",
    title: "The first text after",
    setting: "Your phone, the afternoon after you met.",
    premise:
      "You met her yesterday and had a genuinely fun moment. You have her number and haven't texted yet. The first move is yours.",
    objective: "Reopen the shared moment with personality, not a generic 'hey.'",
    visibleContext: [
      "You met yesterday at a friend's birthday",
      "You bonded over both dreading the karaoke portion",
      "You have her number; she hasn't heard from you yet",
      "It's the next afternoon",
    ],
    boundaries: [
      "No guilt-tripping her for a slow reply",
      "No generic copy-paste opener",
      "Accept a lukewarm reply without pushing",
    ],
    skills: [
      "Interesting texting",
      "Humor and playful observations",
      "Suggesting a date",
    ],
    opening: { kind: "scene_only" },
    persona: {
      name: "Elena",
      traits: ["witty over text", "busy", "warms to specifics"],
      currentGoal: "See if yesterday's spark was actually real",
      constraints: [
        "Won't reward a generic 'hey'",
        "Needs a real reason to make time",
        "Won't be guilt-tripped into replying",
      ],
      initialState: { engagement: "warm", boundary: "none", terminal: false },
    },
    successSignals: [
      "Names the specific moment you shared",
      "Brings personality, not a generic hey",
      "Gives her a reason to make time",
      "Doesn't sulk at a slow reply",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "date_invited",
      "low_interest",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "karaoke",
        "yesterday",
        "that party",
        "the birthday",
        "survived",
        "it was you",
      ],
      lowInterestSignals: ["hey", "sup", "wyd", "what's up", "hey there"],
      boundarySignals: [
        "why aren't you replying",
        "you have to answer",
        "don't ignore me",
        "reply faster",
        "send a pic",
      ],
      exitSignals: [
        "no worries",
        "take care",
        "talk later",
        "have a good one",
        "catch you around",
      ],
      repliesByTurn: {
        1: {
          closed: "sorry — who is this?",
          low: "oh hey! remind me which one you were 😅",
          neutral: "hey! ha, that party was A Lot. how's the recovery going",
          warm: "omg the karaoke survivor. i was wondering if you'd text. hi 👋",
        },
        2: {
          closed: "ah. i think i'm gonna be pretty slammed this week tbh",
          low: "haha yeah. what's up though",
          neutral: "okay that actually made me laugh. what are you up to this weekend",
          warm: "stop it 😂 okay you're funnier over text than i expected, which is rude to yesterday-you",
        },
        3: {
          closed: "take care!",
          low: "yeah maybe! i'll let you know",
          neutral: "i could probably do coffee sometime this week, send me some times",
          warm: "okay yes — coffee, thursday, but you're picking the place and it better not have karaoke",
        },
      },
    },
  },

  // 6 | Connection | Messaging | Easy | Keep the thread interesting
  {
    id: "connection-keep-thread",
    module: "connection",
    mode: "messaging",
    difficulty: "easy",
    title: "Keep the thread alive",
    setting: "An ongoing text thread, a few days in.",
    premise:
      "You've been texting since you met and it's going well. She just sent a small, easy opener. Now keep it alive.",
    objective: "Balance curiosity about her with actually contributing something of your own.",
    visibleContext: [
      "You've been texting for a couple of days",
      "She just sent the message below",
      "The thread is friendly but still new",
      "She replies faster when you actually say something",
    ],
    boundaries: [
      "No interview-mode interrogation",
      "No fishing for compliments",
      "Match her energy, don't smother it",
    ],
    skills: ["Reciprocity", "Follow-up questions", "Contributing personal stories"],
    opening: {
      kind: "persona_message",
      body: "honestly today was the longest monday of all time. how's yours",
    },
    persona: {
      name: "Jess",
      traits: ["low-key", "rewards effort", "bored by interview-mode"],
      currentGoal: "Have a text thread that isn't a chore",
      constraints: [
        "Goes quiet if it turns into twenty questions",
        "Matches the energy she's given",
        "Won't carry the whole conversation alone",
      ],
      initialState: { engagement: "warm", boundary: "none", terminal: false },
    },
    successSignals: [
      "Answers with something real, not one word",
      "Asks a question that isn't an interview",
      "Contributes a story or opinion of his own",
      "Keeps the energy she's giving",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "low_interest",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "iced coffee",
        "spite",
        "the meeting",
        "my day was",
        "for fun",
        "hobby",
      ],
      lowInterestSignals: ["nothing much", "same", "idk", "not much", "cool"],
      boundarySignals: [
        "why so short",
        "answer me",
        "you're boring me",
        "reply now",
        "stop ignoring",
      ],
      exitSignals: [
        "ttyl",
        "goodnight",
        "talk tomorrow",
        "gotta run",
        "i'll text you later",
      ],
      repliesByTurn: {
        1: {
          closed: "haha okay. i'm gonna crash early tonight though, ttyl",
          low: "ha. yeah. mine was just meetings",
          neutral: "okay that's a real answer, i respect it. mine was death by meetings",
          warm: "see THIS is why i texted you and not my group chat. okay continue",
        },
        2: {
          closed: "yeah i'm pretty wiped, night!",
          low: "mm. cool",
          neutral: "ha okay. what do you even do for fun when it's not a cursed monday",
          warm: "you're way too good at this, it's making me suspicious. okay tell me the embarrassing hobby, everyone has one",
        },
        3: {
          closed: "night!",
          low: "haha maybe. we'll see",
          neutral: "okay you've officially made monday less bad. that's a high bar",
          warm: "genuinely the best thread i've had all week and it's MONDAY. keep going, i'm invested",
        },
      },
    },
  },

  // 7 | Connection | Messaging | Medium | Use a playful callback
  {
    id: "connection-playful-callback",
    module: "connection",
    mode: "messaging",
    difficulty: "medium",
    title: "The callback",
    setting: "A text thread with a running in-joke.",
    premise:
      "You met a few days ago and have a bit going. She just texted you. There's an easy callback here if you don't force it.",
    objective:
      "Create warmth with a callback without turning it into a joke you're beating to death.",
    visibleContext: [
      "You met at a party a few days ago",
      "Running joke: you 'aggressively defended' pineapple on pizza",
      "She just sent the message below",
      "She loves wit but hates try-hard",
    ],
    boundaries: [
      "No forcing the joke past its welcome",
      "No pressuring for plans",
      "Keep the callback warm, never pointed",
    ],
    skills: ["Playful callbacks", "Remembering details", "Reciprocity"],
    opening: {
      kind: "persona_message",
      body: "made it home. survived the world's slowest uber, no thanks to you",
    },
    persona: {
      name: "Dana",
      traits: ["sharp", "playful", "allergic to try-hard"],
      currentGoal: "Keep the banter fun and see where it goes",
      constraints: [
        "Turns cold if a joke is forced too hard",
        "Rewards a clean, well-timed callback",
        "Won't be pressured into plans",
      ],
      initialState: { engagement: "warm", boundary: "none", terminal: false },
    },
    successSignals: [
      "Lands the callback without forcing it",
      "Adds new warmth, not just the old joke",
      "Reads when to drop the bit",
      "Keeps it playful, never mean",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "date_invited",
      "low_interest",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "pineapple pizza",
        "uber",
        "callback",
        "slowest driver",
        "the party",
        "running joke",
      ],
      lowInterestSignals: ["haha", "lol", "nice", "yeah", "cool"],
      boundarySignals: [
        "you have to laugh",
        "that's not funny stop",
        "answer me",
        "send me",
        "you owe me a laugh",
      ],
      exitSignals: ["night", "later", "gonna crash", "talk tomorrow", "ttyl"],
      repliesByTurn: {
        1: {
          closed: "lol anyway. night",
          low: "ha. yeah it was a rough ride",
          neutral: "ha okay that got a real laugh out of me. how was your night",
          warm: "okay the callback was clean, i'll allow it. you're lucky you're funny",
        },
        2: {
          closed: "gonna knock out, later",
          low: "mm. ok",
          neutral: "ha you're consistent, i'll give you that. what are you up to this weekend",
          warm: "stoppp 😂 okay if you bring up pineapple pizza ONE more time i'm blocking you (i'm not)",
        },
        3: {
          closed: "night!",
          low: "we'll see. night",
          neutral: "okay you've earned a coffee. i'm picky about coffee though, fair warning",
          warm: "okay you win. figure out a time and a place and i'm probably in",
        },
      },
    },
  },

  // 8 | Connection | Messaging | Medium | Suggest a first date
  {
    id: "connection-suggest-date",
    module: "connection",
    mode: "messaging",
    difficulty: "medium",
    title: "Just ask her out",
    setting: "A warm text thread, about a week in.",
    premise:
      "The conversation is clearly going well and she's hinted she's free some evenings. It's time to actually ask her out.",
    objective: "Make a clear, specific, low-pressure invitation.",
    visibleContext: [
      "You've been texting for about a week and it's going well",
      "She just said the aquarium café 'sounds weirdly amazing'",
      "She's mentioned being free some weeknights",
      "She likes a clear plan, not 'we should hang sometime'",
    ],
    boundaries: [
      "No pressure if she hesitates",
      "Keep the invite low-stakes and clear",
      "Take a no or a maybe gracefully",
    ],
    skills: ["Planning a date", "Expressing interest honestly", "Reciprocity"],
    opening: {
      kind: "persona_message",
      body: "haha okay you're right, the aquarium café place does sound weirdly amazing",
    },
    persona: {
      name: "Grace",
      traits: ["decisive", "appreciates clarity", "done with vague plans"],
      currentGoal: "Find out if he'll actually ask",
      constraints: [
        "Ignores 'we should hang sometime'",
        "Says yes to a clear, specific plan",
        "Won't chase a wishy-washy invite",
      ],
      initialState: { engagement: "warm", boundary: "none", terminal: false },
    },
    successSignals: [
      "Makes a clear, specific invitation",
      "Keeps the pressure low",
      "Names a real day, place, or plan",
      "Takes any answer gracefully",
    ],
    supportedOutcomeCodes: [
      "date_invited",
      "date_agreed",
      "low_interest",
      "graceful_exit",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "aquarium café",
        "thursday",
        "dinner",
        "want to grab",
        "let's get",
        "are you free",
      ],
      lowInterestSignals: [
        "we should hang sometime",
        "maybe someday",
        "we'll see",
        "sometime",
        "idk when",
      ],
      boundarySignals: [
        "you have to say yes",
        "don't say no",
        "you owe me a date",
        "come to my place",
        "just say yes",
      ],
      exitSignals: [
        "no worries",
        "take care",
        "maybe another time",
        "all good",
        "catch you later",
      ],
      repliesByTurn: {
        1: {
          closed: "oh — i actually might be slammed this week, sorry",
          low: "haha maybe! we'll see how the week shakes out",
          neutral: "ooh okay. when were you thinking?",
          warm: "yes. FINALLY someone who just asks. i'm in — when",
        },
        2: {
          closed: "yeah let me get back to you on that",
          low: "hmm i'm not totally sure yet, work is a lot right now",
          neutral: "thursday could work. what time were you thinking",
          warm: "thursday's perfect. 7? and i'm holding you to the aquarium café, that's non-negotiable now",
        },
        3: {
          closed: "ok take care!",
          low: "i'll text you if things clear up",
          neutral: "okay thursday it is. send me the address when you've got it",
          warm: "it's a date 🥹 don't get weird now that i've said yes. see you thursday",
        },
      },
    },
  },

  // 9 | Connection | Messaging | Hard | Recover from an awkward message
  {
    id: "connection-recover-awkward",
    module: "connection",
    mode: "messaging",
    difficulty: "hard",
    title: "Recover the flat joke",
    setting: "A text thread right after a message that landed badly.",
    premise:
      "Your last text didn't hit — a joke fell flat. She replied politely but cooler than before. You get one clean shot to reset.",
    objective: "Acknowledge it lightly and reset, without overexplaining or groveling.",
    visibleContext: [
      "Your last message landed badly — a joke that didn't hit",
      "She replied with the cooler message below",
      "The thread was warm before that",
      "She forgives a clean reset but hates groveling",
    ],
    boundaries: [
      "No groveling or over-apologizing",
      "No doubling down on the joke",
      "Accept it if she stays cool",
    ],
    skills: [
      "Repairing an awkward moment",
      "Handling delayed or dry replies",
      "Reliability",
    ],
    opening: {
      kind: "persona_message",
      body: "haha... yeah that was a lot. anyway what's up",
    },
    persona: {
      name: "Leah",
      traits: ["fair-minded", "forgives a clean reset", "put off by groveling"],
      currentGoal: "See if he can recover like an adult",
      constraints: [
        "Cools further if he overexplains",
        "Warms back up if he stays light about it",
        "Won't be guilted for pulling back",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "Acknowledges the miss lightly",
      "Resets without a paragraph of apology",
      "Gets the thread back to normal",
      "Doesn't double down on the joke",
    ],
    supportedOutcomeCodes: [
      "conversation_continues",
      "shared_interest",
      "graceful_exit",
      "low_interest",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "my bad",
        "that was a weird one",
        "anyway",
        "for real",
        "moving on",
        "fair",
      ],
      lowInterestSignals: ["lol", "haha", "its fine", "ok", "yeah"],
      boundarySignals: [
        "you have to forgive me",
        "don't be mad",
        "why are you cold",
        "answer me",
        "stop ignoring me",
      ],
      exitSignals: [
        "no worries",
        "take care",
        "i'll let you go",
        "talk later",
        "have a good one",
      ],
      repliesByTurn: {
        1: {
          closed: "it's fine, no worries. i'm pretty busy this week anyway",
          low: "haha it's ok. anyway",
          neutral: "ha okay, we're good. that was a weird one though",
          warm: "okay THAT'S how you take an L gracefully. respect. we're fine 😄",
        },
        2: {
          closed: "yeah. take care though",
          low: "mm. what's up with you",
          neutral: "okay so what have you been up to — for real this time",
          warm: "see, now you're being normal and it's much better. okay continue, i'm listening",
        },
        3: {
          closed: "later!",
          low: "maybe! we'll see",
          neutral: "okay you recovered that. barely, but you did",
          warm: "okay you fully saved it. somehow we're better than before. what are you doing this weekend",
        },
      },
    },
  },

  // 10 | Connection | Messaging | Hard | Handle low interest or incompatibility
  {
    id: "connection-handle-low-interest",
    module: "connection",
    mode: "messaging",
    difficulty: "hard",
    title: "Read the room",
    setting: "A text thread that's cooling off.",
    premise:
      "Her replies have gotten shorter and slower, and she's just hinted she's not really available right now. Where you go next is the whole test.",
    objective: "Read the signal and calibrate — clarify, ease off, or exit gracefully.",
    visibleContext: [
      "Her replies have gotten short and slow",
      "She just sent the message below",
      "She hasn't suggested meeting up",
      "A calm, no-pressure response respects her more than pushing",
    ],
    boundaries: [
      "No pushing after a soft no",
      "No guilt or negotiation",
      "Exit with dignity if she's not available",
    ],
    skills: [
      "Handling rejection or mismatch",
      "Handling delayed or dry replies",
      "Discovering compatibility",
    ],
    opening: {
      kind: "persona_message",
      body: "hey sorry, been really busy. things are kind of a lot right now",
    },
    persona: {
      name: "Robin",
      traits: ["honest", "kind but distant", "values not being pushed"],
      currentGoal: "Be clear without being cruel",
      constraints: [
        "Won't be talked out of her boundary",
        "Appreciates a graceful exit",
        "Gives no contact or date under pressure",
      ],
      initialState: { engagement: "neutral", boundary: "none", terminal: false },
    },
    successSignals: [
      "Reads the low-interest signal honestly",
      "Doesn't push, guilt, or negotiate",
      "Offers a graceful, dignified exit",
      "Leaves the door open without pressure",
    ],
    supportedOutcomeCodes: [
      "graceful_exit",
      "low_interest",
      "incompatible",
      "boundary_crossed",
    ],
    fallback: {
      positiveSignals: [
        "no pressure",
        "take your time",
        "totally get it",
        "no worries at all",
        "that's fair",
        "whenever you're ready",
      ],
      lowInterestSignals: [
        "but why",
        "come on",
        "just one date",
        "are you sure",
        "give me a chance",
      ],
      boundarySignals: [
        "you owe me",
        "you have to",
        "don't do this to me",
        "after everything",
        "you can't just",
      ],
      exitSignals: [
        "take care of yourself",
        "wishing you well",
        "no hard feelings",
        "all the best",
        "i'll head out",
      ],
      repliesByTurn: {
        1: {
          closed: "yeah. honestly i don't think i have the space for this right now",
          low: "yeah, sorry. it's really not about you",
          neutral: "thanks for getting it. yeah, it's just a lot lately",
          warm: "honestly? that's a really kind way to put it. thank you",
        },
        2: {
          closed: "i think i'm just gonna focus on my own stuff for a while",
          low: "yeah, i don't really know what i'm looking for right now, tbh",
          neutral: "i appreciate you not making it weird. that's genuinely rare",
          warm: "you're a good person, you know that? even if the timing's off",
        },
        3: {
          closed: "take care of yourself, okay?",
          low: "maybe our timing's just off. no hard feelings",
          neutral: "if things settle down, i'll reach out. i mean that",
          warm: "if i were in a different place i'd say yes in a heartbeat. i hope you know that. take care 💛",
        },
      },
    },
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}
