// из uzory: app.config.js @ 3069332 — своё имя переменной.
// Настройки Expo живут в app.json. Здесь — только адрес веб-сборки для закрытой версии на сайте студии
// (docs/02-architecture.md, «Веб-сборка»; ADR 0007): `BUKVITSA_WEB_BASE=/bukvitsa/test npx expo export -p web`
// собирает её для папки gornitsa.games/bukvitsa/test/. Без переменной всё как в app.json.
module.exports = ({ config }) => {
  const base = process.env.BUKVITSA_WEB_BASE;
  return base ? { ...config, experiments: { ...config.experiments, baseUrl: base } } : config;
};
