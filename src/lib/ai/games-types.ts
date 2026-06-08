import type { ProductFormat, GameType, EventCategory } from "./mix-types";

export interface PickSheetItem {
  name: string;
  line?: string;
  writeInField: boolean;
}

export interface PropBet {
  question: string;
  options: string[];
  points: number;
  isFunny: boolean;
}

export interface HowWellQuestion {
  question: string;
  answerType: "multiple_choice" | "write_in";
  options?: string[];
  points: number;
}

export interface TriviaCategory {
  name: string;
  questions: Array<{
    question: string;
    answer: string;
    difficulty: "easy" | "medium" | "hard";
    points: number;
  }>;
}

export interface GameContent {
  bingoSquares?: string[];
  bingoTitle?: string;
  bingoInstructions?: string;
  squaresTitle?: string;
  squaresTeam1?: string;
  squaresTeam2?: string;
  squaresInstructions?: string;
  squaresPrizeSuggestions?: string[];
  bracketTitle?: string;
  bracketParticipants?: string[];
  bracketRounds?: number;
  pickSheetTitle?: string;
  pickSheetOptions?: PickSheetItem[];
  pickSheetInstructions?: string;
  pickSheetTiebreaker?: string;
  propBetTitle?: string;
  propBets?: PropBet[];
  propBetInstructions?: string;
  coupleOrPersonName?: string;
  questions?: HowWellQuestion[];
  scoringGuide?: string;
  triviaTitle?: string;
  triviaCategories?: TriviaCategory[];
  predictionTitle?: string;
  predictions?: string[];
  predictionInstructions?: string;
}

export interface GameProductBlueprint {
  title: string;
  subtitle: string;
  eventCategory: EventCategory;
  gameType: GameType;
  format: ProductFormat;
  price: number;
  itemCount: number;
  isEvergreen: boolean;
  peakMonths: number[];
  currentSeasonalRelevance: number;
  publishUrgency: "now" | "this_week" | "next_month" | "plan_ahead";
  daysUntilPeak: number;
  etsyTags: string[];
  etsyTitle: string;
  etsyDescription: string;
  coverConceptDescription: string;
  gameContent: GameContent;
}

export interface GameCalendarEvent {
  eventCategory: EventCategory;
  eventName: string;
  eventDate: string;
  publishBy: string;
  peakBuyingWindow: string;
  estimatedVolume: "low" | "medium" | "high" | "massive";
  isEvergreen: boolean;
  dateIsApproximate: boolean;
  topGameTypes: GameType[];
  topEtsyTerms: string[];
  revenueOpportunity: string;
}

export interface GameNiche {
  nicheName: string;
  gameType: GameType;
  opportunityScore: number;
  competitionLevel: string;
  etsySearchVolume: string;
  topTitle: string;
  whyItSells: string;
}
