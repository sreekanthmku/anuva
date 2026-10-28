import { describe, expect, it } from 'vitest';
import { findViolations, removeDashes, rewriteDirective, withFullBrand } from '../src/anu/v3/checks.js';

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
    expect(findViolations({ ...base, message: "I'm really sorry to hear that." })).toHaveLength(1);
    expect(findViolations({ ...base, message: 'I am so sorry you are going through this.' })).toHaveLength(1);
  });

  it('flags assistant lines — ANU is a companion, not a help desk', () => {
    for (const message of [
      'Hi Priya — welcome back. How can I help you today?',
      'Hello! How may I assist you?',
      'Hi Priya. What would you like help with today?',
      'Good to hear from you. What can I help you with?',
      'Got it. How else can I help?',
      'Hi Priya! How are you feeling today, what’s been on your mind?',
      "Hey! What's on your mind?",
    ]) {
      expect(findViolations({ ...base, message }), message).toHaveLength(1);
    }
  });

  it('allows a companion greeting and ordinary "would you like" offers', () => {
    for (const message of [
      "Hi! It's lovely to hear from you. How have you been feeling these days?",
      "I'm well, thank you for asking! More importantly — how are you holding up?",
      'Would you like to log this symptom?',
      'What would you like to talk about first — your sleep or the hot flashes?',
    ]) {
      expect(findViolations({ ...base, message }), message).toEqual([]);
    }
  });

  it('flags app actions presented as what ANU can do', () => {
    for (const message of [
      'I can book appointments for you with our gynecologists.',
      "I'm here to listen, and I can also log your symptoms and set reminders.",
      'I can help you track your cycle.',
      'I am able to schedule a consultation.',
    ]) {
      expect(findViolations({ ...base, message }), message).toHaveLength(1);
    }
  });

  it('allows describing herself as a companion', () => {
    for (const message of [
      "I'm here to listen and help you make sense of what your body is going through. How have things been lately?",
      'I can see why that worries you. How long has it been going on?',
      'You can book an Anuva gynecologist below.',
    ]) {
      expect(findViolations({ ...base, message }), message).toEqual([]);
    }
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
        message:
          'Please call 112 or go to the nearest emergency department. Tele-MANAS 14416 is free, 24x7, and iCall is on 91529 87821.',
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

  it('requires iCall alongside 112 and Tele-MANAS in an Indian crisis reply', () => {
    const out = findViolations({
      ...base,
      riskLevel: 'L4',
      crisis: true,
      message: 'Your safety matters most right now. Please call 112, or Tele-MANAS 14416 (free, 24x7).',
    });
    expect(out.some((v) => v.includes('9152987821'))).toBe(true);
  });

  it('flags "if you are in India" when the country is known', () => {
    const out = findViolations({
      ...base,
      riskLevel: 'L4',
      crisis: true,
      message: 'If you are in India, call 112, Tele-MANAS 14416 or iCall 9152987821.',
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
  it('flags clock times written beside the booking card', () => {
    const out = findViolations({
      ...base,
      message: 'Dr Sayed has 5:30 pm on Friday — tap to book.',
      offersBooking: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/clock times/);
  });

  it('allows a time she wrote herself beside the booking card, but not a new one', () => {
    const herMessage = 'I keep waking up at 3 am every night';
    expect(
      findViolations({ ...base, herMessage, offersBooking: true, message: 'Waking at 3am every night wears you down. You can book below.' }),
    ).toEqual([]);
    expect(
      findViolations({ ...base, herMessage, offersBooking: true, message: 'Waking at 3 am is hard. Dr Sayed has 5:30 pm on Friday.' }),
    ).toHaveLength(1);
  });

  it('allows days and parts of the day beside the booking card, and times without it', () => {
    expect(
      findViolations({ ...base, message: 'Dr Sayed has evening times on Friday — pick one below.', offersBooking: true }),
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

describe('v3 reminder checks', () => {
  it.each([
    "I've set a reminder for 8 am.",
    "I'll set up a daily reminder for you.",
    "I'll remind you every morning.",
    'Your reminder is now set.',
  ])('flags a claim that ANU set a reminder: %s', (message) => {
    expect(findViolations({ ...base, message })).toHaveLength(1);
  });

  it('allows the offer, and a reminder for what she already takes is not a medicine suggestion', () => {
    expect(
      findViolations({
        ...base,
        message: 'You can set a reminder below for the times you take your tablets, so they are easier to remember.',
      }),
    ).toEqual([]);
  });

  it('still flags a reminder that names a medicine for her to take', () => {
    expect(findViolations({ ...base, message: 'Set a reminder to take melatonin at night.' })).toHaveLength(1);
  });
});

describe('v3 offers to act', () => {
  // Caught by the same check as a claim: "shall I add" contains "I add".
  it.each(['There is a button below — shall I add that for you?', 'Should I set up a reminder?', 'Can I book Friday for you?'])(
    'flags ANU offering to do it herself: %s',
    (message) => {
      expect(findViolations({ ...base, message })).toHaveLength(1);
    },
  );

  it('allows offering to show something', () => {
    expect(findViolations({ ...base, message: 'I can show you the available Anuva gynecologists.' })).toEqual([]);
  });
});

describe('v3 already-logged and serious-concern checks', () => {
  it('flags offering a tracker she already logged today', () => {
    const out = findViolations({
      ...base,
      message: 'Would you like to log your joint pain now?',
      offersLoggedToday: ['Joints & stiffness'],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/already logged Joints & stiffness today/);
  });

  it('requires asking about booking for a serious concern', () => {
    const message = 'Two weeks of joint pain is worth having looked at by an Anuva gynecologist.';
    expect(findViolations({ ...base, riskLevel: 'L2', message, bookingDue: true })).toHaveLength(1);
    expect(
      findViolations({ ...base, riskLevel: 'L2', message: `${message} Would you like to book a time?`, bookingDue: true, asksToBook: true }),
    ).toEqual([]);
    expect(findViolations({ ...base, riskLevel: 'L2', message, bookingDue: false })).toEqual([]);
  });

  it('lets a safety question come before the booking question', () => {
    const message = 'An Anuva psychologist could help. Have you had thoughts of hurting yourself?';
    expect(findViolations({ ...base, riskLevel: 'L2', message, bookingDue: true, asksSafetyQuestion: true })).toEqual([]);
  });

  it('flags the booking card before she has asked or said yes', () => {
    const out = findViolations({ ...base, riskLevel: 'L2', message: 'You can book below.', offersBooking: true, bookingUnconfirmed: true });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/not asked to book/);
  });
});

describe('v3 removeDashes', () => {
  it.each([
    ['Hi Priya! How are you feeling today — what’s up?', 'Hi Priya! How are you feeling today, what’s up?'],
    ['Bleeding every hour—for months—needs care today.', 'Bleeding every hour, for months, needs care today.'],
    ['Hi Priya! — how was your day?', 'Hi Priya! How was your day?'],
    ['Try this - it helps.', 'Try this, it helps.'],
    ['It passes soon —', 'It passes soon'],
  ])('%s', (text, expected) => {
    expect(removeDashes(text)).toBe(expected);
  });

  it('leaves hyphenated words, number ranges and list bullets alone', () => {
    expect(removeDashes('Over 2–3 days, a follow-up helps.')).toBe('Over 2–3 days, a follow-up helps.');
    expect(removeDashes('Tonight:\n- a cool room\n- water nearby')).toBe('Tonight:\n- a cool room\n- water nearby');
  });
});

describe('v3 withFullBrand', () => {
  it.each([
    ['An Anuva gynecologist can look at this.', 'An Anuva Wellness gynecologist can look at this.'],
    ['Would you like to see one of Anuva’s psychologists?', 'Would you like to see one of Anuva Wellness psychologists?'],
    ["Anuva's doctors are free this week.", 'Anuva Wellness doctors are free this week.'],
    ['Book with an Anuva dietitian or the anuva team.', 'Book with an Anuva Wellness dietitian or the Anuva Wellness team.'],
    ['Anuva ki gynecologist se baat karein?', 'Anuva Wellness ki gynecologist se baat karein?'],
    ['Anuva की डॉक्टर से बात करें?', 'Anuva Wellness की डॉक्टर से बात करें?'],
  ])('%s', (text, expected) => {
    expect(withFullBrand(text)).toBe(expected);
  });

  it('leaves the full name, and Anuva used on its own, alone', () => {
    const text = 'An Anuva Wellness gynecologist is free. You can log it in Anuva, and Anuva reminds you.';
    expect(withFullBrand(text)).toBe(text);
  });
});
