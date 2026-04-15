/**
 * Cotizador SDI · Router de vistas
 *
 * Controla la transicion entre las 4 vistas (view1..view4) y mantiene
 * sincronizado el step-nav del header (active / done / pending).
 *
 * API publica:
 *   - showView(n)       Muestra la vista n (1..4) y hace scroll al tope.
 *   - updateStepNav(n)  Marca el paso n como activo y los anteriores como done.
 *
 * Efectos colaterales:
 *   - Escribe en S.step (estado global definido en state.js).
 *   - Manipula clases CSS en las secciones .view y en los .step del header.
 */

/**
 * Cambia la vista visible a la indicada (1..4).
 * Tambien actualiza el step-nav y el contador global S.step.
 * @param {number} n - numero de vista entre 1 y 4
 */
function showView(n) {
  if (n < 1 || n > 4) {
    console.warn('[router] showView fuera de rango:', n);
    return;
  }

  // Ocultar todas, mostrar la n
  document.querySelectorAll('main.container > .view').forEach(v => {
    v.classList.remove('active');
  });
  const target = document.getElementById('view' + n);
  if (!target) {
    console.error('[router] vista no encontrada: view' + n);
    return;
  }
  target.classList.add('active');

  // Sincronizar step-nav y estado
  updateStepNav(n);
  S.step = n;

  // Scroll suave al inicio para que no quede a mitad de la vista anterior
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Actualiza las clases del step-nav segun el paso activo.
 * Pasos < n -> done (verde). Paso == n -> active (blanco). Pasos > n -> default.
 * @param {number} n - paso activo (1..4)
 */
function updateStepNav(n) {
  document.querySelectorAll('#stepNav .step').forEach(el => {
    const step = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'done');
    if (step < n)       el.classList.add('done');
    else if (step === n) el.classList.add('active');
  });
}
