import { describe, expect, it } from 'vitest';
import { findViolations, rewriteDirective } from '../src/anu/v3/checks.js';

const base = {
  riskLevel: 'L1',
  crisis: false,
  inIndia: true,
  professionalTypes: ['gynecologist'],
};

describe('v3 findViolations', () => {
  it('passes a reply with one question and no banned phrasing', () => {
    expect(
      findViolations({ ...base, message: 'A 7-day delay can happen. Is pregnancy possible for you?' }),
    ).toEqual([]);
  });

  it('flags a second question outside an emergency', () => {
    const out = findViolations({
      ...base,
      message: 'Would you like to log this? Also, any fever or daytime hot flashes?',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/2 questions/);
  });

  it('allows several short safety questions at L4', () => {
    expect(
      findViolations({ ...base, riskLevel: 'L4', message: 'Are you safe right now? Is anyone with you?' }),
    ).toEqual([]);
  });

  it('flags stock sympathy openers, with either apostrophe', () => {
    expect(findViolations({ ...base, message: "I'm sorry you're feeling this way." })).toHaveLength(1);
    expect(findViolations({ ...base, message: 'I’m sorry to hear that.' })).toHaveLength(1);
    expect(findViolations({ ...base, message: "Don't worry, this is common." })).toHaveLength(1);
  });

  it('flags a nearby/local professional when Anuva offers one', () => {
    expect(findViolations({ ...base, message: 'I can show a nearby gynecologist.' })).toHaveLength(1);
    expect(findViolations({ ...base, message: 'See a doctor near you.' })).toHaveLength(1);
  });

  it('does not flag an external referral when Anuva offers no professionals', () => {
    expect(
      findViolations({ ...base, professionalTypes: [], message: 'A local doctor can check this.' }),
    ).toEqual([]);
  });

  it('does not treat the nearest emergency department as an external referral', () => {
    expect(
      findViolations({
        ...base,
        riskLevel: 'L4',
        crisis: true,
        message: 'Please call 112 or go to the nearest emergency department. Tele-MANAS 14416 is free, 24x7.',
      }),
    ).toEqual([]);
  });

  it('requires a helpline in an Indian crisis reply', () => {
    const out = findViolations({
      ...base,
      riskLevel: 'L4',
      crisis: true,
      message: 'Your safety matters most right now. Is someone with you?',
    });
    expect(out.some((v) => v.includes('14416'))).toBe(true);
  });

  it('flags "if you are in India" when the country is known', () => {
    const out = findViolations({
      ...base,
      riskLevel: 'L4',
      crisis: true,
      message: 'If you are in India, call 112 or Tele-MANAS 14416.',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/India/);
  });
});

describe('v3 medicine checks', () => {
  it('flags a dose, even in an emergency', () => {
    const out = findViolations({
      ...base,
      riskLevel: 'L4',
      message: 'Call 112 now. Chewing 300 mg aspirin while you wait can help.',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/medicine/);
  });

  it('flags an instruction to take an OTC medicine without a dose', () => {
    expect(findViolations({ ...base, message: 'You could take some paracetamol for the ache.' })).toHaveLength(1);
  });

  it.each([
    'Melatonin can help you fall asleep faster.',
    'You might consider HRT for the hot flashes.',
    'It is worth asking an Anuva gynecologist about HRT.',
    'There are treatment options like antidepressants and HRT.',
    'Some women try ashwagandha for stress.',
    'A calcium supplement could be worth starting.',
    'Check with your prescriber or pharmacist about which pain reliever is appropriate.',
    'HRT is one of the most effective treatments for hot flashes.',
    'Options people try include: omega‑3 (fish oil) and vitamin D.',
    'HRT can significantly reduce hot flashes for many people.',
    'Glucosamine may help with joint pain.',
  ])('flags a medicine suggestion: %s', (message) => {
    expect(findViolations({ ...base, message })).toHaveLength(1);
  });

  it("follows the judge's verdict over the patterns, but always flags a dose", () => {
    expect(findViolations({ ...base, message: 'Some people ask about ashwagandha.', medicineSuggested: false })).toEqual([]);
    expect(findViolations({ ...base, message: 'HRT reduces hot flashes for many people.', medicineSuggested: true })).toHaveLength(1);
    expect(findViolations({ ...base, message: 'Take 500 mg now.', medicineSuggested: false })).toHaveLength(1);
  });

  it('allows asking what she takes and diet advice', () => {
    for (const message of [
      'Are you taking HRT at the moment?',
      'Calcium-rich foods like ragi and curd support bone health.',
      'Please keep taking your prescribed medicines as directed.',
      'Choosing a medicine is something an Anuva gynecologist can do with you.',
    ]) {
      expect(findViolations({ ...base, message })).toEqual([]);
    }
  });

  it('does not flag the emergency number or general mention of HRT', () => {
    expect(
      findViolations({ ...base, message: 'Changing your HRT dose is something to review with your prescriber.' }),
    ).toEqual([]);
  });
});

describe('v3 rewriteDirective', () => {
  it('numbers every violation', () => {
    expect(rewriteDirective(['a', 'b'])).toMatch(/1\. a\n2\. b$/);
  });
});

describe('v3 booking and logging checks', () => {
  it('flags clock times written beside slot buttons', () => {
    const out = findViolations({
      ...base,
      message: 'Dr Sayed has 5:30 pm on Friday — tap to book.',
      offeredSlots: 2,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/clock times/);
  });

  it('allows days and parts of the day beside slot buttons, and times without buttons', () => {
    expect(
      findViolations({ ...base, message: 'Here are Friday evening times with Dr Sayed — tap one to book.', offeredSlots: 2 }),
    ).toEqual([]);
    expect(findViolations({ ...base, message: 'Your call is on Friday at 6 pm.' })).toEqual([]);
  });

  it.each([
    "I've booked Friday evening for you.",
    "You're booked with Dr Sayed.",
    'Your appointment has been confirmed.',
    "I've logged your sleep for today.",
    "I'll note it down in your tracker.",
    'Noted — low mood can feel heavy.',
  ])('flags a claim that ANU booked or logged: %s', (message) => {
    expect(findViolations({ ...base, message })).toHaveLength(1);
  });

  it('allows the confirmation once the booking system confirmed it, but never a logging claim', () => {
    expect(
      findViolations({ ...base, message: "You're booked with Dr Sayed on Friday 17 October.", bookingConfirmed: true }),
    ).toEqual([]);
    expect(findViolations({ ...base, message: "I've logged it too.", bookingConfirmed: true })).toHaveLength(1);
  });

  it('allows offers', () => {
    expect(findViolations({ ...base, message: 'You can log last night’s sleep below. Tap a time to book.' })).toEqual([]);
  });
});
