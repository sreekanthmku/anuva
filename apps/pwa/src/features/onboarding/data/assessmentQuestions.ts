export type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'periods-unpredictable',
    prompt:
      'Have your periods become unpredictable (early or late, flow very heavy or very light, missed periods or prolonged bleeding)?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'hot-flashes',
    prompt: 'Do you get sudden "waves" of heat in your face/neck (Hot Flashes)?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'night-sweats',
    prompt: 'Do you wake up feeling hot or sweaty or damp at night?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'mood-swings',
    prompt:
      "Do you experience sudden mood swings you can't control (anxious, fear, worrying, crying)?",
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'weight-gain',
    prompt: 'Have you gained weight recently, especially around the tummy?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'vaginal-dryness',
    prompt: 'Do you feel dryness or discomfort "down there" (vaginal area)?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'brain-fog',
    prompt: 'Do you feel "brain fog" or find it hard to concentrate or memory loss?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'low-interest-intimacy',
    prompt: 'Have you noticed a decrease in your interest in intimacy?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'facial-hair-body-odour',
    prompt: 'Have you noticed an increase in facial hair or body odour?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'aches-fatigue',
    prompt:
      'Do you have unexplained aches in your joints or muscles? Do you feel unexplained fatigue?',
    options: ['Yes', 'No', 'Sometimes'],
  },
  {
    id: 'age-bracket',
    prompt: 'Age Bracket?',
    options: ['29 or below', '30-34', '35-40', '41-45', '46-50', '51 or above'],
  },
];
