import type { QuickSymptom } from '@anuva/shared';

/**
 * Supportive, calming messages shown after a quick symptom log.
 * 10 variants per symptom — one is picked at random on each log.
 * Defined here (not the DB) so copy can be tuned without a migration.
 */
export const QUICK_LOG_MESSAGES: Record<QuickSymptom, string[]> = {
  hot_flash: [
    "Hot flashes pass — breathe slow and let this one move through you.",
    "Your body is just recalibrating. Sip some water and loosen a layer.",
    "This wave will crest and fade. You're handling it beautifully.",
    "A cool cloth on your wrists or neck can take the edge off.",
    "Nothing's wrong with you — this is your body adjusting. It eases soon.",
    "Try a few slow exhales; the heat usually settles within minutes.",
    "You're not alone in this — so many move through the same wave.",
    "Find some air, drop your shoulders, and let it pass on its own time.",
    "Each one you ride through, you understand your body a little more.",
    "Be gentle with yourself right now — the flush will fade.",
  ],
  anxiety: [
    "You're safe in this moment. Breathe in for four, out for six.",
    "Anxiety lies about how long it'll last — it always passes.",
    "Place a hand on your chest and feel it rise and fall. You're okay.",
    "Name five things you can see right now; let it pull you to the present.",
    "You don't have to fix anything this second. Just keep breathing.",
    "This feeling is a wave, not your whole ocean. It will recede.",
    "Be kind to yourself — you're carrying a lot and still showing up.",
    "Unclench your jaw, soften your hands. Your body can let go a little.",
    "You've moved through anxious moments before, and you will again.",
    "Slow your breath and the rest of you will follow. You're doing fine.",
  ],
  chills: [
    "Wrap up warm and let your body find its temperature again.",
    "A warm drink and a soft blanket can help settle the shivers.",
    "This is your body regulating — it'll pass. Stay cozy.",
    "Warm socks and slow breaths; let the chill ease out of you.",
    "Nothing to fight here — bundle up and give yourself a moment.",
    "Your body's just balancing out. Warmth and rest will help.",
    "Curl up somewhere snug; you deserve a little comfort right now.",
    "The cold wave will fade. Be patient and gentle with yourself.",
    "A warm shower or tea can coax the shivers away.",
    "Let yourself slow down and get warm — you're taking good care of you.",
  ],
  irritability: [
    "Feeling on edge is valid — your hormones are shifting, not failing you.",
    "Step away for a breath if you can. The sharp edge softens with space.",
    "You're allowed to feel irritable. Be as kind to yourself as you'd be to a friend.",
    "This isn't the real you slipping — it's a passing surge. Go easy.",
    "A short walk or a few deep breaths can loosen the tension.",
    "Name what you need right now: quiet, space, water, a pause. Then take it.",
    "Snapping doesn't make you a bad person — you're human and stretched thin.",
    "Drop your shoulders, unclench your hands. Let some of it go.",
    "This wave of irritation will settle. You don't have to act on it.",
    "Give yourself grace — you're managing more than anyone sees.",
  ],
};

export function randomQuickLogMessage(symptom: QuickSymptom): string {
  const list = QUICK_LOG_MESSAGES[symptom];
  return list[Math.floor(Math.random() * list.length)]!;
}
