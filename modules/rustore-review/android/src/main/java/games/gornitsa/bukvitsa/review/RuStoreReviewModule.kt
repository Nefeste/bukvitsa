// из nardy: modules/rustore-review/android/src/main/java/games/gornitsa/nardy/review/RuStoreReviewModule.kt @ 1d2bdff — своё имя пакета.
package games.gornitsa.bukvitsa.review

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ru.rustore.sdk.review.RuStoreReviewManagerFactory

/**
 * Форма оценки RuStore: `ask()` запрашивает её и сразу показывает. Когда просить — решает
 * приложение (src/engine/rate.ts, src/state/rate.ts); ошибки RuStore (нет RuStore, нет входа, лимит, уже оценил)
 * приходят отказом с именем исключения — приложение их молча пропускает.
 */
class RuStoreReviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RuStoreReview")

    AsyncFunction("ask") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Нет контекста приложения", null)
        return@AsyncFunction
      }
      val manager = RuStoreReviewManagerFactory.create(context)
      manager.requestReviewFlow()
        .addOnSuccessListener { info ->
          manager.launchReviewFlow(info)
            .addOnSuccessListener { promise.resolve(true) }
            .addOnFailureListener { e -> promise.reject("E_LAUNCH", e.javaClass.simpleName, e) }
        }
        .addOnFailureListener { e -> promise.reject("E_REQUEST", e.javaClass.simpleName, e) }
    }
  }
}
