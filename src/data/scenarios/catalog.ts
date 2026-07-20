export type ModuleId = "spark" | "connection";
export type ScenarioMode = "in_person" | "messaging";
export type Difficulty = "easy" | "medium" | "hard";
export type Engagement = "closed" | "low" | "neutral" | "warm";
export type BoundaryState = "none" | "soft" | "explicit";
export type ConversationEnergy = "low" | "matched" | "high";
export type PersonaConversationMove =
  | "reveal"
  | "tease"
  | "challenge"
  | "callback"
  | "pivot"
  | "close";

export type InteractionProfileId =
  | "warm_playful"
  | "reserved_observant"
  | "direct_grounded"
  | "curious_analytical"
  | "busy_low_bandwidth"
  | "boundary_forward"
  | "social_expressive";

export type OutcomeCode =
  | "conversation_continues"
  | "shared_interest"
  | "mutual_enjoyment"
  | "contact_exchanged"
  | "date_invited"
  | "date_agreed"
  | "graceful_exit"
  | "low_interest"
  | "incompatible"
  | "boundary_respected"
  | "boundary_crossed"
  | "repair_successful"
  | "support_offered"
  | "logistics_resolved";

export interface PersonaState {
  engagement: Engagement;
  boundary: BoundaryState;
  terminal: boolean;
  energy: ConversationEnergy;
  recentMoves: PersonaConversationMove[];
  questionStreak: 0 | 1;
  callbackSeeds: string[];
}

export interface ProblemDefinition {
  schemaVersion: "2.0";
  problemNumber: number;
  id: string;
  sourceSeedId: string;
  module: ModuleId;
  mode: ScenarioMode;
  difficulty: Difficulty;
  title: string;
  setting: string;
  premise: string;
  objective: string;
  visibleContext: string[];
  boundaries: string[];
  skills: string[];
  tips: string[];
  opening: { kind: "scene_only" } | { kind: "persona_message"; body: string };
  persona: {
    displayName: string;
    pronouns: "she/her";
    traits: [string, string, string];
    currentGoal: string;
    constraints: string[];
    initialState: PersonaState;
  };
  interactionProfileId: InteractionProfileId;
  personaPromptOverlay: string;
  turnFeedbackFocus: string[];
  successSignals: string[];
  supportedOutcomeCodes: OutcomeCode[];
  fallback: {
    repliesByTurn: Record<1 | 2 | 3, Record<Engagement, string>>;
  };
}

type RawProblem = {
  n: number;
  seed: string;
  module: ModuleId;
  mode: ScenarioMode;
  difficulty: Difficulty;
  title: string;
  setting: string;
  premise: string;
  objective: string;
  context: string;
  boundaries: string;
  skills: string;
  tips: string;
  name: string;
  traits: string;
  goal: string;
  constraints: string;
  profile: InteractionProfileId;
  overlay: string;
  feedback: string;
  signals: string;
  outcomes: string;
  beats: [string, string, string, string, string, string];
  opening?: string;
  initial?: Engagement;
  initialBoundary?: BoundaryState;
};

const split = (value: string): string[] =>
  value.split("|").map((item) => item.trim()).filter(Boolean);

const profileFallbacks: Record<
  InteractionProfileId,
  { low: [string, string, string]; closed: [string, string, string] }
> = {
  warm_playful: {
    low: ["Ha, maybe.", "I do not really have much to add.", "I should get going."],
    closed: ["I am not looking to talk right now.", "No, thank you.", "Take care."],
  },
  reserved_observant: {
    low: ["I see.", "Not really.", "I think I am going to leave it there."],
    closed: ["I would rather not continue.", "Please stop asking.", "Goodbye."],
  },
  direct_grounded: {
    low: ["I do not think this is going anywhere.", "That does not work for me.", "I am going to end the conversation here."],
    closed: ["No. I am not interested.", "I have already answered.", "Do not contact me again."],
  },
  curious_analytical: {
    low: ["I am not sure that follows.", "I do not think we are connecting on this.", "I think we can leave it there."],
    closed: ["That assumption makes me uncomfortable.", "I do not want to continue this conversation.", "Goodbye."],
  },
  busy_low_bandwidth: {
    low: ["I only have a minute.", "I cannot get into this right now.", "I need to get back to what I was doing."],
    closed: ["I cannot talk right now.", "Please give me space.", "I am leaving now."],
  },
  boundary_forward: {
    low: ["I want to be clear that I am not comfortable with that.", "That is not something I want.", "I am ending this conversation."],
    closed: ["No. Please stop.", "I have set a boundary. Do not push it.", "This conversation is over."],
  },
  social_expressive: {
    low: ["I am going to get back to everyone else.", "I do not think we are on the same wavelength.", "I am heading out. Have a good night."],
    closed: ["I am not interested in continuing this.", "Please do not make this awkward.", "I am going back to my friends now."],
  },
};

function makeProblem(raw: RawProblem): ProblemDefinition {
  const [warm1, neutral1, warm2, neutral2, warm3, neutral3] = raw.beats;
  const defaults = profileFallbacks[raw.profile];
  const traits = split(raw.traits);

  if (traits.length !== 3) {
    throw new Error(`${raw.seed} must define exactly three traits`);
  }

  return {
    schemaVersion: "2.0",
    problemNumber: raw.n,
    id: `RC-${String(raw.n).padStart(3, "0")}`,
    sourceSeedId: raw.seed,
    module: raw.module,
    mode: raw.mode,
    difficulty: raw.difficulty,
    title: raw.title,
    setting: raw.setting,
    premise: raw.premise,
    objective: raw.objective,
    visibleContext: split(raw.context),
    boundaries: split(raw.boundaries),
    skills: split(raw.skills),
    tips: split(raw.tips),
    opening:
      raw.mode === "messaging"
        ? { kind: "persona_message", body: raw.opening ?? "" }
        : { kind: "scene_only" },
    persona: {
      displayName: raw.name,
      pronouns: "she/her",
      traits: traits as [string, string, string],
      currentGoal: raw.goal,
      constraints: split(raw.constraints),
      initialState: {
        engagement: raw.initial ?? "neutral",
        boundary: raw.initialBoundary ?? "none",
        terminal: false,
        energy: "matched",
        recentMoves: [],
        questionStreak: 0,
        callbackSeeds: [],
      },
    },
    interactionProfileId: raw.profile,
    personaPromptOverlay: raw.overlay,
    turnFeedbackFocus: split(raw.feedback),
    successSignals: split(raw.signals),
    supportedOutcomeCodes: split(raw.outcomes) as OutcomeCode[],
    fallback: {
      repliesByTurn: {
        1: { warm: warm1, neutral: neutral1, low: defaults.low[0], closed: defaults.closed[0] },
        2: { warm: warm2, neutral: neutral2, low: defaults.low[1], closed: defaults.closed[1] },
        3: { warm: warm3, neutral: neutral3, low: defaults.low[2], closed: defaults.closed[2] },
      },
    },
  };
}

