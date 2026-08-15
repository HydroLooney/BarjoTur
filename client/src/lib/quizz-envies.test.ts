import { describe, expect, it } from 'vitest';
import { QUESTIONS_ENVIES, appetitsDepuisReponses, themesDuQuizz } from './quizz-envies';

describe('quizz-envies', () => {
  it('trois questions, chacune avec au moins deux options', () => {
    expect(QUESTIONS_ENVIES).toHaveLength(3);
    for (const q of QUESTIONS_ENVIES) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it('pose une base a tous les themes du quizz, meme non choisis', () => {
    const a = appetitsDepuisReponses([]);
    for (const t of themesDuQuizz()) expect(a[t]).toBeCloseTo(0.25);
  });

  it('un choix monte le theme, deux choix le montent plus (borne a 1)', () => {
    const un = appetitsDepuisReponses(['faune']);
    expect(un.faune).toBeCloseTo(0.6);
    const deux = appetitsDepuisReponses(['faune', 'faune']);
    expect(deux.faune).toBeCloseTo(0.95);
    const trois = appetitsDepuisReponses(['faune', 'faune', 'faune']);
    expect(trois.faune).toBeLessThanOrEqual(1);
  });
});
