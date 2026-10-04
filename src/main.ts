import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { applyTheme, theme } from './ui/theme.svelte'

applyTheme(theme.pref)

const target = document.getElementById('app')
if (!target) throw new Error('#app element missing')

export default mount(App, { target })