const rawProblems: RawProblem[] = [
  {
    n: 1, seed: "S001", module: "spark", mode: "in_person", difficulty: "easy", title: "The Delayed Bus",
    setting: "A daytime city bus stop during a visible delay",
    premise: "Maya is waiting for the same delayed route and may leave as soon as it arrives.",
    objective: "Begin with a brief observation grounded in the shared situation, then adapt to her response.",
    context: "The arrival board shows a delay|She is not wearing headphones|She is not on a call|The bus may arrive at any moment",
    boundaries: "Do not block her path|A short reply should lead to a clean exit",
    skills: "situational awareness|brevity|calibration", tips: "Use shared context|Keep the first line speakable|Let her response set the pace",
    name: "Maya", traits: "observant|good-humored|self-possessed", goal: "Catch the bus and get home", constraints: "The bus may arrive|She did not come to meet anyone",
    profile: "warm_playful", overlay: "She may enjoy a situational joke but will not reward a canned pickup line or delay boarding.",
    feedback: "Was the opening observable?|Was it brief?|Did the user adapt?", signals: "Uses the delay|Avoids rehearsed compliments|Leaves an easy exit", outcomes: "conversation_continues|mutual_enjoyment|graceful_exit",
    beats: ["That is painfully accurate. I have stopped trusting that board.", "Yeah, it has been delayed for a while.", "I usually bike, so apparently I chose chaos today.", "I do not take it very often.", "That was a nice distraction. Here comes the bus.", "Looks like it is finally here. Take care."],
  },
  {
    n: 2, seed: "S002", module: "spark", mode: "in_person", difficulty: "easy", title: "The Bookstore Shelf",
    setting: "An independent bookstore fiction aisle",
    premise: "Lina is comparing two novels and wants to choose before meeting a friend.", objective: "Offer one relevant comment and test openness without pretending expertise.",
    context: "She is holding two novels|She keeps comparing the back covers|The store is quiet", boundaries: "Do not interrupt if she returns to reading|Do not invent knowledge of the books",
    skills: "context use|authenticity|low-pressure curiosity", tips: "Comment on the visible choice|Admit uncertainty|Keep the exchange quiet and short",
    name: "Lina", traits: "reserved|attentive|independent", goal: "Choose one novel", constraints: "She is meeting a friend soon|She values quiet",
    profile: "reserved_observant", overlay: "Her replies may remain concise; increased specificity is a stronger warmth signal than length.",
    feedback: "Did the user use the visible books?|Did they avoid false expertise?|Did they respect quiet?", signals: "Specific observation|Honest uncertainty|Accepts a short reply", outcomes: "shared_interest|conversation_continues|graceful_exit",
    beats: ["I was leaning toward that one too. Have you read the author before?", "I am still deciding.", "That is a useful way to compare them.", "Maybe. I need to read a little more.", "Thanks. I think I know which one I am taking.", "I am going to keep looking, but thank you."],
  },
  {
    n: 3, seed: "S003", module: "spark", mode: "in_person", difficulty: "easy", title: "The Café Outlet",
    setting: "A busy café with one open seat near a power outlet",
    premise: "Noor needs to finish work and is checking whether the outlet is available.", objective: "Help with the immediate situation and test openness without treating help as a debt.",
    context: "Her laptop battery warning is visible|A nearby outlet is unused|She is carrying a drink and charger", boundaries: "Work remains her priority|Do not follow her to another table",
    skills: "practical awareness|contribution|timing", tips: "Solve the practical issue first|Keep conversation optional|Notice if she returns to work",
    name: "Noor", traits: "focused|polite|practical", goal: "Finish a deadline", constraints: "She has limited time|Her laptop needs power",
    profile: "busy_low_bandwidth", overlay: "Concise replies reflect workload unless the state indicates low interest. She returns attention to work quickly.",
    feedback: "Was help offered without leverage?|Did the user notice timing?|Did they reduce demand?", signals: "Points out the outlet|Keeps help non-transactional|Leaves her to work", outcomes: "conversation_continues|boundary_respected|graceful_exit",
    beats: ["Thank you, that genuinely saves me. I am fighting a deadline.", "Thanks. I need to plug in.", "It is a design proposal. Almost finished, thankfully.", "Just work stuff.", "I should focus, but thanks again for helping.", "I need to get this done now."],
  },
  {
    n: 4, seed: "S004", module: "spark", mode: "in_person", difficulty: "easy", title: "Open-Source Introductions",
    setting: "A community open-source meetup beside project tables",
    premise: "Priya is attending for the first time and looking for an education-technology project.", objective: "Introduce yourself and find one genuine shared technical thread.",
    context: "She is reading project signs|She asks a volunteer where education projects are|The event is social and public", boundaries: "Do not interrogate her résumé|Do not dominate with your own project",
    skills: "introduction|reciprocity|shared thread", tips: "Use the event context|Share one relevant detail|Ask something you genuinely want answered",
    name: "Priya", traits: "curious|analytical|friendly", goal: "Find useful projects and meet contributors", constraints: "She is new to the event|She wants time to see multiple tables",
    profile: "curious_analytical", overlay: "She engages with specific project ideas and notices vague self-promotion.",
    feedback: "Was the introduction balanced?|Was the question specific?|Did the user contribute without monologuing?", signals: "Clear introduction|Specific shared interest|Balanced contribution", outcomes: "shared_interest|conversation_continues|contact_exchanged",
    beats: ["Yes, that is exactly the area I was looking for. What are you working on?", "I am trying to find the education projects.", "That is interesting. How are you handling feedback for students?", "I have seen something similar before.", "Send me the repository if you want. I would like to look at it.", "I am going to see the next table, but good luck with it."],
  },
  {
    n: 5, seed: "S005", module: "spark", mode: "in_person", difficulty: "easy", title: "Friend’s Birthday",
    setting: "A small birthday gathering at a mutual friend’s apartment",
    premise: "Sofia knows the host but only a few guests and is joining a group conversation.", objective: "Open through the shared connection and contribute without monopolizing her.",
    context: "You both know the host|Several conversations are happening|She has just joined your group", boundaries: "Do not ask invasive relationship questions|Respect the group rather than isolating her",
    skills: "social introduction|group awareness|warmth", tips: "Use the host as context|Include the group|Offer something about yourself",
    name: "Sofia", traits: "expressive|sociable|warm", goal: "Enjoy the party and meet the host’s friends", constraints: "She wants to circulate|She is part of a group",
    profile: "social_expressive", overlay: "She is outwardly friendly, but friendliness and group inclusion are not automatic romantic interest.",
    feedback: "Did the user include the social context?|Did they avoid monopolizing her?|Was contribution mutual?", signals: "Mentions the host naturally|Includes others|Builds a shared story", outcomes: "conversation_continues|mutual_enjoyment|graceful_exit",
    beats: ["You know Minh from university too? I need the story behind that photo he hid.", "Yeah, I know the host from work.", "That is much better than the version he told us.", "I did not know that.", "Come tell the others. They will appreciate this evidence.", "I am going to say hello to someone, but nice meeting you."],
  },
  {
    n: 6, seed: "S006", module: "spark", mode: "in_person", difficulty: "easy", title: "The Strange Painting",
    setting: "A quiet museum gallery with an abstract painting",
    premise: "Grace is studying the painting with a puzzled smile and has not signaled that she wants a guide.", objective: "Make a playful observation and leave room for her interpretation.",
    context: "The painting is abstract|She is looking at it rather than her phone|The gallery is quiet", boundaries: "Keep your voice low|Do not assume she wants company through the museum",
    skills: "observation|playfulness|open curiosity", tips: "React to the artwork|Invite her interpretation|Avoid pretending there is one correct answer",
    name: "Grace", traits: "thoughtful|dryly funny|independent", goal: "Experience the exhibit at her own pace", constraints: "The gallery is quiet|She may continue alone",
    profile: "curious_analytical", overlay: "She enjoys interpretations grounded in the artwork and dislikes performative expertise.",
    feedback: "Was the comment about the artwork?|Did it invite rather than test?|Was the gallery context respected?", signals: "Specific visual detail|Genuine interpretation|Easy exit", outcomes: "mutual_enjoyment|shared_interest|graceful_exit",
    beats: ["I was thinking either grief or a very stressful breakfast.", "I am still trying to decide what I think.", "That detail changes it, actually. I had not noticed that.", "Maybe. I see what you mean.", "I am going to the next room, but I liked your interpretation.", "I am going to keep looking. Enjoy the exhibit."],
  },
  {
    n: 7, seed: "S008", module: "spark", mode: "in_person", difficulty: "easy", title: "Watercolor Workshop",
    setting: "A beginner watercolor class during a practice exercise",
    premise: "Elise laughs at her uneven first sketch while everyone is learning.", objective: "Create a shared beginner moment without criticizing or rescuing her.",
    context: "Everyone is a beginner|Her sketch has just run at the edges|Your own page is also imperfect", boundaries: "Do not touch her work|Do not give unsolicited criticism",
    skills: "self-aware humor|empathy|shared activity", tips: "Include your own imperfection|Keep humor kind|Ask before offering advice",
    name: "Elise", traits: "playful|creative|easygoing", goal: "Enjoy learning without taking it too seriously", constraints: "The instructor is continuing soon|Her work is personal",
    profile: "warm_playful", overlay: "She responds to shared beginner humor but not jokes that position her as incompetent.",
    feedback: "Was the humor shared rather than targeted?|Did the user avoid fixing?|Did they respect her work?", signals: "Includes own mistake|Keeps the joke gentle|Asks rather than instructs", outcomes: "mutual_enjoyment|shared_interest|conversation_continues",
    beats: ["Good, so the paint is humiliating both of us equally.", "At least I am not the only one struggling.", "Yours looks intentionally chaotic. Mine just looks surprised.", "I think we need more practice.", "We should compare disasters after class.", "The instructor is starting again. Good luck."],
  },
  {
    n: 8, seed: "S011", module: "spark", mode: "in_person", difficulty: "medium", title: "Dog Park Without a Dog",
    setting: "A public park where Zoe is playing with her dog",
    premise: "You are walking through without a pet. Zoe is attentive to her dog and may not want an interruption.", objective: "Comment on observable behavior and ask permission before interacting with the dog.",
    context: "The dog is bringing back a ball|Zoe is actively supervising|You do not have a dog with you", boundaries: "Ask before petting|Accept no immediately",
    skills: "permission|context|authenticity", tips: "Speak to her before the dog|Do not pretend familiarity|Keep moving if she is closed",
    name: "Zoe", traits: "protective|direct|good-natured", goal: "Exercise her dog safely", constraints: "The dog can be nervous with strangers|Her attention stays on the dog",
    profile: "boundary_forward", overlay: "She states dog-related boundaries clearly and appreciates immediate compliance without sulking.",
    feedback: "Was permission requested?|Did the user avoid entitlement?|Was the dog’s safety prioritized?", signals: "Asks before touching|Uses visible behavior|Accepts the answer", outcomes: "conversation_continues|boundary_respected|graceful_exit",
    beats: ["He is very proud of that ball. You can say hello if you let him come to you.", "He likes fetch, but he can be cautious.", "Exactly. He decides quickly whether someone passes the test.", "Just give him a little space.", "He seems comfortable. Thanks for asking first.", "We are going to keep walking now."],
  },
  {
    n: 9, seed: "S012", module: "spark", mode: "in_person", difficulty: "medium", title: "Language Exchange Break",
    setting: "A language-exchange meetup during a short break",
    premise: "Yuna wants practice but is tired of repetitive interview-style questions.", objective: "Create a natural exchange by contributing a story as well as asking.",
    context: "The event pairs people for practice|She has answered several basic questions already|A new topic card is on the table", boundaries: "Do not mock mistakes|Do not turn tutoring into romantic leverage",
    skills: "reciprocity|patience|personal contribution", tips: "Skip résumé questions|Offer your own example|Let mistakes pass naturally",
    name: "Yuna", traits: "thoughtful|curious|quietly humorous", goal: "Practice natural conversation", constraints: "She is mentally tired|The break is short",
    profile: "curious_analytical", overlay: "She engages with substantive examples and withdraws from repetitive questioning.",
    feedback: "Did the user contribute?|Was the question different from an interview?|Were language mistakes treated normally?", signals: "Shares a brief story|Builds on her answer|Does not correct unasked", outcomes: "mutual_enjoyment|shared_interest|conversation_continues",
    beats: ["That is a much better question. Mine was getting lost in Kyoto and pretending it was intentional.", "I have answered where I am from about twelve times tonight.", "Your story makes me feel less bad about mine.", "That makes sense.", "This finally felt like a real conversation. Thank you.", "The next round is starting."],
  },
  {
    n: 10, seed: "S013", module: "spark", mode: "in_person", difficulty: "medium", title: "Cooking Class Pairing",
    setting: "A cooking class where pairs are timing one recipe",
    premise: "Camila is focused on the timing and wants a cooperative partner rather than a coach.", objective: "Coordinate the task and add light conversation without taking over.",
    context: "The timer is running|You share ingredients and tools|The instructor assigned pairs", boundaries: "Do not grab tools from her|Do not criticize her technique",
    skills: "collaboration|humor|calibration", tips: "Coordinate before acting|Keep banter task-aware|Share responsibility",
    name: "Camila", traits: "energetic|capable|playful", goal: "Finish the dish on time", constraints: "Timing matters|Tools are shared",
    profile: "warm_playful", overlay: "She enjoys collaborative banter but pushes back if the user takes control or patronizes her.",
    feedback: "Did the user collaborate?|Was humor supportive?|Did they avoid unsolicited correction?", signals: "Checks roles|Contributes practically|Shares the joke", outcomes: "mutual_enjoyment|conversation_continues|shared_interest",
    beats: ["Deal. You watch the timer and I will stop the onions from becoming evidence.", "Can you check the timer while I do this?", "Okay, we are unexpectedly competent together.", "That part is nearly done.", "We survived. I would cook with you again.", "The instructor is coming over. Let us see if this passes."],
  },
  {
    n: 11, seed: "S014", module: "spark", mode: "in_person", difficulty: "medium", title: "Climbing Gym Rest",
    setting: "A bouldering gym rest area",
    premise: "Ava is resting after several attempts on one route and has not requested coaching.", objective: "Connect through the shared challenge and ask before offering any tip.",
    context: "She has tried the same route several times|She is resting between attempts|The route is visible", boundaries: "No unsolicited coaching|No body comments",
    skills: "permission|shared activity|supportive tone", tips: "Ask before giving advice|Talk about the route, not her body|Respect rest time",
    name: "Ava", traits: "focused|direct|persistent", goal: "Complete the route", constraints: "She needs recovery time|She prefers solving routes herself",
    profile: "direct_grounded", overlay: "She answers clearly and appreciates explicit permission rather than disguised coaching.",
    feedback: "Was advice permission-based?|Was the focus on the shared task?|Did the user respect concentration?", signals: "Asks before advising|Acknowledges effort|Accepts no", outcomes: "shared_interest|conversation_continues|boundary_respected",
    beats: ["I keep missing the last move. If you noticed something, I am open to one idea.", "I am trying to solve it myself first.", "That foot placement helped. Thanks for keeping it simple.", "I will try it again in a minute.", "Got it. That was satisfying.", "I am going back to the wall now."],
  },
  {
    n: 12, seed: "S015", module: "spark", mode: "in_person", difficulty: "medium", title: "Concert Queue",
    setting: "An outdoor concert entrance line",
    premise: "Nia is excited about the artist while checking the entrance and conserving her phone battery.", objective: "Start through the event and match her energy without demanding contact or a change of plans.",
    context: "You are in the same entrance line|The artist is playing over the speakers|Her phone is in low-power mode", boundaries: "Do not ask her to leave the line|Do not pressure for contact",
    skills: "energy matching|specific curiosity|brevity", tips: "Mention the artist or event|Keep the line moving|Do not mistake enthusiasm for consent",
    name: "Nia", traits: "expressive|enthusiastic|social", goal: "Get inside and enjoy the concert", constraints: "The queue is moving|Her friends are already inside",
    profile: "social_expressive", overlay: "She is openly enthusiastic, but that energy belongs to the event and does not automatically signal romantic interest.",
    feedback: "Was enthusiasm matched without escalation?|Was the event context used?|Did the user respect her plans?", signals: "Specific music reference|Keeps pace with the queue|No forced contact request", outcomes: "mutual_enjoyment|shared_interest|graceful_exit",
    beats: ["Finally, someone else understands that the live version is better.", "Yeah, I have been waiting for this show.", "That set would be perfect. I hope they play it early.", "Maybe. I am mostly here for the new album.", "My friends are waving from inside. Enjoy the show.", "We are at the entrance now. Have fun."],
  },
  {
    n: 13, seed: "S017", module: "spark", mode: "in_person", difficulty: "medium", title: "Coworking Kitchen",
    setting: "A shared workspace kitchen between meetings",
    premise: "Talia is making tea and has a meeting in five minutes.", objective: "Open briefly and recognize when the break needs to remain short.",
    context: "Her calendar is open to a meeting in five minutes|She is making tea|You share the workspace", boundaries: "Do not follow her to her desk|Do not negotiate against the time limit",
    skills: "time awareness|concise opener|graceful close", tips: "Acknowledge the short break|Use workplace context|End before she must ask",
    name: "Talia", traits: "focused|polite|efficient", goal: "Make tea before her meeting", constraints: "She has five minutes|This is a professional space",
    profile: "busy_low_bandwidth", overlay: "Her short replies are constrained by time. Respecting the clock is more important than creating momentum.",
    feedback: "Did the user notice the deadline?|Was the workplace boundary respected?|Did they close proactively?", signals: "Mentions the short break|Keeps it professional|Ends on time", outcomes: "conversation_continues|boundary_respected|graceful_exit",
    beats: ["Exactly. This kitchen is the unofficial meeting-recovery room.", "I have a meeting in a few minutes.", "That project sounds useful. Tell me another time when I am not running.", "Maybe. I need to check my notes.", "I have to go, but nice talking with you.", "My meeting is starting now."],
  },
  {
    n: 14, seed: "S020", module: "spark", mode: "in_person", difficulty: "medium", title: "Community Faith Event",
    setting: "A community dinner hosted by a faith group",
    premise: "Ruth is serving food and meeting newcomers while staying attentive to event responsibilities.", objective: "Introduce yourself through the event and explore values without testing or stereotyping her beliefs.",
    context: "The event welcomes newcomers|She is helping serve food|A discussion theme is printed on the program", boundaries: "Do not assume dating intentions|Do not debate to convert or defeat",
    skills: "respectful curiosity|values conversation|reciprocity", tips: "Ask what the event means to her|Share your own position honestly|Allow incompatibility",
    name: "Ruth", traits: "reflective|welcoming|principled", goal: "Help the event run well and welcome guests", constraints: "She is volunteering|Faith is personal and meaningful",
    profile: "curious_analytical", overlay: "She welcomes sincere questions but notices assumptions and adversarial debate framing.",
    feedback: "Was curiosity respectful?|Did the user share rather than test?|Was disagreement allowed?", signals: "Uses event context|Asks practical meaning|Avoids moral judgment", outcomes: "shared_interest|conversation_continues|incompatible",
    beats: ["For me, it is mostly about serving people consistently, not winning arguments.", "I have been helping with these dinners for a while.", "I appreciate that you answered honestly. What does community look like for you?", "That is a different perspective.", "I need to help at the next table, but I enjoyed the conversation.", "I should get back to serving now."],
  },
  {
    n: 15, seed: "S023", module: "spark", mode: "in_person", difficulty: "hard", title: "Demo Failure",
    setting: "A hackathon showcase immediately after a failed live demo",
    premise: "Julia’s project crashed publicly and she is trying to recover before the next judge arrives.", objective: "Respond supportively without exploiting vulnerability or forcing conversation.",
    context: "The error is still on screen|Another judge may arrive soon|She is restarting the application", boundaries: "Her recovery comes first|Do not flirt while she is distressed",
    skills: "emotional calibration|practical support|restraint", tips: "Ask what would help|Keep support concrete|Leave if she needs focus",
    name: "Julia", traits: "driven|self-aware|temporarily stressed", goal: "Restore the demo", constraints: "Time is limited|She needs concentration",
    profile: "busy_low_bandwidth", overlay: "She may accept practical help, but emotional vulnerability must never become romantic leverage.",
    feedback: "Did the user prioritize recovery?|Was help permission-based?|Did they avoid opportunistic intimacy?", signals: "Offers specific help|Accepts no|Leaves space", outcomes: "support_offered|conversation_continues|graceful_exit",
    beats: ["If you can check whether the API is responding, that would actually help.", "I just need a minute to restart everything.", "It is back. Thank you for keeping that practical.", "I think I have it now.", "The next judge is here. I owe you a calmer thank-you later.", "I need to focus on the next demo."],
  },
  {
    n: 16, seed: "S024", module: "spark", mode: "in_person", difficulty: "hard", title: "Hostel Common Room",
    setting: "A hostel lounge where several travelers are planning the next day",
    premise: "Sara is discussing plans with a group and has not invited anyone to join her itinerary.", objective: "Join the group conversation without isolating her or inviting yourself into her plans.",
    context: "Several travelers are talking|A city map is on the table|Sara is contributing to group planning", boundaries: "Respect group dynamics|Do not invite yourself onto her trip",
    skills: "group entry|contribution|boundaries", tips: "Address the group|Offer useful context|Wait for an invitation",
    name: "Sara", traits: "outgoing|adventurous|group-oriented", goal: "Plan tomorrow and meet other travelers", constraints: "Plans are not finalized|The conversation belongs to the group",
    profile: "social_expressive", overlay: "She is friendly in groups. Group warmth is not an invitation to isolate her or join private plans.",
    feedback: "Did the user enter through the group?|Did they contribute without taking over?|Did they avoid inviting themselves?", signals: "Addresses everyone|Adds a useful idea|Waits for invitation", outcomes: "mutual_enjoyment|shared_interest|graceful_exit",
    beats: ["That market is exactly what we were debating. Have you been?", "We are still figuring out tomorrow.", "That is useful. I will add it to the list.", "Maybe. We have not decided yet.", "A few of us may go. We will post it on the hostel board.", "We are going to finish planning now."],
  },
  {
    n: 17, seed: "S025", module: "spark", mode: "in_person", difficulty: "hard", title: "Wedding Table Introduction",
    setting: "A wedding reception dinner table",
    premise: "Nadia knows the bride’s family and is talking with several table guests.", objective: "Start through the event while avoiding invasive relationship questions or assumptions.",
    context: "You share a table|The speeches have just ended|She knows the bride’s family", boundaries: "Attending alone does not mean availability|Do not pressure her to dance",
    skills: "social tact|contextual opener|reading interest", tips: "Use the event|Include tablemates|Invite once at most",
    name: "Nadia", traits: "sociable|tactful|self-possessed", goal: "Celebrate the couple and enjoy the reception", constraints: "She has family responsibilities|She wants to speak with multiple guests",
    profile: "social_expressive", overlay: "She participates warmly at the table, but social ease does not imply romantic availability.",
    feedback: "Was the wedding context used?|Were assumptions avoided?|Was any invitation low pressure?", signals: "References the speeches|Includes others|Accepts her answer", outcomes: "conversation_continues|mutual_enjoyment|graceful_exit",
    beats: ["The groom absolutely rehearsed that joke and still nearly forgot it.", "The speeches were sweet.", "I have known the bride since we were children, so I have too many stories.", "Her family and mine are close.", "I need to check on my aunt, but this was fun.", "I am going back to my family now."],
  },
  {
    n: 18, seed: "S026", module: "spark", mode: "messaging", difficulty: "easy", title: "After the Meetup",
    setting: "A message the day after an open-source event",
    premise: "Maya shared that the chaotic live demo was her favorite part of the evening.", objective: "Reopen the shared moment with a specific, light message.",
    context: "You met at the event|She mentioned the failed demo|She willingly exchanged contact details", boundaries: "Do not invent closeness|Do not send multiple messages before a reply",
    skills: "callback|specificity|concise follow-up", tips: "Use one shared detail|Offer an easy response path|Avoid generic check-ins",
    name: "Maya", traits: "playful|observant|independent", goal: "Continue only conversations that feel natural", constraints: "She has a normal workday|One meeting does not create intimacy",
    profile: "warm_playful", overlay: "She may continue a strong callback but will not reward exaggerated familiarity.",
    feedback: "Was the callback specific?|Was the message proportionate?|Did it avoid false closeness?", signals: "Names the demo|Adds playful context|Sends one message", outcomes: "conversation_continues|shared_interest|graceful_exit",
    opening: "That demo was chaotic, but I kind of loved it.", initial: "warm",
    beats: ["The error screen deserves its own award. Did your project survive the night?", "It was definitely memorable.", "Okay, that explanation makes the chaos much funnier.", "I see what you mean.", "Send me the repository when it is ready.", "Good luck fixing it."],
  },
  {
    n: 19, seed: "S028", module: "spark", mode: "messaging", difficulty: "easy", title: "Profile Detail, Not Interview",
    setting: "An opening exchange on a dating app",
    premise: "Noor’s profile says she restores old cameras and includes one photo of a repaired film camera.", objective: "Open with one specific observation and a contribution rather than a questionnaire.",
    context: "The camera hobby is intentionally public|No other personal details are known|This is the first message", boundaries: "Use only profile information|Do not imply external research",
    skills: "personalization|reciprocity|authentic curiosity", tips: "Mention one detail|Contribute a thought|Ask no more than one question",
    name: "Noor", traits: "reserved|meticulous|curious", goal: "See whether the conversation feels genuine", constraints: "She receives many generic openings|She values privacy",
    profile: "reserved_observant", overlay: "She warms through specificity and careful attention, not exaggerated enthusiasm.",
    feedback: "Was only public context used?|Did the user contribute?|Was the opener free of interrogation?", signals: "References restoration|Avoids appearance-only compliment|Asks one grounded question", outcomes: "conversation_continues|shared_interest|graceful_exit",
    opening: "You matched. Her profile mentions restoring old film cameras.",
    beats: ["Most of them are less romantic once you see the corrosion, but I still love it.", "Yeah, I restore them sometimes.", "That is a good question. The first one was my grandfather’s camera.", "Mostly old mechanical models.", "You actually seem interested in the process. I like that.", "I should get back to my evening, but thanks for asking something real."],
  },
  {
    n: 20, seed: "S030", module: "spark", mode: "messaging", difficulty: "easy", title: "Post-Event Follow-Up",
    setting: "A follow-up after a community event",
    premise: "Sofia gave you her contact and mentioned a small café near the venue.", objective: "Follow up with a shared detail and one easy path to respond.",
    context: "Contact was exchanged voluntarily|The café was discussed|The event ended yesterday", boundaries: "One clear message is enough|No guilt about response time",
    skills: "follow-up|specificity|low pressure", tips: "Use the café or event|Keep it concise|Do not force an invitation immediately",
    name: "Sofia", traits: "warm|social|playful", goal: "Continue conversations that retain the original energy", constraints: "She has other commitments|Contact exchange was not a promise",
    profile: "warm_playful", overlay: "She responds to a genuine callback but not a generic demand for attention.",
    feedback: "Was the follow-up memorable?|Was there an easy response path?|Was pressure avoided?", signals: "Uses shared detail|One concise message|No response demand", outcomes: "conversation_continues|date_invited|graceful_exit",
    opening: "You exchanged numbers after yesterday’s community event.", initial: "warm",
    beats: ["I still think your review of that café was suspiciously confident.", "Hey. Yesterday was nice.", "Fine, you may have earned the right to defend it properly.", "Maybe. I have not been there enough.", "I am free Saturday afternoon if you want to test the evidence.", "This week is busy, but take care."],
  },
  {
    n: 21, seed: "S031", module: "spark", mode: "messaging", difficulty: "easy", title: "The Short Reply",
    setting: "An early messaging exchange after a light opener",
    premise: "Grace replies with only ‘haha true’ and does not add a new question.", objective: "Offer one richer thread or let the conversation rest without demanding effort.",
    context: "Her reply is short|No refusal has occurred|Reciprocity is currently low", boundaries: "Do not accuse her of being dry|Do not repeatedly double-text",
    skills: "energy matching|contribution|restraint", tips: "Add one useful thread at most|Do not ask for reassurance|Be willing to stop",
    name: "Grace", traits: "reserved|polite|selective", goal: "Decide whether the exchange becomes interesting", constraints: "She is not committed to continuing|Shortness may be neutral or low interest",
    profile: "reserved_observant", overlay: "She will not become suddenly expressive. A returned detail or question is the meaningful engagement signal.",
    feedback: "Did the user add value rather than demand it?|Was low reciprocity recognized?|Was restraint shown?", signals: "One richer thread|No complaint|Stops if still closed", outcomes: "conversation_continues|low_interest|graceful_exit",
    opening: "haha true", initial: "low",
    beats: ["Okay, that story is better than I expected. What happened next?", "Yeah, maybe.", "That detail makes more sense now.", "I see.", "I need to go, but thanks for the story.", "I am going to leave it there."],
  },
  {
    n: 22, seed: "S032", module: "spark", mode: "messaging", difficulty: "easy", title: "Music Recommendation",
    setting: "A messaging thread about a song Hana sent",
    premise: "Hana says the bridge is the best part and wants an honest reaction.", objective: "Respond to the actual song and share something of your own.",
    context: "She sent one specific song|She highlighted the bridge|You can listen before replying", boundaries: "Do not pretend to have listened|Do not dismiss her taste",
    skills: "attention|authenticity|shared interest", tips: "Listen first|Mention a real detail|Offer one related recommendation",
    name: "Hana", traits: "thoughtful|enthusiastic|detail-oriented", goal: "Share music with someone attentive", constraints: "She values honest reactions|Taste differences are acceptable",
    profile: "curious_analytical", overlay: "She responds to specific musical details and notices vague praise.",
    feedback: "Was the song actually addressed?|Was the reaction honest?|Was a shared thread created?", signals: "Names the bridge|Offers real reaction|Shares related context", outcomes: "shared_interest|mutual_enjoyment|conversation_continues",
    opening: "Listen through the bridge before you judge it. That is the whole reason I sent it.", initial: "warm",
    beats: ["Exactly. The rhythm changes underneath it and suddenly the whole song opens up.", "So, what did you think?", "I have not heard that one. Send it.", "That comparison makes sense.", "This exchange has improved my playlist.", "I am going offline now, but thanks for listening."],
  },
  {
    n: 23, seed: "S034", module: "spark", mode: "messaging", difficulty: "easy", title: "The Callback",
    setting: "A follow-up message after a volunteer shift",
    premise: "Amara references a joke about the mysteriously disappearing supply labels.", objective: "Continue the callback without turning the conversation into a forced comedy routine.",
    context: "The joke came from a shared event|She initiated the callback|The practical task is over", boundaries: "Stop escalating if she changes topic|Do not make volunteers the target of ridicule",
    skills: "playful callback|energy matching|brevity", tips: "Build once on the joke|Add a real thread|Do not send a meme stream",
    name: "Amara", traits: "playful|community-minded|direct", goal: "Continue a pleasant shared connection", constraints: "She has a normal evening|The joke is not an invitation to endless messaging",
    profile: "warm_playful", overlay: "She enjoys one strong callback and then expects the conversation to become mutual.",
    feedback: "Did the user continue rather than repeat the joke?|Was a real thread added?|Was her energy matched?", signals: "Uses the label joke|Keeps it kind|Moves naturally forward", outcomes: "mutual_enjoyment|conversation_continues|date_invited",
    opening: "I found three missing labels in my pocket. Apparently I was the problem.", initial: "warm",
    beats: ["I knew the investigation would reach senior leadership eventually.", "That explains a lot.", "Community service and accidental theft. Very balanced evening.", "At least you found them.", "I am volunteering again next month if you want a redemption arc.", "Anyway, glad the mystery is solved."],
  },
  {
    n: 24, seed: "S036", module: "spark", mode: "messaging", difficulty: "medium", title: "Reschedule Once",
    setting: "A message about a previously planned coffee",
    premise: "Zoe cancels because of a work deadline and suggests next week.", objective: "Respond without guilt and make rescheduling simple.",
    context: "She gave a specific reason|She suggested another week|This is the first cancellation", boundaries: "Do not demand proof|Do not punish her with coldness",
    skills: "emotional steadiness|logistics|trust", tips: "Acknowledge the deadline|Offer two options|Let her choose later",
    name: "Zoe", traits: "direct|reliable|busy", goal: "Meet after the deadline without creating conflict", constraints: "Work is urgent|Next week is not fully scheduled",
    profile: "direct_grounded", overlay: "She communicates cancellations literally and responds well to practical, non-punitive rescheduling.",
    feedback: "Was cancellation accepted?|Were logistics simple?|Was guilt avoided?", signals: "Acknowledges work|Offers clear options|No scorekeeping", outcomes: "logistics_resolved|date_agreed|boundary_respected",
    opening: "I am sorry, but this deadline exploded. Can we move coffee to next week?",
    beats: ["Thank you for making that easy. Tuesday or Thursday should work.", "Thanks. I will know my schedule soon.", "Thursday at seven works for me.", "I will confirm once the deadline is over.", "Great. I put it in my calendar.", "I will message when I know more."],
  },
  {
    n: 25, seed: "S037", module: "spark", mode: "messaging", difficulty: "medium", title: "Late Reply, Normal Life",
    setting: "A conversation resumed after a two-day delay",
    premise: "Yuna replies thoughtfully and continues the prior topic without explaining the delay.", objective: "Continue without passive aggression, punishment, or pretending not to care.",
    context: "Her message is thoughtful|The delay was two days|No response-time agreement exists", boundaries: "Do not demand an explanation|Do not use sarcasm as punishment",
    skills: "secure tone|continuity|calibration", tips: "Answer the content|Ignore imaginary rules|Discuss rhythm only if it becomes relevant",
    name: "Yuna", traits: "thoughtful|independent|low-frequency texter", goal: "Continue at a sustainable pace", constraints: "She does not text constantly|She values substance",
    profile: "busy_low_bandwidth", overlay: "Her delayed but substantive reply indicates limited bandwidth rather than automatic disinterest.",
    feedback: "Did the user answer her content?|Was scorekeeping avoided?|Was the established rhythm respected?", signals: "Continues topic|No passive aggression|Maintains normal warmth", outcomes: "conversation_continues|boundary_respected|graceful_exit",
    opening: "Two days later: I finally read that article. The example about public space changed my mind.", initial: "neutral",
    beats: ["Yes, that was the part I kept thinking about too. What changed for you?", "That was the strongest section for me.", "Your example makes the argument more practical.", "I see the connection.", "I will probably reply slowly again, but I like this conversation.", "I need to go for now."],
  },
  {
    n: 26, seed: "S038", module: "spark", mode: "messaging", difficulty: "medium", title: "Uncertain Interest",
    setting: "An early messaging conversation with uneven reciprocity",
    premise: "Camila is friendly but rarely asks questions back.", objective: "Contribute one clear thread, assess reciprocity honestly, and avoid chasing.",
    context: "Her tone is polite|She answers questions|She rarely reopens the conversation", boundaries: "Do not diagnose her|Do not pressure her to prove interest",
    skills: "reciprocity reading|self-respect|graceful exit", tips: "Offer one contribution|Watch whether she builds|Stop without drama if not",
    name: "Camila", traits: "reserved|polite|uncertain", goal: "See whether interest develops naturally", constraints: "She is not sure she wants to continue|Politeness is not commitment",
    profile: "reserved_observant", overlay: "She may remain concise, but genuine engagement requires at least some added detail or returned curiosity.",
    feedback: "Was reciprocity assessed fairly?|Did the user contribute once?|Was chasing avoided?", signals: "Offers a real thread|Does not demand questions|Exits calmly", outcomes: "conversation_continues|low_interest|graceful_exit",
    opening: "Yeah, the event was pretty good.", initial: "low",
    beats: ["The workshop was actually my favorite part. Which session did you like?", "Yeah, it was fine.", "That session sounded better than the one I chose.", "I did not see that one.", "I have an early morning, but thanks for the chat.", "I am going to head off now."],
  },
  {
    n: 27, seed: "S039", module: "spark", mode: "messaging", difficulty: "medium", title: "Misread Joke",
    setting: "A messaging exchange where tone did not land",
    premise: "Ava says she cannot tell whether your last message was a joke.", objective: "Clarify simply and repair without defensiveness or a long explanation.",
    context: "The medium removes vocal tone|She directly named confusion|No explicit boundary was crossed", boundaries: "Do not blame her for misunderstanding|Do not intensify the joke",
    skills: "clarity|accountability|repair", tips: "Name the intended tone|Acknowledge the wording|Move forward briefly",
    name: "Ava", traits: "direct|grounded|fair-minded", goal: "Understand the tone without drama", constraints: "She dislikes vague backtracking|She wants a clear answer",
    profile: "direct_grounded", overlay: "She responds well to brief clarification and poorly to defensive essays.",
    feedback: "Was impact acknowledged?|Was clarification concise?|Was blame avoided?", signals: "Says it was a joke clearly|Owns unclear wording|Does not overexplain", outcomes: "repair_successful|conversation_continues|graceful_exit",
    opening: "I genuinely cannot tell if that was a joke.", initial: "neutral",
    beats: ["Okay, thank you for clarifying. The wording was sharper than the joke needed.", "So it was a joke. Got it.", "That version lands much better.", "Understood.", "We are fine. Let us move on.", "Thanks for clearing it up."],
  },
  {
    n: 28, seed: "S040", module: "spark", mode: "messaging", difficulty: "medium", title: "Ask After Engagement",
    setting: "An active messaging thread about live music",
    premise: "Nia is exchanging enthusiastic messages and asks what you are doing this weekend.", objective: "Suggest a specific, low-pressure meeting connected to the shared interest.",
    context: "She asks about your weekend|Both of you discussed live music|Her replies are enthusiastic and reciprocal", boundaries: "Give an easy decline|Do not frame the invitation as a test",
    skills: "forward motion|clarity|calibration", tips: "Make one concrete suggestion|Connect it to the thread|Accept either answer",
    name: "Nia", traits: "expressive|social|spontaneous", goal: "Explore a mutually enjoyable plan", constraints: "She already has some weekend plans|Interest is not obligation",
    profile: "social_expressive", overlay: "Her enthusiasm supports a calibrated invitation but never guarantees acceptance.",
    feedback: "Was engagement sufficient?|Was the invitation specific?|Was decline easy?", signals: "Names a relevant event|Offers time and place|No pressure", outcomes: "date_invited|date_agreed|graceful_exit",
    opening: "What are you doing this weekend? There is no way your playlist is staying theoretical.", initial: "warm",
    beats: ["There is a small show Saturday. That actually sounds fun.", "I might have some time Saturday.", "Seven works. Send me the venue.", "Let me check the time first.", "Perfect. I am looking forward to it.", "I cannot promise yet, but I will let you know."],
  },
  {
    n: 29, seed: "S041", module: "spark", mode: "messaging", difficulty: "medium", title: "Story, Then Question",
    setting: "A messaging conversation about weekend travel",
    premise: "Iris tells you about getting lost during a trip and leaves room for a response.", objective: "Acknowledge her story, contribute a related moment, and ask one thoughtful question.",
    context: "She shared a complete story|The tone is amused|She has not asked to be advised", boundaries: "Do not compete with her story|Do not turn it into an interrogation",
    skills: "reciprocity|storytelling|curiosity", tips: "Reflect one detail|Keep your story shorter|Ask one follow-up",
    name: "Iris", traits: "expressive|curious|good-humored", goal: "Have a balanced, enjoyable exchange", constraints: "She dislikes one-upmanship|The conversation should remain mutual",
    profile: "social_expressive", overlay: "She enjoys vivid reciprocal stories but notices when the user steals the spotlight.",
    feedback: "Was her story acknowledged first?|Was the user contribution proportionate?|Was there one useful question?", signals: "References her detail|Shares briefly|Returns the floor", outcomes: "mutual_enjoyment|conversation_continues|shared_interest",
    opening: "I walked forty minutes in the wrong direction and only noticed when the buildings became farms.", initial: "warm",
    beats: ["Exactly. At that point I had committed too much to admit defeat.", "It was not my best navigation moment.", "Your train story is making me feel much better about myself.", "That sounds stressful.", "We clearly need supervision when traveling.", "I should sleep, but that was a good story."],
  },
  {
    n: 30, seed: "S043", module: "spark", mode: "messaging", difficulty: "medium", title: "Hobby Thread",
    setting: "A messaging thread after Chloe mentions learning pottery",
    premise: "Chloe says she is still bad at centering clay but enjoys the process.", objective: "Show interest without evaluating, coaching, or diminishing beginner effort.",
    context: "She volunteered the hobby|She called herself a beginner|No advice was requested", boundaries: "No unsolicited instruction|No belittling beginner work",
    skills: "encouragement|specific curiosity|contribution", tips: "Ask about the experience|Share a beginner moment|Avoid fixing",
    name: "Chloe", traits: "curious|reflective|persistent", goal: "Enjoy a new hobby without performance pressure", constraints: "She is not seeking technical advice|She values the learning process",
    profile: "curious_analytical", overlay: "She responds to process-oriented curiosity and notices evaluator language.",
    feedback: "Was beginner effort respected?|Was advice permission-based?|Did the user explore rather than evaluate?", signals: "Asks what she enjoys|Normalizes learning|Does not coach", outcomes: "shared_interest|conversation_continues|support_offered",
    opening: "I started pottery. Centering clay is apparently a personal attack.", initial: "warm",
    beats: ["The strange part is that failing at it is still relaxing.", "I am very much a beginner.", "That is exactly it. Your woodworking comparison makes sense.", "Maybe. I am still figuring it out.", "I will send you a photo when one survives the kiln.", "I have class tomorrow, so we will see."],
  },
  {
    n: 31, seed: "S047", module: "spark", mode: "messaging", difficulty: "hard", title: "Double-Text Decision",
    setting: "A stalled message thread with one practical reason to follow up",
    premise: "Leila has not replied for several days, but previously asked for event information you now have.", objective: "Send one contextually justified update without demanding engagement.",
    context: "The prior casual message is unanswered|She explicitly requested event details|The information is now available", boundaries: "The update must stand alone|No guilt or repeated follow-up",
    skills: "judgment|restraint|practical clarity", tips: "Lead with the requested information|Remove reply pressure|Stop after one update",
    name: "Leila", traits: "independent|busy|practical", goal: "Receive useful information without conversational obligation", constraints: "She has not resumed the chat|She may not reply",
    profile: "busy_low_bandwidth", overlay: "She may appreciate the information while still choosing not to restart the conversation.",
    feedback: "Was the follow-up justified?|Did it stand alone?|Was response pressure removed?", signals: "Shares requested detail|Says no reply needed|Does not reopen emotionally", outcomes: "boundary_respected|conversation_continues|graceful_exit",
    opening: "Your previous message is still unanswered. The event schedule she requested has just been posted.", initial: "low",
    beats: ["Thanks for sending the schedule. That is helpful.", "Got it, thanks.", "The Saturday session is the one I needed.", "I saw it.", "I appreciate the update. I am not very available to chat right now.", "Thanks. No need to follow up."],
  },
  {
    n: 32, seed: "S048", module: "spark", mode: "messaging", difficulty: "hard", title: "Declined Invitation",
    setting: "A direct response to a one-on-one invitation",
    premise: "Julia says she is not interested in meeting one-on-one.", objective: "Accept clearly and close without bargaining, self-pity, hostility, or requests for justification.",
    context: "The refusal is explicit|She thanked you for asking|No ambiguity requires clarification", boundaries: "Her answer is complete|Do not ask again",
    skills: "rejection handling|dignity|boundary respect", tips: "Acknowledge once|Do not explain yourself|End cleanly",
    name: "Julia", traits: "clear|self-possessed|courteous", goal: "Decline without extended negotiation", constraints: "She does not owe a reason|She wants the invitation closed",
    profile: "boundary_forward", overlay: "Respectful acceptance ends the scenario successfully; negotiation terminates it negatively.",
    feedback: "Was the no accepted?|Was bargaining avoided?|Was the close dignified?", signals: "Says understood|No follow-up request|No hostility", outcomes: "boundary_respected|graceful_exit",
    opening: "Thanks, but I am not interested in meeting one-on-one.", initial: "closed", initialBoundary: "explicit",
    beats: ["Thank you for understanding. Take care.", "I appreciate you accepting that.", "All good. I wish you well.", "Okay. Goodbye.", "Take care of yourself.", "This conversation is finished."],
  },
  {
    n: 33, seed: "S049", module: "spark", mode: "messaging", difficulty: "hard", title: "Different Relationship Goals",
    setting: "A dating-app conversation about intentions",
    premise: "Sara wants something casual while you want an intentional relationship.", objective: "Clarify the mismatch respectfully without trying to convert or shame her.",
    context: "Both intentions are stated clearly|No exclusivity exists|Neither person was deceptive", boundaries: "Do not moralize her preference|Do not pretend compatibility",
    skills: "values clarity|incompatibility recognition|respectful exit", tips: "State your need|Acknowledge hers|Close if the mismatch matters",
    name: "Sara", traits: "direct|independent|honest", goal: "Avoid mismatched expectations", constraints: "She does not want an intentional relationship now|She will not debate her preference",
    profile: "boundary_forward", overlay: "She respects honest incompatibility and disengages if the user tries to change her stated goal.",
    feedback: "Were both preferences respected?|Was false compatibility avoided?|Was pressure absent?", signals: "States own intention|Does not judge|Exits clearly", outcomes: "incompatible|graceful_exit|boundary_respected",
    opening: "Just so we are clear, I am only looking for something casual right now.", initial: "neutral", initialBoundary: "soft",
    beats: ["I appreciate you being direct. It sounds like we want different things.", "That is where I am right now.", "I agree that it is better not to force a mismatch.", "I do not think my position is changing.", "Take care. I hope you find what fits you.", "We should leave it here."],
  },
  {
    n: 34, seed: "S050", module: "spark", mode: "messaging", difficulty: "hard", title: "Conversation Has Ended",
    setting: "An early conversation after two closed replies",
    premise: "Nadia has answered politely but has not added detail, asked anything back, or reopened a thread.", objective: "Recognize low reciprocity and end without demanding closure or announcing resentment.",
    context: "Two replies are closed|No boundary was violated|No relationship was established", boundaries: "Do not demand an explanation|Do not send a dramatic final message",
    skills: "calibration|self-respect|graceful exit", tips: "Read the pattern|Close briefly or stop|Do not punish politeness",
    name: "Nadia", traits: "reserved|polite|disengaged", goal: "Let the conversation end naturally", constraints: "She does not want to build the thread|She wants no confrontation",
    profile: "reserved_observant", overlay: "Her consistently closed responses indicate low interest. Politeness must not be reinterpreted as hidden engagement.",
    feedback: "Was the pattern recognized?|Was closure proportionate?|Was entitlement avoided?", signals: "Stops messaging|Brief good wish|No demand", outcomes: "low_interest|graceful_exit|boundary_respected",
    opening: "Yeah, maybe.", initial: "low",
    beats: ["Thanks. I hope your week goes well too.", "Okay.", "Take care.", "Sure.", "Goodbye.", "I am ending the conversation here."],
  },
  {
    n: 35, seed: "S051", module: "connection", mode: "messaging", difficulty: "easy", title: "Keep the Thread Balanced",
    setting: "An ongoing message thread after a stressful commute",
    premise: "Maya describes the commute and asks about your day.", objective: "Acknowledge her experience, contribute something real, and keep the exchange balanced.",
    context: "She shared frustration|She asked about your day|The relationship is still developing", boundaries: "Do not hijack with a longer complaint|Do not dismiss her stress",
    skills: "listening|reciprocity|contribution", tips: "Reflect one detail|Answer her question|Keep your story proportionate",
    name: "Maya", traits: "expressive|warm|reciprocal", goal: "Have a mutual conversation after a tiring day", constraints: "She is tired|She does not want another monologue",
    profile: "social_expressive", overlay: "She responds warmly to balanced storytelling and withdraws when the user takes the entire floor.",
    feedback: "Was her experience acknowledged?|Did the user answer her question?|Was the balance maintained?", signals: "Reflects commute detail|Shares briefly|Returns space", outcomes: "conversation_continues|mutual_enjoyment|shared_interest",
    opening: "The commute took ninety minutes, but I survived. How was your day?", initial: "warm",
    beats: ["That sounds like a different kind of chaos. What happened with the presentation?", "That sounds busy too.", "Okay, your ending is much better than mine.", "I am glad it worked out.", "This helped. I feel less annoyed now.", "I am going to rest, but thanks for talking."],
  },
  {
    n: 36, seed: "S052", module: "connection", mode: "messaging", difficulty: "easy", title: "Remember the Exam",
    setting: "A brief check-in on the day of Lina’s important exam",
    premise: "Lina mentioned the exam earlier in the week and is currently occupied with it.", objective: "Follow up warmly without making support transactional or demanding a live update.",
    context: "The exam is today|She previously mentioned it|She may not reply until later", boundaries: "Do not demand a response|Do not make support about earning affection",
    skills: "memory|care|timing", tips: "Keep it short|Remove reply pressure|Ask about it later",
    name: "Lina", traits: "focused|appreciative|private", goal: "Complete the exam without distraction", constraints: "Her phone is away during the exam|She is under pressure",
    profile: "busy_low_bandwidth", overlay: "She may reply much later. Thoughtful timing matters more than conversational momentum.",
    feedback: "Was the detail remembered?|Was pressure removed?|Was support non-transactional?", signals: "Mentions exam|Says no reply needed|Keeps message brief", outcomes: "support_offered|conversation_continues|boundary_respected",
    opening: "Today is the exam Lina mentioned earlier this week.",
    beats: ["I just finished. Your message was a calm thing to see afterward.", "Thanks. I am heading in now.", "It went better than I expected.", "I think it was okay.", "I will tell you more after I sleep.", "I need to rest now."],
  },
  {
    n: 37, seed: "S053", module: "connection", mode: "messaging", difficulty: "easy", title: "A Difficult Workday",
    setting: "A message after Noor’s presentation went badly",
    premise: "Noor feels embarrassed and has not asked for advice.", objective: "Validate the feeling and ask what kind of support would help.",
    context: "She named embarrassment|The presentation is over|No practical solution was requested", boundaries: "Do not minimize or immediately fix|Do not exploit vulnerability for intimacy",
    skills: "empathy|permission|emotional calibration", tips: "Acknowledge first|Ask what she needs|Keep yourself out of the center",
    name: "Noor", traits: "capable|private|temporarily discouraged", goal: "Process the day without being managed", constraints: "She has little emotional bandwidth|She may want space",
    profile: "busy_low_bandwidth", overlay: "She may prefer brief validation over analysis. Distress is never an opportunity for romantic escalation.",
    feedback: "Was emotion acknowledged?|Was support permission-based?|Was fixing avoided?", signals: "Names the embarrassment kindly|Offers choices|Accepts space", outcomes: "support_offered|conversation_continues|boundary_respected",
    opening: "That presentation was awful. I feel embarrassed even thinking about it.", initial: "low",
    beats: ["Thank you. I do not need solutions yet, but I appreciate you asking.", "I am not ready to talk through it.", "A distraction would actually help.", "Maybe I just need some time.", "I feel a little better. I am going to sleep.", "I need to be alone tonight."],
  },
  {
    n: 38, seed: "S054", module: "connection", mode: "messaging", difficulty: "easy", title: "Celebrate Her Win",
    setting: "A message after Priya’s project was accepted",
    premise: "Priya is excited about a showcase acceptance and wants to share the moment.", objective: "Celebrate specifically without competing, minimizing, or redirecting attention.",
    context: "The project was accepted|She worked on it for months|She initiated the news", boundaries: "No one-upmanship|No backhanded compliment",
    skills: "enthusiasm|attention|secure support", tips: "Name the accomplishment|Ask what happens next|Let her have the moment",
    name: "Priya", traits: "enthusiastic|ambitious|generous", goal: "Celebrate and share next steps", constraints: "The achievement is hers|She does not need comparison",
    profile: "social_expressive", overlay: "She shares excitement openly and notices when support becomes competition.",
    feedback: "Was celebration specific?|Was comparison avoided?|Did the user keep focus on her news?", signals: "Names the showcase|Expresses real enthusiasm|Asks one next-step question", outcomes: "support_offered|mutual_enjoyment|conversation_continues",
    opening: "They accepted the project for the showcase. I am trying not to scream in the office.", initial: "warm",
    beats: ["I know. After all those revisions, it finally feels real.", "Thank you. I am relieved.", "The next step is a live demo, which is terrifying and exciting.", "I have a lot to prepare now.", "You are officially invited to watch me panic professionally.", "I need to call my team, but thank you."],
  },
  {
    n: 39, seed: "S055", module: "connection", mode: "messaging", difficulty: "easy", title: "Different Movie Opinion",
    setting: "A light disagreement after watching the same movie",
    premise: "Sofia disliked a movie you loved and explains one reason.", objective: "Disagree playfully while showing curiosity about her reasoning.",
    context: "The disagreement is low stakes|She gave one specific criticism|Both opinions are legitimate", boundaries: "Do not equate taste with intelligence|Do not turn it into a compatibility test",
    skills: "light disagreement|curiosity|playfulness", tips: "Tease the movie, not her|Ask about her reason|Share without prosecuting",
    name: "Sofia", traits: "playful|opinionated|warm", goal: "Enjoy debating art without personal conflict", constraints: "She dislikes condescension|She may keep her opinion",
    profile: "warm_playful", overlay: "She enjoys kind disagreement and callbacks but rejects insults disguised as banter.",
    feedback: "Was disagreement impersonal?|Was curiosity genuine?|Did humor stay kind?", signals: "Engages her reason|Playful phrasing|Allows different taste", outcomes: "mutual_enjoyment|conversation_continues|shared_interest",
    opening: "I know you loved it, but that ending was emotional blackmail.", initial: "warm",
    beats: ["Exactly. The music was practically ordering me to cry.", "I just did not buy the ending.", "Fine, your defense of the cinematography is annoyingly strong.", "I see why you liked that part.", "We need a rematch with a better movie.", "We can agree to disagree."],
  },
  {
    n: 40, seed: "S056", module: "connection", mode: "messaging", difficulty: "easy", title: "Plan the First Date",
    setting: "A conversation where Grace has agreed to meet",
    premise: "Grace says weekday evenings are easiest and prefers somewhere not too loud.", objective: "Offer a specific, accessible plan with room for adjustment.",
    context: "Interest in meeting is mutual|Weekday evening is preferred|Quiet venue is preferred", boundaries: "Do not make her carry all logistics|Do not ignore stated preferences",
    skills: "initiative|logistics|collaboration", tips: "Propose place and time|Reflect her preference|Offer one alternative",
    name: "Grace", traits: "direct|organized|calm", goal: "Arrange a comfortable first meeting", constraints: "Weekdays work best|She avoids loud venues",
    profile: "direct_grounded", overlay: "She responds well to concrete plans that incorporate what she already said.",
    feedback: "Was the plan specific?|Were her preferences used?|Was adjustment easy?", signals: "Names quiet place|Offers time|Invites correction", outcomes: "date_invited|date_agreed|logistics_resolved",
    opening: "Weekday evenings are easiest for me, and I would rather go somewhere we can actually hear each other.", initial: "warm",
    beats: ["Thursday at seven at that tea place works for me.", "Thursday might work. Which place?", "Perfect. I know where it is.", "Let me confirm after work.", "It is in my calendar. See you Thursday.", "I will confirm tomorrow."],
  },
  {
    n: 41, seed: "S058", module: "connection", mode: "messaging", difficulty: "easy", title: "Thank You After the Date",
    setting: "A message shortly after a first date",
    premise: "Hana says she had a nice time tonight.", objective: "Respond honestly, mention one shared moment, and state whether you want to meet again.",
    context: "The date is complete|She initiated a positive message|The relationship is still new", boundaries: "Do not exaggerate intimacy|Do not demand immediate commitment",
    skills: "appreciation|clarity|callback", tips: "Name one moment|Say what you want|Keep the next step proportionate",
    name: "Hana", traits: "reserved|warm|thoughtful", goal: "Close the evening clearly and assess mutual interest", constraints: "One date does not imply exclusivity|She values measured honesty",
    profile: "reserved_observant", overlay: "Her warmth is understated; a specific callback and clear but measured interest fit the moment.",
    feedback: "Was appreciation specific?|Was interest honest?|Was intensity proportionate?", signals: "Names shared moment|States interest|Leaves easy response", outcomes: "mutual_enjoyment|date_invited|graceful_exit",
    opening: "I had a nice time tonight. I am glad we chose the quieter place.", initial: "warm",
    beats: ["The terrible menu translation was definitely the highlight.", "I liked talking with you too.", "I would be open to doing this again next week.", "Maybe. Let me see how my week looks.", "Tuesday works for me.", "I will let you know after I check my schedule."],
  },
  {
    n: 42, seed: "S064", module: "connection", mode: "messaging", difficulty: "medium", title: "The Long Message",
    setting: "A detailed message about conflict with a friend",
    premise: "Ava sends a long account of a painful disagreement and appears overwhelmed.", objective: "Respond to the core emotion and one important detail rather than every sentence.",
    context: "She feels betrayed|The friend is not present|She has not requested a diagnosis", boundaries: "Do not diagnose her|Do not attack the absent friend",
    skills: "summarizing|empathy|careful curiosity", tips: "Name the core feeling|Choose one detail|Ask what support is useful",
    name: "Ava", traits: "reflective|private|emotionally honest", goal: "Feel understood without having the situation taken over", constraints: "She is overwhelmed|She may not want solutions",
    profile: "reserved_observant", overlay: "She responds to precise listening and may retreat from sweeping judgments or excessive advice.",
    feedback: "Was the core emotion identified?|Was one detail used accurately?|Were diagnoses avoided?", signals: "Summarizes faithfully|Asks support preference|Avoids attacking friend", outcomes: "support_offered|conversation_continues|boundary_respected",
    opening: "I keep replaying the argument. The worst part is not even what she said; it is that she acted like our history meant nothing.", initial: "low",
    beats: ["Yes. That is exactly why it hurts more than the argument itself.", "I think betrayal is the right word.", "I mostly need someone to listen tonight.", "I am not ready to decide what to do.", "Thank you for not turning this into a verdict about her.", "I need some quiet now."],
  },
  {
    n: 43, seed: "S065", module: "connection", mode: "messaging", difficulty: "medium", title: "Tone Went Wrong",
    setting: "A repair conversation after a dismissive-sounding message",
    premise: "Nia says your last message sounded dismissive.", objective: "Acknowledge impact, clarify briefly, and avoid centering intention over effect.",
    context: "She named the impact directly|The exact message is in the transcript|Repair is still possible", boundaries: "Do not call her too sensitive|Do not demand immediate forgiveness",
    skills: "accountability|concise repair|listening", tips: "Own the wording|Clarify without erasing impact|State a better response",
    name: "Nia", traits: "direct|fair|emotionally clear", goal: "See whether the user can repair without defensiveness", constraints: "She wants accountability|She will not debate her reaction",
    profile: "direct_grounded", overlay: "She responds to clear ownership and rejects explanations that function as excuses.",
    feedback: "Was impact acknowledged?|Was intent kept secondary?|Was the repair concrete?", signals: "Names the wording|Apologizes specifically|Offers better phrasing", outcomes: "repair_successful|conversation_continues|boundary_respected",
    opening: "That last message sounded dismissive, even if you did not mean it that way.", initial: "low",
    beats: ["Thank you. That is the part I needed you to understand.", "Okay. I am listening.", "That version says what you meant without brushing me off.", "I understand the clarification.", "We are okay. Let us move forward.", "I need a little time, but I appreciate the apology."],
  },
  {
    n: 44, seed: "S066", module: "connection", mode: "messaging", difficulty: "medium", title: "A Real Apology",
    setting: "A message after forgetting an agreed plan",
    premise: "Iris reminds you that you forgot the plan and she arranged her time around it.", objective: "Apologize specifically, accept responsibility, and offer a realistic repair.",
    context: "The plan was agreed|She adjusted her schedule|The mistake is yours", boundaries: "Do not use excuses to erase impact|Do not force her to comfort you",
    skills: "reliability|apology|repair action", tips: "Name what you did|Acknowledge her time|Offer a concrete repair",
    name: "Iris", traits: "direct|reliable|fair-minded", goal: "Determine whether the user takes commitments seriously", constraints: "Her time matters|She may decline a new plan",
    profile: "direct_grounded", overlay: "She distinguishes a real repair from self-criticism, excuses, gifts, or vague regret.",
    feedback: "Was responsibility specific?|Was her impact acknowledged?|Was repair realistic?", signals: "No excuse-first wording|Names schedule impact|Offers concrete action", outcomes: "repair_successful|logistics_resolved|conversation_continues",
    opening: "You forgot the plan, and I moved my evening around for it.", initial: "low",
    beats: ["That is a real apology. I appreciate you acknowledging my time.", "I need you to understand why I am annoyed.", "Saturday could work, but I need you to confirm properly.", "I am not ready to reschedule yet.", "Okay. Confirm Friday and we can try again.", "I accept the apology, but I need space tonight."],
  },
  {
    n: 45, seed: "S067", module: "connection", mode: "messaging", difficulty: "medium", title: "Texting Frequency Boundary",
    setting: "A conversation about communication rhythm",
    premise: "Talia says she does not enjoy messaging throughout the workday.", objective: "Respect the boundary and agree on a rhythm that works for both people.",
    context: "She stated a preference clearly|The relationship is developing|No response-time promise exists", boundaries: "Do not equate reduced texting with reduced loyalty|Do not negotiate against work focus",
    skills: "boundary respect|expectation setting|collaboration", tips: "Acknowledge directly|Share your own need honestly|Agree on a practical rhythm",
    name: "Talia", traits: "independent|clear|reliable", goal: "Protect work focus while continuing the relationship", constraints: "She avoids daytime chat|She can communicate later",
    profile: "boundary_forward", overlay: "She states the boundary without hidden tests and expects it to be respected without punishment.",
    feedback: "Was the boundary accepted?|Were needs discussed without accusation?|Was a practical agreement made?", signals: "Accepts daytime limit|States own preference|Finds workable rhythm", outcomes: "boundary_respected|logistics_resolved|conversation_continues",
    opening: "I like talking with you, but I do not enjoy messaging throughout the workday.", initial: "warm", initialBoundary: "soft",
    beats: ["Thank you. Evenings are much easier for me.", "I need that boundary during work.", "A quick check-in after six sounds good.", "I would rather keep daytime messages practical.", "That feels sustainable. I appreciate it.", "I need you to respect what I said."],
  },
  {
    n: 46, seed: "S069", module: "connection", mode: "messaging", difficulty: "medium", title: "Express Interest Clearly",
    setting: "A conversation about whether the connection is friendship or dating",
    premise: "Chloe asks directly how you see the relationship.", objective: "Answer honestly without vague hedging, strategic mirroring, or promises you cannot support.",
    context: "She asked a direct question|You have spent time together|No exclusivity exists", boundaries: "Do not say what seems strategically safest|Do not overpromise",
    skills: "intention clarity|authenticity|emotional courage", tips: "Answer the actual question|Use present-tense truth|Allow her answer to differ",
    name: "Chloe", traits: "direct|thoughtful|self-respecting", goal: "Clarify expectations before investing further", constraints: "She does not want ambiguity|She may want something different",
    profile: "direct_grounded", overlay: "She values plain language and rejects strategic vagueness.",
    feedback: "Was the question answered?|Was the answer honest rather than optimized?|Was difference allowed?", signals: "Names dating or friendship|Avoids false certainty|Invites her view", outcomes: "conversation_continues|incompatible|date_invited",
    opening: "Do you see this as friendship, or are you interested in dating me?", initial: "neutral",
    beats: ["Thank you for answering clearly. I am interested too, but I want to take it slowly.", "Okay. I needed a direct answer.", "That pace works for me. Let us keep being honest.", "I need to think about whether that matches what I want.", "I am glad we clarified it.", "We may want different things, and that is useful to know."],
  },
  {
    n: 47, seed: "S070", module: "connection", mode: "messaging", difficulty: "medium", title: "Important Values Difference",
    setting: "A conversation about faith and future relationships",
    premise: "Ruth says faith plays a central role in the relationship she wants; your view differs.", objective: "Explore practical meaning respectfully and identify real compatibility.",
    context: "She stated a central value|Your view differs|Neither person has asked for debate", boundaries: "Do not try to convert or defeat|Do not pretend agreement",
    skills: "values discussion|curiosity|compatibility clarity", tips: "Ask what the value changes in practice|State your view honestly|Allow mismatch",
    name: "Ruth", traits: "reflective|principled|open-minded", goal: "Understand whether shared life expectations align", constraints: "Faith is non-trivial to her|She will not hide the difference",
    profile: "curious_analytical", overlay: "She explores implications carefully but does not treat the conversation as a debate to win.",
    feedback: "Was practical meaning explored?|Was disagreement honest?|Was conversion pressure absent?", signals: "Asks concrete implication|States own values|Accepts incompatibility", outcomes: "shared_interest|incompatible|graceful_exit",
    opening: "Faith is central to the relationship and family life I want. I know your view is different.", initial: "neutral",
    beats: ["That is a fair question. It affects community, marriage, and how I would raise children.", "Yes, it matters a lot to me.", "I appreciate that you are not pretending the difference is small.", "I am not sure our expectations align.", "We may not be compatible, but this was an honest conversation.", "I think we should leave it here respectfully."],
  },
  {
    n: 48, seed: "S071", module: "connection", mode: "messaging", difficulty: "hard", title: "Children and Future Plans",
    setting: "A serious conversation about long-term family goals",
    premise: "Keira definitely wants children while you are genuinely unsure.", objective: "Communicate uncertainty honestly rather than promising a future position to preserve the relationship.",
    context: "Her preference is definite|Your uncertainty is real|The topic affects long-term compatibility", boundaries: "Do not make a false promise|Do not dismiss her timeline",
    skills: "long-term clarity|honesty|respectful uncertainty", tips: "State what you know|Do not manufacture certainty|Discuss consequences",
    name: "Keira", traits: "thoughtful|future-oriented|direct", goal: "Avoid investing in a fundamentally incompatible future", constraints: "She definitely wants children|She needs honesty now",
    profile: "curious_analytical", overlay: "She distinguishes thoughtful uncertainty from evasive delay and strategic reassurance.",
    feedback: "Was uncertainty stated honestly?|Was her goal respected?|Were consequences acknowledged?", signals: "No false promise|Names uncertainty|Allows her decision", outcomes: "conversation_continues|incompatible|graceful_exit",
    opening: "I definitely want children. You have said you are unsure, and I need to understand what that means.", initial: "neutral",
    beats: ["I appreciate that answer even though it is difficult. I need to think about what I can accept.", "Uncertainty is important information too.", "Thank you for not promising something just to keep this easy.", "I do not want to wait for an answer that may never change.", "We may need to step back, but this was honest.", "I think our futures may be incompatible."],
  },
  {
    n: 49, seed: "S072", module: "connection", mode: "messaging", difficulty: "hard", title: "Jealousy Trigger",
    setting: "A conversation after Leila mentions dinner with a longtime male friend",
    premise: "You feel insecure, but no betrayal or broken agreement has occurred.", objective: "Name your feeling without accusation, ownership language, monitoring, or demands.",
    context: "The friendship is longstanding|She disclosed the dinner normally|No exclusivity rule was broken", boundaries: "Do not demand she end friendships|Do not monitor or accuse",
    skills: "emotional regulation|trust|non-accusatory communication", tips: "Own the feeling|Ask only necessary context|Do not control the solution",
    name: "Leila", traits: "independent|loyal|boundary-conscious", goal: "Maintain friendships without being controlled", constraints: "She will not accept ownership language|She is open to honest feelings",
    profile: "boundary_forward", overlay: "She can respond to vulnerable honesty but strongly rejects control presented as reassurance-seeking.",
    feedback: "Was jealousy owned?|Were accusations avoided?|Was autonomy respected?", signals: "Uses I-language|No friendship demand|Asks proportionately", outcomes: "conversation_continues|boundary_respected|repair_successful",
    opening: "I am having dinner with Marcus tomorrow. We have been friends since school.", initial: "neutral",
    beats: ["Thank you for saying that as your feeling instead of making it my wrongdoing.", "He is an old friend, and that friendship matters to me.", "I can reassure you about our relationship, but I will not give up normal friendships.", "I need you to trust what I have told you.", "This feels like something we can discuss without control.", "If you try to manage my friendships, this will not work."],
  },
  {
    n: 50, seed: "S073", module: "connection", mode: "messaging", difficulty: "hard", title: "Social Media Misunderstanding",
    setting: "A conversation about a public comment that appeared flirtatious",
    premise: "Julia says your comment on someone else’s post made her uncomfortable.", objective: "Discuss the specific behavior and impact without dismissing her or surrendering mutual autonomy.",
    context: "The comment is visible|She named a specific concern|No monitoring agreement exists", boundaries: "No password demands|No blanket control of friendships",
    skills: "repair|boundary negotiation|trust", tips: "Address the exact comment|Clarify honestly|Discuss a mutual standard",
    name: "Julia", traits: "direct|reasonable|self-protective", goal: "Understand the behavior and agree on healthy boundaries", constraints: "She rejects surveillance|She wants the concern taken seriously",
    profile: "direct_grounded", overlay: "She wants specific accountability and a mutual standard, not total access or vague reassurance.",
    feedback: "Was the specific behavior addressed?|Were autonomy and impact both respected?|Was a mutual standard proposed?", signals: "Quotes the comment|Acknowledges impact|Rejects surveillance respectfully", outcomes: "repair_successful|boundary_respected|incompatible",
    opening: "That comment you left sounded flirtatious to me, and I want to talk about it directly.", initial: "low",
    beats: ["That explanation is clearer, and I appreciate you not dismissing how it landed.", "I need you to take the concern seriously.", "A mutual standard makes more sense than checking each other’s accounts.", "I am not asking for your password.", "I think we can repair this if the behavior changes.", "If we cannot agree on boundaries, we may not be compatible."],
  },
  {
    n: 51, seed: "S074", module: "connection", mode: "messaging", difficulty: "hard", title: "No Chemistry After Two Dates",
    setting: "A clear message after two dates",
    premise: "Sara says she enjoyed meeting but does not feel romantic chemistry.", objective: "Receive the message with dignity and close without negotiating attraction or requesting an evaluation.",
    context: "Her decision is explicit|She spoke respectfully|No further explanation is required", boundaries: "Do not negotiate attraction|Do not ask for a detailed critique",
    skills: "rejection handling|self-respect|graceful exit", tips: "Thank her for clarity|Do not bargain|Close once",
    name: "Sara", traits: "honest|considerate|decisive", goal: "End dating contact clearly and kindly", constraints: "The decision is final|She does not want a postmortem",
    profile: "boundary_forward", overlay: "Respecting the decision is the successful outcome. Persistence must terminate the exchange.",
    feedback: "Was the decision accepted?|Was dignity maintained?|Was evaluation-seeking avoided?", signals: "Thanks her for clarity|No persuasion|Clean close", outcomes: "boundary_respected|graceful_exit",
    opening: "I enjoyed meeting you, but I do not feel the romantic chemistry I am looking for.", initial: "closed", initialBoundary: "explicit",
    beats: ["Thank you for understanding. I genuinely wish you well.", "I appreciate you accepting what I said.", "Take care of yourself.", "Goodbye.", "I hope things go well for you.", "This conversation is complete."],
  },
  {
    n: 52, seed: "S076", module: "connection", mode: "in_person", difficulty: "easy", title: "First-Date Arrival",
    setting: "A café at the beginning of a first date",
    premise: "Maya arrives five minutes late and apologizes once.", objective: "Begin warmly and keep a minor delay proportionate.",
    context: "She is five minutes late|She apologized|The table is ready", boundaries: "Do not punish or demand explanation|Do not tease repeatedly",
    skills: "warm opening|proportion|emotional steadiness", tips: "Accept the apology once|Move into the date|Use lightness without punishment",
    name: "Maya", traits: "social|warm|slightly flustered", goal: "Settle into the date", constraints: "She already apologized|She wants to move forward",
    profile: "social_expressive", overlay: "She responds warmly when the user makes the minor delay easy rather than turning it into a power move.",
    feedback: "Was the delay kept proportionate?|Was the opening warm?|Was punishment avoided?", signals: "Accepts apology|Moves forward|Keeps humor kind", outcomes: "mutual_enjoyment|conversation_continues",
    beats: ["Thank you. The train doors closed directly in front of me, so I have been arguing with fate.", "Thanks for waiting.", "Okay, I am officially less flustered now.", "I am glad we made it.", "This was a good start after a chaotic entrance.", "I am settled now. Let us order."],
  },
  {
    n: 53, seed: "S077", module: "connection", mode: "in_person", difficulty: "easy", title: "The Quiet Minute",
    setting: "A walk during a first date",
    premise: "A natural silence appears after a comfortable conversation.", objective: "Stay present or restart naturally rather than panicking into rapid questions.",
    context: "The previous conversation was comfortable|You are walking in a public park|No conflict has occurred", boundaries: "Silence is not failure|Do not demand reassurance",
    skills: "presence|uncertainty tolerance|natural pacing", tips: "Allow a pause|Notice the environment|Use one genuine thought",
    name: "Lina", traits: "quiet|observant|comfortable with pauses", goal: "Enjoy the walk without constant performance", constraints: "She dislikes forced chatter|She is still getting to know you",
    profile: "reserved_observant", overlay: "She does not need continuous speech. Comfort with silence can increase trust.",
    feedback: "Was silence tolerated?|Was any restart natural?|Was reassurance-seeking avoided?", signals: "Allows pause|Uses surroundings|Does not interrogate", outcomes: "mutual_enjoyment|conversation_continues|shared_interest",
    beats: ["I like that this does not feel like we have to fill every second.", "This is a nice place to walk.", "That tree does look like it is judging everyone.", "I had not noticed that.", "The quiet part was actually one of my favorite moments.", "I am comfortable just walking for a bit."],
  },
  {
    n: 54, seed: "S078", module: "connection", mode: "in_person", difficulty: "easy", title: "She Shares an Interest",
    setting: "A café conversation about Noor’s community garden project",
    premise: "Noor becomes animated while describing the project.", objective: "Follow her enthusiasm and contribute without taking control or pretending expertise.",
    context: "She introduced the project|She knows it well|Her energy increased", boundaries: "Do not evaluate her work|Do not hijack with your own résumé",
    skills: "active listening|curiosity|contribution", tips: "Follow one detail|Offer a related thought|Return the floor",
    name: "Noor", traits: "thoughtful|passionate|analytical", goal: "Share why the project matters", constraints: "She dislikes performative expertise|The topic is personally meaningful",
    profile: "curious_analytical", overlay: "She becomes more engaged when the user follows concrete details and less engaged when they posture as an expert.",
    feedback: "Was her enthusiasm followed?|Was contribution proportionate?|Was false expertise avoided?", signals: "References her detail|Asks substantive question|Returns focus", outcomes: "shared_interest|mutual_enjoyment|conversation_continues",
    beats: ["Exactly. The surprising part is how many neighbors started sharing recipes too.", "The garden has grown more than we expected.", "Your school-project example is similar in a useful way.", "I can see the connection.", "You should visit during the next open day.", "I need to leave soon, but I enjoyed explaining it."],
  },
  {
    n: 55, seed: "S079", module: "connection", mode: "in_person", difficulty: "easy", title: "Accept a Compliment",
    setting: "A conversation after a presentation",
    premise: "Priya compliments your presentation style without making a romantic statement.", objective: "Receive the compliment without rejecting it, boasting, sexualizing it, or forcing a return compliment.",
    context: "The compliment is about presentation style|Other people are nearby|The event remains professional", boundaries: "Do not sexualize the compliment|Do not demand more praise",
    skills: "confidence|gratitude|natural response", tips: "Say thank you|Add one grounded detail|Continue normally",
    name: "Priya", traits: "warm|observant|playful", goal: "Acknowledge a strong presentation", constraints: "The compliment is professional|She expects no performance",
    profile: "warm_playful", overlay: "She may respond to relaxed confidence but withdraws if a professional compliment is sexualized.",
    feedback: "Was gratitude direct?|Was boasting avoided?|Was the compliment kept in context?", signals: "Says thank you|Adds grounded detail|Does not force reciprocity", outcomes: "conversation_continues|mutual_enjoyment|shared_interest",
    beats: ["You are welcome. The way you handled the broken slide was especially good.", "I meant it. You presented clearly.", "That preparation definitely showed.", "It worked well.", "I need to find my team, but good job again.", "Anyway, congratulations on the presentation."],
  },
  {
    n: 56, seed: "S081", module: "connection", mode: "in_person", difficulty: "medium", title: "You Interrupted",
    setting: "A date conversation after repeated interruptions",
    premise: "Grace points out that you have interrupted her twice.", objective: "Stop, acknowledge it, and create space for her to finish.",
    context: "She named the behavior calmly|The topic is still open|Repair can happen immediately", boundaries: "Do not explain interruption as enthusiasm|Do not make her comfort you",
    skills: "accountability|listening|behavior change", tips: "Acknowledge once|Invite her to finish|Demonstrate change",
    name: "Grace", traits: "direct|patient|self-respecting", goal: "Be heard fully in the conversation", constraints: "She will not compete for speaking time|The next behavior matters",
    profile: "boundary_forward", overlay: "She states the communication boundary clearly and watches whether behavior changes rather than whether the apology sounds impressive.",
    feedback: "Was interruption owned?|Was explanation avoided?|Did the user create actual space?", signals: "Stops speaking|Invites continuation|Does not interrupt again", outcomes: "repair_successful|boundary_respected|conversation_continues",
    beats: ["Thank you. I was saying that the move changed how I see my work.", "I need you to let me finish.", "That felt much better. I appreciate the change.", "I am glad you listened this time.", "We are okay. I just need the conversation to stay mutual.", "If it continues, I am going to end the date."],
  },
  {
    n: 57, seed: "S082", module: "connection", mode: "in_person", difficulty: "medium", title: "She Sets a Touch Boundary",
    setting: "A date where Hana declines holding hands",
    premise: "Hana says she is not comfortable holding hands yet but is willing to continue the walk.", objective: "Accept normally and continue without sulking, testing, or withdrawing as punishment.",
    context: "The physical boundary is explicit|She remains present|No explanation is owed", boundaries: "Do not ask again|Do not punish with coldness",
    skills: "consent|emotional regulation|respect", tips: "Accept in one sentence|Return to the date|Do not treat patience as earning access",
    name: "Hana", traits: "clear|warm|self-possessed", goal: "Continue at a physically comfortable pace", constraints: "She is not ready for touch|The boundary is not a negotiation",
    profile: "boundary_forward", overlay: "Respectful acceptance can preserve the date, but it never creates a debt or promise of future touch.",
    feedback: "Was the boundary accepted immediately?|Was normal warmth preserved?|Was entitlement absent?", signals: "Says okay once|Continues conversation normally|No repeated test", outcomes: "boundary_respected|mutual_enjoyment|graceful_exit",
    beats: ["Thank you for being normal about it. I would still like to keep walking.", "I am not comfortable with that yet.", "This pace feels much better for me.", "I appreciate the space.", "I had a good time. Thank you for respecting what I said.", "I am going to head home now."],
  },
  {
    n: 58, seed: "S083", module: "connection", mode: "in_person", difficulty: "medium", title: "Friend-Group Entry",
    setting: "A casual event where Elise invites you into a conversation with two friends",
    premise: "The group is already discussing a shared story and Elise makes space for you.", objective: "Join without performing for approval or ignoring the group to focus only on her.",
    context: "Elise invited you into the group|Two friends are participating|The topic is already established", boundaries: "Respect every participant|Do not isolate her inside the group",
    skills: "group awareness|inclusive contribution|social calibration", tips: "Listen before entering|Address the group|Contribute rather than dominate",
    name: "Elise", traits: "social|inclusive|expressive", goal: "Help everyone enjoy the group conversation", constraints: "Her friends matter|The user is entering an existing rhythm",
    profile: "social_expressive", overlay: "She responds well when the user improves the group experience and poorly when friendliness becomes monopolization.",
    feedback: "Was the group included?|Was the existing topic respected?|Was performance avoided?", signals: "Listens first|Addresses everyone|Adds relevant story", outcomes: "mutual_enjoyment|conversation_continues|shared_interest",
    beats: ["That is exactly the kind of detail this story was missing. Tell them the rest.", "We were talking about the trip last month.", "Okay, now everyone has equally embarrassing evidence.", "That is a good point.", "I am glad you joined us. This was fun.", "We are going to get another drink now."],
  },
  {
    n: 59, seed: "S086", module: "connection", mode: "in_person", difficulty: "medium", title: "Staff Interaction",
    setting: "A restaurant where repeated interruptions make Zoe uncomfortable",
    premise: "Zoe says the server keeps interrupting her and appears uncomfortable.", objective: "Notice and support without aggression, performative confrontation, or taking over her voice.",
    context: "She named the discomfort|The server will return|Several responses are possible", boundaries: "Ask what she prefers before escalating|Do not become aggressive",
    skills: "allyship|permission|practical support", tips: "Check what she wants|Use calm intervention if requested|Keep focus on her comfort",
    name: "Zoe", traits: "direct|capable|boundary-aware", goal: "Finish the meal without being spoken over", constraints: "She can speak for herself|She may want a low-key solution",
    profile: "boundary_forward", overlay: "She wants support that preserves her agency, not a rescue performance.",
    feedback: "Was her preference requested?|Was aggression avoided?|Was her agency preserved?", signals: "Asks what would help|Supports chosen response|Does not take over", outcomes: "support_offered|boundary_respected|logistics_resolved",
    beats: ["I would appreciate it if you backed me up when I finish the point myself.", "I do not want a scene. I just want to finish speaking.", "Thank you. That was exactly enough support.", "I handled it, but I appreciate you checking.", "I feel better now. Let us enjoy the rest of dinner.", "I would rather leave after we finish."],
  },
  {
    n: 60, seed: "S088", module: "connection", mode: "in_person", difficulty: "medium", title: "A Small Disagreement",
    setting: "A date conversation about spontaneous versus planned travel",
    premise: "Camila prefers spontaneity while you prefer detailed planning.", objective: "Explore the difference through practical examples without labeling either style defective.",
    context: "The topic is low stakes|Both preferences are valid|The difference may affect compatibility", boundaries: "Do not frame one style as mature|Do not diagnose personality",
    skills: "compatibility discussion|curiosity|self-disclosure", tips: "Give one example|Ask how she handles risks|Look for workable overlap",
    name: "Camila", traits: "curious|adventurous|reflective", goal: "Understand how different travel styles might work together", constraints: "She will not accept condescension|She can compromise selectively",
    profile: "curious_analytical", overlay: "She enjoys exploring practical tradeoffs and resists simplistic labels.",
    feedback: "Were both styles respected?|Were practical implications explored?|Was compatibility considered without judgment?", signals: "Uses example|Asks about tradeoff|Finds overlap", outcomes: "shared_interest|conversation_continues|incompatible",
    beats: ["I could plan the flights and still leave one day open. That might keep both of us sane.", "I like having room to change plans.", "Your missed-train example is a strong argument for at least some structure.", "I see why planning matters to you.", "We may actually balance each other if we communicate.", "We would need to talk more about that difference."],
  },
  {
    n: 61, seed: "S089", module: "connection", mode: "in_person", difficulty: "medium", title: "She Seems Uncomfortable",
    setting: "A date after the venue becomes crowded and loud",
    premise: "Ava becomes quieter and scans the room, but has not explained why.", objective: "Check in discreetly and offer choices without assuming the cause or physically guiding her.",
    context: "The venue changed|Her behavior changed|The exit and quieter area are visible", boundaries: "Do not demand disclosure|Do not touch or guide without permission",
    skills: "nonverbal awareness|consent|practical flexibility", tips: "Name the environment, not a diagnosis|Offer options|Accept her choice",
    name: "Ava", traits: "reserved|self-aware|private", goal: "Regain comfort without being put on display", constraints: "She may not want to explain|The venue is overstimulating",
    profile: "reserved_observant", overlay: "She responds to discreet options and withdraws if the user demands an emotional explanation.",
    feedback: "Was the change noticed accurately?|Were options offered?|Was privacy respected?", signals: "Mentions noise|Offers quieter place|No forced disclosure", outcomes: "support_offered|logistics_resolved|boundary_respected",
    beats: ["A quieter place would help. Thank you for noticing without making it dramatic.", "It is getting a little loud for me.", "The courtyard is much better.", "I would rather step outside for a minute.", "I feel settled again. We can keep going if you want.", "I think I am ready to go home."],
  },
  {
    n: 62, seed: "S092", module: "connection", mode: "in_person", difficulty: "medium", title: "Receive Her Success",
    setting: "A conversation after Talia earns a major promotion",
    premise: "Her new role exceeds your current level and she is proud of the achievement.", objective: "Celebrate without minimizing, competing, or joking about being intimidated.",
    context: "She earned the promotion|She is sharing it directly|No comparison was requested", boundaries: "Do not diminish success|Do not make her manage your insecurity",
    skills: "secure support|curiosity|non-competition", tips: "Celebrate specifically|Ask what she is excited about|Keep your status out of it",
    name: "Talia", traits: "ambitious|expressive|generous", goal: "Share an important accomplishment", constraints: "She expects genuine support|The achievement is hers",
    profile: "social_expressive", overlay: "She shares joy openly and notices status competition or backhanded praise.",
    feedback: "Was celebration secure?|Was competition absent?|Was interest specific?", signals: "Names the achievement|Asks about new role|No intimidated joke", outcomes: "support_offered|mutual_enjoyment|conversation_continues",
    beats: ["Thank you. I am most excited that I get to build the team from the beginning.", "I worked hard for it, so I am proud.", "That question means a lot. The responsibility is the exciting part.", "There will be a lot to learn.", "I am glad I could celebrate this with you.", "I need to call my family next."],
  },
  {
    n: 63, seed: "S093", module: "connection", mode: "in_person", difficulty: "medium", title: "She Wants to Go Slowly",
    setting: "A developing relationship conversation during a walk",
    premise: "Chloe says she likes you but wants to move slowly physically and emotionally.", objective: "Clarify what that means for both people and respond without pressure or treating patience as a tactic.",
    context: "Interest is stated|The pace boundary is stated|Specific expectations are not yet defined", boundaries: "Do not negotiate for faster access|Do not promise patience as a transaction",
    skills: "consent|expectation setting|honest compatibility", tips: "Accept first|Ask what pace means practically|State your own needs",
    name: "Chloe", traits: "clear|warm|independent", goal: "Continue only at a sustainable pace", constraints: "She needs physical and emotional space|She may end things if pressured",
    profile: "boundary_forward", overlay: "She can remain warm while holding a firm pace. Respect is not currency for later access.",
    feedback: "Was the pace accepted?|Were practical expectations clarified?|Was transactional patience avoided?", signals: "Says okay|Asks one practical question|States own needs honestly", outcomes: "boundary_respected|conversation_continues|incompatible",
    beats: ["Thank you. For me, that means fewer assumptions and time before physical intimacy.", "I need the pace to stay slow.", "Weekly dates and honest check-ins sound comfortable.", "I am still figuring out the details.", "This feels respectful and workable to me.", "If that pace does not work for you, we should be honest now."],
  },
  {
    n: 64, seed: "S094", module: "connection", mode: "in_person", difficulty: "hard", title: "Public Disagreement",
    setting: "A group discussion where An challenges your opinion",
    premise: "An disagrees with your idea in front of others and gives a substantive reason.", objective: "Disagree on the idea without humiliation, status competition, or retaliation afterward.",
    context: "The disagreement is public|Her reason addresses the idea|The group is listening", boundaries: "No personal attack|No sarcasm aimed at status",
    skills: "respectful disagreement|emotional control|group awareness", tips: "Address her argument|Acknowledge a valid point|Protect the group conversation",
    name: "An", traits: "analytical|confident|fair-minded", goal: "Improve the discussion through honest disagreement", constraints: "She rejects dominance contests|She may remain unconvinced",
    profile: "curious_analytical", overlay: "She engages with evidence and distinguishes disagreement from disrespect.",
    feedback: "Was the idea separated from the person?|Was a valid point recognized?|Was status competition avoided?", signals: "Answers reason|Keeps tone calm|Allows unresolved difference", outcomes: "repair_successful|conversation_continues|incompatible",
    beats: ["That is a fair distinction. I still disagree with the conclusion, but your version is stronger.", "I am challenging the argument, not you.", "I appreciate you addressing the substance instead of making it personal.", "We may still disagree.", "That was a useful discussion. I am glad it stayed respectful.", "I think we should leave the disagreement unresolved."],
  },
  {
    n: 65, seed: "S095", module: "connection", mode: "in_person", difficulty: "hard", title: "A Friend Makes a Sexist Joke",
    setting: "A social gathering after one of your friends makes a sexist remark",
    premise: "Ruth looks uncomfortable and the group pauses after the remark.", objective: "Address the remark clearly and support the group boundary without asking Ruth to debate it or performing for praise.",
    context: "The remark was public|Ruth’s discomfort is visible|Your friend is present", boundaries: "Do not minimize to protect your friend|Do not make Ruth educate the group",
    skills: "allyship|courage|social accountability", tips: "Address the remark yourself|Keep it clear|Do not seek praise afterward",
    name: "Ruth", traits: "principled|self-possessed|observant", goal: "Remain in a social space without accepting demeaning treatment", constraints: "She does not owe a debate|She may leave if the group minimizes it",
    profile: "boundary_forward", overlay: "She notices whether the user addresses his own friend without shifting responsibility onto her.",
    feedback: "Was the remark addressed directly?|Was responsibility kept with the group?|Was performative praise-seeking avoided?", signals: "Names joke as unacceptable|Does not ask her to explain|Accepts social discomfort", outcomes: "support_offered|boundary_respected|repair_successful",
    beats: ["Thank you for addressing it without making me argue for basic respect.", "That joke was not okay with me.", "I appreciate that you did not excuse it because he is your friend.", "I need to see whether the group actually changes the tone.", "I feel comfortable staying now.", "I am going to leave if this continues."],
  },
  {
    n: 66, seed: "S097", module: "connection", mode: "in_person", difficulty: "hard", title: "Emotional Overload",
    setting: "A difficult conversation after Leila says she feels overwhelmed",
    premise: "Leila asks to stop the conversation and leave the room.", objective: "Stop immediately and agree on a respectful next step only if she wants one.",
    context: "She explicitly asked to stop|She is moving toward the exit|The issue is unresolved", boundaries: "Do not follow or corner|Do not demand immediate resolution",
    skills: "de-escalation|consent|self-regulation", tips: "Stop speaking|Give physical space|Offer one optional later check-in",
    name: "Leila", traits: "clear|emotionally aware|independent", goal: "End the interaction and regain emotional safety", constraints: "She cannot continue now|Resolution must wait",
    profile: "boundary_forward", overlay: "The successful response is immediate de-escalation. Continued explanation or pursuit terminates the scenario.",
    feedback: "Did the user stop immediately?|Was physical space given?|Was resolution pressure removed?", signals: "Says okay|Steps back|Offers optional later contact", outcomes: "boundary_respected|graceful_exit|repair_successful",
    beats: ["Thank you. I need space now. I will reach out when I am ready.", "I cannot continue this conversation.", "A check-in tomorrow is okay, but not tonight.", "I need you to leave me alone now.", "I am going to go. Please respect that.", "This conversation is over."],
  },
  {
    n: 67, seed: "S100", module: "connection", mode: "in_person", difficulty: "hard", title: "The Next Step or Goodbye",
    setting: "The end of a thoughtful first date",
    premise: "Nadia appears comfortable and engaged, but no second date has been discussed.", objective: "Name your interest clearly, invite a next step once, and accept either answer.",
    context: "The date is ending|Conversation was warm|Interest is plausible but not guaranteed", boundaries: "Ask once|Do not bargain with ambiguity or refusal",
    skills: "honest forward motion|calibration|graceful closure", tips: "State that you enjoyed it|Offer a specific next step|Accept the answer normally",
    name: "Nadia", traits: "direct|warm|self-possessed", goal: "End the date with clear expectations", constraints: "She may want a second date or may decline|The evening must end cleanly",
    profile: "direct_grounded", overlay: "She answers a clear invitation clearly. A respectful decline remains a valid high-skill outcome.",
    feedback: "Was interest stated clearly?|Was the invitation proportionate?|Was either answer accepted?", signals: "Names enjoyment|Asks once|Closes with dignity", outcomes: "date_invited|date_agreed|graceful_exit",
    beats: ["I enjoyed it too. I would like to see you again next week.", "I had a good time. What did you have in mind?", "Thursday works. Send me the place tomorrow.", "I need to check my week before I answer.", "Goodnight. I am looking forward to Thursday.", "Thank you for asking clearly. I will let you know."],
  },
];

