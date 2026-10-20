/** Save / unsave an article, with an M3 snackbar saying what changed in the feed. */
import { showSnackbar } from './snackbar'
import { isArticleSaved, toggleArticleSaved } from '../video-first-app/store'

export async function saveArticle(title: string): Promise<void> {
  const added = await toggleArticleSaved(title)
  if (!isArticleSaved(title)) {
    showSnackbar(`Removed ${title} from saved`, { label: 'Undo', run: () => saveArticle(title) })
    return
  }
  showSnackbar(
    added
      ? `Saved. ${added} ${added === 1 ? 'video' : 'videos'} about ${title} coming up in your feed`
      : `Saved ${title}`,
  )
}
