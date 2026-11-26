export default defineAppConfig({
  ui: {
    colors: {
      primary: 'amber',
      neutral: 'zinc'
    },
    // `min-h-svh` would push them past the update banner; the group already stretches them.
    dashboardSidebar: {
      slots: {
        root: 'min-h-0'
      }
    },
    dashboardPanel: {
      slots: {
        root: 'min-h-0'
      }
    },
    button: {
      slots: {
        base: 'cursor-pointer'
      }
    }
  }
})