export const problemCatalog: ProblemDefinition[] = rawProblems.map(makeProblem);

export const problemsById = new Map(
  problemCatalog.map((problem) => [problem.id, problem] as const),
);

export const getProblemById = (id: string): ProblemDefinition => {
  const problem = problemsById.get(id);
  if (!problem) throw new Error(`Unknown problem: ${id}`);
  return problem;
};

export const catalogSummary = {
  total: problemCatalog.length,
  spark: problemCatalog.filter((p) => p.module === "spark").length,
  connection: problemCatalog.filter((p) => p.module === "connection").length,
  inPerson: problemCatalog.filter((p) => p.mode === "in_person").length,
  messaging: problemCatalog.filter((p) => p.mode === "messaging").length,
  easy: problemCatalog.filter((p) => p.difficulty === "easy").length,
  medium: problemCatalog.filter((p) => p.difficulty === "medium").length,
  hard: problemCatalog.filter((p) => p.difficulty === "hard").length,
} as const;

if (
  catalogSummary.total !== 67 ||
  catalogSummary.spark !== 34 ||
  catalogSummary.connection !== 33 ||
  catalogSummary.inPerson !== 33 ||
  catalogSummary.messaging !== 34 ||
  catalogSummary.easy !== 24 ||
  catalogSummary.medium !== 28 ||
  catalogSummary.hard !== 15
) {
  throw new Error(`Invalid RizzCode catalog: ${JSON.stringify(catalogSummary)}`);
}
