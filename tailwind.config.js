/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './work/*.html',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        background:              '#0c0c0c',
        surface:                 '#0c0c0c',
        'surface-container':     '#201f1f',
        'surface-container-low': '#1c1b1b',
        'surface-container-high':'#2a2a2a',
        'on-surface':            '#e5e2e1',
        'on-surface-variant':    '#c4c7c8',
        primary:                 '#ffffff',
        accent:                  '#FF4F00',
        outline:                 '#8e9192',
        'outline-variant':       '#444748',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        sans:    ['Hanken Grotesk', 'sans-serif'],
      },
    },
  },
}
