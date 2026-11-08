/* ==========================================================================
   TEXTES LÉGAUX : politique de confidentialité, conditions d'utilisation, mentions légales
   Écran « Confidentialité et conditions », ouvert depuis le menu principal, le Profil et la case d'inscription.
   À COMPLÉTER PAR L'ÉDITEUR avant la mise en ligne : LEGAL.name, LEGAL.address, LEGAL.email, LEGAL.host, dans legal.local.json à la
   racine (non versionné, voir legal.example.json) : build.py y prend les valeurs et signale les crochets qui restent. Une valeur est un
   texte, ou {"fr": ..., "en": ...} quand elle change avec la langue ; une adresse vide n'est pas affichée. Ces textes décrivent ce que fait le code (pas de compte, progression sur l'appareil, salons en ligne par le
   serveur de jeu, src/09d-netrelay.js) : à relire si l'un change.
   Ce n'est pas un avis juridique : faire relire le texte par un juriste si le jeu devient un vrai service.
   ========================================================================== */
const LEGAL = {
  version: '2026-11-08',
  name: '[Nom ou raison sociale de l\u0027éditeur]',
  address: '[Adresse postale de l\u0027éditeur]',
  email: '[Adresse e-mail de contact]',
  host: '[Hébergeur du jeu et du serveur de jeu : nom et adresse]',
  tab: 'privacy',
};
function legalGo(tab) { LEGAL.tab = tab; uiGo('legal'); }
function legalRender() {
  const body = $('lgBody'); if (!body) return;
  seg($('lgTabs'), [['privacy', _t('Confidentialité')], ['terms', _t('Conditions d\u0027utilisation')], ['notice', _t('Mentions légales')]], () => LEGAL.tab, (v) => { LEGAL.tab = v; legalRender(); sfxUi('click'); });
  $('lgSub').textContent = _t('Version du {0}', newsDate(LEGAL.version));
  const v = (x) => esc(typeof x === 'string' ? x : (x[LANG] || x.en || x.fr || ''));
  const L = { name: v(LEGAL.name), address: v(LEGAL.address), email: v(LEGAL.email), host: v(LEGAL.host) };
  const who = L.address ? L.name + ', ' + L.address : L.name;
  body.scrollTop = 0; $('scr-legal').scrollTop = 0; // c\u0027est l\u0027écran qui défile : chaque onglet (et chaque ouverture) reprend le texte en haut
  if (LEGAL.tab === 'terms') {
    body.innerHTML = `<h4>${_t('1. Objet')}</h4><p>${_t('War Bash est un jeu de tir gratuit, joué dans le navigateur, en solo contre des bots ou en ligne. Ces conditions encadrent son usage.')}</p>
<h4>${_t('2. Comportement')}</h4><p>${_t('Sont interdits : tricher (modifier le jeu, falsifier des résultats, exploiter une faille), choisir un pseudo injurieux, haineux ou trompeur, et harceler d\u0027autres joueurs, y compris dans la discussion d\u0027un salon. Les mots grossiers ou haineux sont refusés dans les pseudos et masqués dans la discussion. Dans un salon, chacun peut masquer un joueur et l\u0027hôte peut l\u0027exclure.')}</p>
<h4>${_t('3. Progression')}</h4><p>${_t('Les niveaux, l\u0027expérience et les déblocages sont gardés sur votre appareil, sans valeur monétaire. Effacer les données du navigateur les efface.')}</p>
<h4>${_t('4. Disponibilité et responsabilité')}</h4><p>${_t('Le jeu est fourni "en l\u0027état", gratuitement, sans garantie de disponibilité continue : il peut être interrompu, modifié ou arrêté. Dans la mesure permise par la loi, l\u0027éditeur n\u0027est pas responsable des dommages indirects liés à l\u0027usage du jeu.')}</p>
<h4>${_t('5. Licences')}</h4><p>${_t('Le code du jeu est publié sous licence MIT. Il dérive de Riposte: Frontline, de BenDBS. Les textures et éclairages sont sous licence CC0, les sons sous les licences données dans les crédits du projet.')}</p>
<h4>${_t('6. Contact')}</h4><p>${_t('Contact : {0}', L.email)}</p>`;
    return;
  }
  if (LEGAL.tab === 'notice') {
    body.innerHTML = `<h4>${_t('Éditeur')}</h4><p>${L.name}<br>${L.address ? L.address + '<br>' : ''}${_t('Contact : {0}', L.email)}</p>
<h4>${_t('Hébergement')}</h4><p>${L.host}</p>`;
    return;
  }
  body.innerHTML = `<h4>${_t('1. Qui est responsable de vos données ?')}</h4><p>${_t('{0}. Contact pour toute question ou demande : {1}.', who, L.email)}</p>
<h4>${_t('2. Quelles données, pour quoi ?')}</h4>
<ul>
<li><b>${_t('Sur votre appareil')}</b> ${_t(': vos réglages, votre pseudo et votre progression (niveau, expérience, armes, classes, tenues) restent dans le stockage de votre navigateur. Ils ne sont envoyés nulle part.')}</li>
<li><b>${_t('Multijoueur')}</b> ${_t(': quand vous jouez en ligne, votre pseudo, votre niveau, vos actions de jeu et vos messages de discussion passent par notre serveur de jeu, qui les transmet aux autres joueurs du salon. Les joueurs ne se connectent jamais directement entre eux :')} <b>${_t('votre adresse IP n\u0027est pas visible des autres joueurs')}</b>${_t(', seulement du serveur. Il ne garde ni vos messages ni votre partie une fois le salon fermé.')} <i>${_t('Base : exécution du service que vous demandez (art. 6.1.b du RGPD).')}</i></li>
<li><b>${_t('Mesure d\u0027audience et erreurs')}</b> ${_t(': quand vous jouez en ligne, le serveur de jeu compte les sessions de façon anonyme (un identifiant tiré au hasard et gardé sur votre appareil, l\u0027adresse de la page, la langue et le fuseau horaire) et reçoit les erreurs techniques du jeu, pour suivre la fréquentation et corriger les problèmes. Aucun nom, aucune adresse e-mail.')} <i>${_t('Base : intérêt légitime (art. 6.1.f).')}</i></li>
</ul>
<h4>${_t('3. Ce que nous ne faisons pas')}</h4><p>${_t('Pas de compte, pas d\u0027e-mail, pas de publicité, pas de revente ni de cession de données, pas de profilage.')}</p>
<h4>${_t('4. Qui reçoit vos données ?')}</h4><p>${_t('Uniquement l\u0027hébergeur du jeu et du serveur de jeu, pour fournir le service (voir Mentions légales). Pour fonctionner, la page charge aussi ses polices de caractères chez Google Fonts, qui reçoit donc votre adresse IP comme tout site.')}</p>
<h4>${_t('5. Cookies et stockage')}</h4><p>${_t('Aucun cookie. Le navigateur garde vos réglages et votre progression sur votre appareil : vous pouvez les effacer à tout moment depuis les réglages du navigateur.')}</p>
<h4>${_t('6. Vos droits')}</h4><p>${_t('Pour toute demande d\u0027accès, de rectification ou d\u0027effacement, écrivez à {0}. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l\u0027autorité de protection des données de votre pays.', L.email)}</p>
<h4>${_t('7. Changements')}</h4><p>${_t('La date en haut de cette page indique la version en vigueur.')}</p>`;
}
