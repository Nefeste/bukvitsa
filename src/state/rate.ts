// Форма оценки RuStore (modules/rustore-review, копия из «Нард»): запросить и сразу показать. Когда — решает
// src/engine/rate.ts. Нет модуля (веб-сборка), нет RuStore, нет входа, лимит RuStore, уже оценил — молча:
// оценка не главное, а просьба всё равно засчитана и больше не повторится.
import { requireOptionalNativeModule } from 'expo';
import { STORE } from '../money';

interface ReviewNative {
  ask(): Promise<boolean>;
}
const review: ReviewNative | null = requireOptionalNativeModule<ReviewNative>('RuStoreReview');

export function askRating(): void {
  if (STORE !== 'rustore' || !review) return;
  review.ask().catch(() => {});
}
