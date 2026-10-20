/** Save / unsave an article with a toast saying what changed in the feed. */
import { useToast } from '@wikimedia/codex'

import { isArticleSaved, toggleArticleSaved } from './store'

export function useSaveArticle(): (title: string) => Promise<void> {
  const toast = useToast()
  return async (title: string) => {
    const added = await toggleArticleSaved(title)
    const message = !isArticleSaved(title)
      ? `Removed ${title} from saved`
      : added
        ? `Saved. ${added} ${added === 1 ? 'post' : 'posts'} about ${title} added to your feed`
        : `Saved ${title}. Its posts will show up in your feed`
    toast.show({ message, autoDismiss: true })
  }
}
