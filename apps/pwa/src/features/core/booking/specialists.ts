export type SpecialistId = 'gynec' | 'psych' | 'nutri';

export type SpecialistOption = {
  id: SpecialistId;
  title: string;
  sub: string;
  tag?: string;
};

export const specialists: SpecialistOption[] = [
  { id: 'gynec', title: 'Gynaecologist', sub: 'Dr. Priya Nair · 18y', tag: 'Recommended' },
  { id: 'psych', title: 'Psychologist', sub: 'Dr. Anjali Mehta · 12y' },
  { id: 'nutri', title: 'Nutritionist', sub: 'Kavya Shenoy · 9y' },
];
