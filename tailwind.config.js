/** Tailwind se compila a Front/css/tailwind.css (npm run build:css). Antes se usaba el CDN en runtime. */
module.exports = {
  content: ['./Front/**/*.html', './Front/js/**/*.js'],
  theme: { extend: {} },
  plugins: []
};
