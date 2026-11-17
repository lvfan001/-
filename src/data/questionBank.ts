import type { Question } from '../types/chemistry.ts';
import { enforceForwardDependencyIsolation } from '../utils/chapterClassifier.ts';
import rawBank from './papacambridgeBank.json';

const ALL_SEEDED = rawBank as Question[];

export function normalizeQuestionClassification(question: Question): Question {
  return enforceForwardDependencyIsolation(question);
}

export const BUILTIN_QUESTIONS: Question[] = ALL_SEEDED.map((q) =>
  enforceForwardDependencyIsolation(q)
);
