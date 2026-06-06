import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'dark'
  }),
  actions: {
    resetTheme() {
      this.theme = 'dark'
    },
    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark'
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    }
  }
})
