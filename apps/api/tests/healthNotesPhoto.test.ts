import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFoodNote, readNotePhoto, type FoodItemEstimate } from '../src/healthNotes/ai.js';

// The photo reader: one model call that decides whether a photo is writing, food or neither, and
// the food note written from its estimate. OpenAI is stubbed; what it would return is the input.

const poha: FoodItemEstimate = {
  name: 'Poha',
  quantity: '1 plate',
  grams: 198,
  unit: 'g',
  calories: 251.4,
  protein_g: 5.6,
  carbs_g: 44.5,
  fat_g: 6.2,
};
const chai: FoodItemEstimate = {
  name: 'Masala chai',
  quantity: '1 cup',
  grams: 150,
  unit: 'ml',
  calories: 92,
  protein_g: 3.1,
  carbs_g: 12.4,
  fat_g: 3.4,
};

function modelReturns(content: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }], usage: {} }), {
      status: 200,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const photo = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), mimeType: 'image/jpeg' };

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatFoodNote', () => {
  it('writes one line per item and a total that is the sum of the lines', () => {
    expect(formatFoodNote([poha, chai])).toBe(
      [
        'Food photo (estimated, may not be exact)',
        '• Poha, 1 plate (about 200 g): 250 kcal, protein 6 g, carbs 45 g, fat 6 g',
        '• Masala chai, 1 cup (about 150 ml): 90 kcal, protein 3 g, carbs 12 g, fat 3 g',
        'Total: about 340 kcal, protein 9 g, carbs 57 g, fat 9 g',
      ].join('\n'),
    );
  });

  it('leaves out the total for a single item, and never prints a negative or broken number', () => {
    const text = formatFoodNote([{ ...poha, calories: Number.NaN, fat_g: -3 }]);
    expect(text).toBe(
      ['Food photo (estimated, may not be exact)', '• Poha, 1 plate (about 200 g): 0 kcal, protein 6 g, carbs 45 g, fat 0 g'].join(
        '\n',
      ),
    );
    expect(text).not.toMatch(/[—–]/);
  });
});

describe('readNotePhoto', () => {
  it('turns a food photo into the estimate text', async () => {
    const fetchMock = modelReturns({ kind: 'food', text: '', unclear: false, language: '', food: [poha, chai] });
    const result = await readNotePhoto(photo);
    expect(result).toMatchObject({ kind: 'food', unclear: false, language: null });
    expect(result.text).toBe(formatFoodNote([poha, chai]));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it('copies a written note as it is', async () => {
    modelReturns({ kind: 'text', text: ' Thyronorm [unclear] mcg ', unclear: false, language: 'en', food: [] });
    const result = await readNotePhoto(photo);
    expect(result).toMatchObject({ kind: 'text', text: 'Thyronorm [unclear] mcg', unclear: true, language: 'en' });
  });

  it('keeps any other photo with no text, and ignores text the model was told to leave out', async () => {
    modelReturns({ kind: 'other', text: 'A red rash on the arm', unclear: false, language: 'en', food: [] });
    expect(await readNotePhoto(photo)).toMatchObject({ kind: 'other', text: '', food: [], language: null });
  });

  it('treats "food" with nothing listed as a photo to keep, not an empty estimate', async () => {
    modelReturns({ kind: 'food', text: '', unclear: false, language: '', food: [] });
    expect(await readNotePhoto(photo)).toMatchObject({ kind: 'other', text: '' });
  });
});
