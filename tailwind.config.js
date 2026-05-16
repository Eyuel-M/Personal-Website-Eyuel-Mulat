/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './work/*.html',
    './insights/*.html',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        background:              '#F5F2EE',
        surface:                 '#F5F2EE',
        'surface-container':     '#E1DFD9',
        'surface-container-low': '#EAE8E3',
        'surface-container-high':'#D5D3CD',
        'on-surface':            '#1C1B1B',
        'on-surface-variant':    '#6B6868',
        primary:                 '#0F0F0F',
        accent:                  '#FF4F00',
        outline:                 '#9E9E9E',
        'outline-variant':       '#C8C6C0',
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'Haettenschweiler', '"Arial Black"', 'sans-serif'],
        sans:    ['Hanken Grotesk', 'sans-serif'],
      },
    },
  },
}
