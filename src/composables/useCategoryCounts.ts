/**
 * Live category counts, derived from the nodes this device holds.
 *
 * InterPoll asks a relay for trending tags. There is no relay to ask here, and
 * a tally a peer sends is a claim rather than a fact — so this counts the posts
 * and polls in the local replica and says so in the UI. As peers sync, the
 * numbers converge on their own.
 */
import { ref, computed, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { db } from '@/services/gdbServices'
import { categoryFor } from '@/utils/categories'
import type { CategoryDef } from '@/utils/categories'

export interface CategoryCount {
  category: CategoryDef
  count: number
}

export function useCategoryCounts(): {
  counts: Ref<CategoryCount[]>
  total: Ref<number>
} {
  /** node id → category id, so an update moves the node between buckets. */
  const byNode = ref(new Map<string, string>())
  const unsubscribes: Array<() => void> = []

  const counts = computed<CategoryCount[]>(() => {
    const tally = new Map<string, number>()
    for (const categoryId of byNode.value.values()) {
      tally.set(categoryId, (tally.get(categoryId) ?? 0) + 1)
    }
    return [...tally.entries()]
      .map(([id, count]) => ({ category: categoryFor(id), count }))
      .sort((a, b) => b.count - a.count || a.category.label.localeCompare(b.category.label))
  })

  const total = computed(() => byNode.value.size)

  async function subscribe(type: 'post' | 'poll') {
    const { unsubscribe } = await db.map(
      { query: { type } },
      ({ id, value, action }: any) => {
        const next = new Map(byNode.value)
        if (action === 'removed') next.delete(id)
        else next.set(id, categoryFor(value?.category).id)
        byNode.value = next
      }
    )
    if (unsubscribe) unsubscribes.push(unsubscribe)
  }

  void subscribe('post')
  void subscribe('poll')

  onUnmounted(() => {
    for (const stop of unsubscribes) stop()
    unsubscribes.length = 0
  })

  return { counts, total }
}
