// Tailwind v4 läuft als PostCSS-Plugin. Nur fürs Frontend relevant;
// die Payload-Admin-UI bringt ihr eigenes Styling mit.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
