import { useUi } from '../app/providers/UiProvider.jsx'

const ACTION_COPY = {
  add: {
    title: 'Saving record',
    message: 'Creating the new record and syncing the latest changes.'
  },
  save: {
    title: 'Saving changes',
    message: 'Applying your updates and refreshing the latest data.'
  },
  edit: {
    title: 'Updating record',
    message: 'Applying your edits and validating the latest changes.'
  },
  delete: {
    title: 'Deleting record',
    message: 'Removing the selected record and updating the view.'
  }
}

export function useActionFeedback() {
  const { withLoader, openStatus } = useUi()

  async function run(action, task, options = {}) {
    const preset = ACTION_COPY[action] || ACTION_COPY.save

    try {
      return await withLoader(
        {
          title: options.title || preset.title,
          message: options.message || preset.message
        },
        task
      )
    } catch (error) {
      if (!options.silentError) {
        openStatus({
          tone: 'danger',
          title: options.errorTitle || 'Action failed',
          message: options.errorMessage || 'The request could not be completed. Please try again.'
        })
      }
      throw error
    }
  }

  return { run }
}
