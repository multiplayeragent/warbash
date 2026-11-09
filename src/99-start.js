/* ==========================================================================
   STARTUP: after all the modules (the install window, 09r-pwa.js, must exist). On a touch screen in a browser, the game
   does not start until installation is done or dismissed (see README, "Mobile version"); elsewhere, it starts right away.
   ========================================================================== */
if (!window.WebGLRenderingContext) $('loadMsg').textContent = _t('WebGL is not available in this browser.');
else if (!pwaGate(boot)) boot();
