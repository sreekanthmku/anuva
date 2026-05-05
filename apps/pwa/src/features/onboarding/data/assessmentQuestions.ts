export type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'cycle-consistency',
    prompt: 'How would you describe your cycle over the last 6 months?',
    options: ['Regular as ever', 'Slightly irregular', 'Noticeably irregular', 'Largely absent'],
  },
  {
    id: 'hot-flashes',
    prompt: 'Are you experiencing hot flashes or night sweats?',
    options: ['Not at all', 'A few times a month', 'Several times a week', 'Daily, disrupting sleep'],
  },
  {
    id: 'sleep-pattern',
    prompt: 'How has your sleep changed?',
    options: ['Sleep is unchanged', 'Occasional restlessness', 'Frequent waking', 'Rarely a full night'],
  },
  {
    id: 'age-range',
    prompt: 'How old are you?',
    options: ['Under 35', '35 - 42', '42 - 50', '50 and above'],
  },
];

