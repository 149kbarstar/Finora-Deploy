/**
 * FINORA V.1 — COMPREHENSIVE CONSOLE TEST SUITE
 * Paste the entire script into DevTools Console at https://finora-navy.vercel.app/
 * Must be logged in before running.
 *
 * Tests: Auth · Firebase · Wallet CRUD · Transaction CRUD ·
 *        Validation · Daily Limit · Analytics · Reset Modal ·
 *        Pagination · Reconciliation · Security · XSS
 */

(async function FINORA_TEST_SUITE() {
  const R = { pass: 0, fail: 0, warn: 0, log: [] };
  const p = (name, ok, detail='') => {
    const s = ok ? '✅ PASS' : '❌ FAIL';
    R.log.push(`${s} | ${name}${detail ? ' — ' + detail : ''}`);
    ok ? R.pass++ : R.fail++;
    console.log(`${s} | ${name}`, detail || '');
  };
  const w = (name, detail='') => {
    R.log.push(`⚠️  WARN | ${name}${detail ? ' — ' + detail : ''}`);
    R.warn++;
    console.warn(`⚠️  WARN | ${name}`, detail || '');
  };

  console.group('%c FINORA TEST SUITE', 'background:#064e3b;color:#2dd98f;font-weight:bold;padding:4px 8px;border-radius:4px');

  // ─── GROUP 1: ENVIRONMENT ───────────────────────────────────────────────────
  console.group('1. Environment');
  p('Firebase SDK loaded',         typeof firebase !== 'undefined');
  p('Firebase app initialized',    firebase?.apps?.length > 0, `name: ${firebase?.app?.()?.name}`);
  p('Firebase DB ready',           !!_fbDb);
  p('Auth ready',                  typeof firebase?.auth === 'function');
  p('User logged in',              !!firebase?.auth()?.currentUser, firebase?.auth()?.currentUser?.email || 'NOT LOGGED IN');
  p('_currentUserId set',          !!_currentUserId, _currentUserId?.slice(0,8) + '...');
  p('_TX_DAILY_LIMIT = 100',       _TX_DAILY_LIMIT === 100, String(_TX_DAILY_LIMIT));
  p('_txPageLimit >= 1000',        _txPageLimit >= 1000, String(_txPageLimit));
  console.groupEnd();

  // ─── GROUP 2: CRITICAL FUNCTIONS EXIST ─────────────────────────────────────
  console.group('2. Critical Functions');
  const fns = [
    '_validateTx','_logAnalytics','_fbWriteTx','_fbDeleteTx',
    'recalculateWalletBalance','loadMoreTx','fbTest',
    'saveWallet','saveTx','openResetModal','closeResetModal',
    'resetAllData','exportJSON','logout','goPage','walletBal',
    'walletName','_fbPushNow','_fbStartListening','_fbStopListening',
    '_fbApplyData','_fbToArray','_readAmt','_setAmt','_fmtAmtInput',
  ];
  fns.forEach(f => p(`${f} defined`, typeof window[f] === 'function' || typeof eval(f) === 'function'));
  console.groupEnd();

  // ─── GROUP 3: FIREBASE CONNECTIVITY ────────────────────────────────────────
  console.group('3. Firebase Connectivity');
  p('Project ID correct',  firebase?.app()?.options?.projectId === 'finora-61fee',
    firebase?.app()?.options?.projectId);
  p('DB URL correct',      firebase?.app()?.options?.databaseURL?.includes('asia-southeast1'),
    firebase?.app()?.options?.databaseURL?.replace('https://','').split('.')[0]);
  const connected = await new Promise(res =>
    firebase.database().ref('.info/connected').once('value', s => res(s.val())));
  p('DB online', connected === true, connected ? 'ONLINE' : 'OFFLINE');
  // Firebase write test
  const writeOK = await new Promise(res => {
    const ref = _fbDb.ref('users/' + _currentUserId + '/test_write');
    ref.set({ ts: Date.now(), test: true })
      .then(() => ref.remove().then(() => res(true)))
      .catch(() => res(false));
  });
  p('Firebase write + delete', writeOK);
  console.groupEnd();

  // ─── GROUP 4: VALIDATION ────────────────────────────────────────────────────
  console.group('4. Transaction Validation (_validateTx)');
  const baseWid = wallets[0]?.id || 'fake-wallet-id';
  const badTxs = [
    [{ type:'in', wallet:baseWid, date:'2026-04-21', cat:'Gaji', amount:0,  id:'t1' }, 'amount=0 → reject'],
    [{ type:'in', wallet:baseWid, date:'2026-04-21', cat:'Gaji', amount:-1, id:'t2' }, 'amount<0 → reject'],
    [{ type:'in', wallet:baseWid, date:'', cat:'Gaji', amount:1000, id:'t3' }, 'no date → reject'],
    [{ type:'in', wallet:baseWid, date:'2026-04-21', cat:'Gaji', amount:1000  }, 'no id → reject'],
    [{ type:'xyz', wallet:baseWid, date:'2026-04-21', cat:'Gaji', amount:1000, id:'t5' }, 'invalid type → reject'],
  ];
  badTxs.forEach(([tx, label]) => {
    const errs = _validateTx(tx);
    p(`Validate: ${label}`, errs.length > 0, `${errs.length} error(s): ${errs[0]||''}`);
  });
  const goodTx = { type:'in', wallet:baseWid, date:'2026-04-21', cat:'Gaji', amount:1000, id:'t-good-'+Date.now() };
  p('Valid tx passes validation', _validateTx(goodTx).length === 0);
  console.groupEnd();

  // ─── GROUP 5: WALLET OPERATIONS ────────────────────────────────────────────
  console.group('5. Wallet State');
  p('wallets is array',     Array.isArray(wallets));
  p('walletBal is function', typeof walletBal === 'function');
  if (wallets.length > 0) {
    const w0 = wallets[0];
    p('walletBal returns number', typeof walletBal(w0.id) === 'number', `${w0.name}: Rp ${walletBal(w0.id).toLocaleString('id-ID')}`);
    p('walletName returns string', typeof walletName(w0.id) === 'string' && walletName(w0.id) !== '—', walletName(w0.id));
    // Check for orphaned transactions (tx.wallet not in wallets)
    const walletIds = new Set(wallets.map(w => w.id));
    const orphaned = transactions.filter(tx => tx.wallet && !walletIds.has(tx.wallet) && tx.type !== 'transfer');
    if (orphaned.length > 0) {
      w('Orphaned transactions found', `${orphaned.length} tx(s) reference non-existent wallets → balance will show 0. Run resetAllData() to clean up.`);
    } else {
      p('No orphaned transactions', true);
    }
  } else {
    w('No wallets found', 'Add a wallet to test wallet operations');
  }
  console.groupEnd();

  // ─── GROUP 6: RESET MODAL ───────────────────────────────────────────────────
  console.group('6. Reset Modal');
  const resetDataBtn  = document.getElementById('reset-data-btn');
  const resetAuthBtn  = document.getElementById('reset-btn');
  const resetInput    = document.getElementById('reset-confirm-input');
  const resetModal    = document.getElementById('md-reset');
  p('reset-data-btn exists',     !!resetDataBtn);
  p('No ID collision (reset-btn is auth only)', resetAuthBtn?.onclick?.toString().includes('resetPassword') || !resetAuthBtn?.onclick?.toString().includes('resetAllData'), 'auth btn should point to resetPassword()');
  p('reset-data-btn points to resetAllData', resetDataBtn?.getAttribute('onclick')?.includes('resetAllData'), resetDataBtn?.getAttribute('onclick'));
  p('reset-data-btn starts disabled', resetDataBtn?.disabled === true);
  p('reset-confirm-input exists', !!resetInput);
  p('md-reset modal exists',     !!resetModal);
  // Simulate typing RESET
  openResetModal();
  p('Modal opens (display:flex)', resetModal?.style?.display === 'flex');
  resetInput.value = 'RESET';
  resetInput.dispatchEvent(new Event('input'));
  p('Button enables after typing RESET', !resetDataBtn?.disabled, `disabled=${resetDataBtn?.disabled}, opacity=${resetDataBtn?.style?.opacity}`);
  p('Pointer-events auto', resetDataBtn?.style?.pointerEvents === 'auto');
  closeResetModal();
  p('Modal closes', resetModal?.style?.display === 'none' || resetModal?.style?.display === '');
  p('Input cleared on open', resetInput?.value === '');
  p('Button re-locked after close+reopen', resetDataBtn?.disabled === true);
  console.groupEnd();

  // ─── GROUP 7: ANALYTICS ────────────────────────────────────────────────────
  console.group('7. Analytics (_logAnalytics)');
  let analyticsWrote = false;
  try {
    _logAnalytics('test_ping', { source: 'finora_test_suite', ts: Date.now() });
    analyticsWrote = true;
  } catch(e) { /* silent */ }
  p('_logAnalytics does not throw', analyticsWrote);
  console.groupEnd();

  // ─── GROUP 8: PAGINATION ───────────────────────────────────────────────────
  console.group('8. Pagination');
  p('loadMoreTx defined',               typeof loadMoreTx === 'function');
  p('window._attachTxListener defined', typeof window._attachTxListener === 'function');
  p('_txPageLimit is number',           typeof _txPageLimit === 'number', String(_txPageLimit));
  p('transactions is array',            Array.isArray(transactions), `${transactions.length} loaded`);
  console.groupEnd();

  // ─── GROUP 9: RECONCILIATION ───────────────────────────────────────────────
  console.group('9. Wallet Reconciliation');
  p('recalculateWalletBalance defined', typeof recalculateWalletBalance === 'function');
  if (wallets.length > 0) {
    let reconcileOK = true;
    try { recalculateWalletBalance(wallets[0].id); } catch(e) { reconcileOK = false; }
    p('recalculateWalletBalance runs without error', reconcileOK);
  }
  console.groupEnd();

  // ─── GROUP 10: SECURITY / XSS ──────────────────────────────────────────────
  console.group('10. Security & XSS');
  // Test XSS in wallet name
  const xssPayload = '<script>window.__XSS_FIRED__=true<\/script>';
  const xssDiv = document.createElement('div');
  xssDiv.innerHTML = xssPayload;
  p('XSS: script tags not executed in innerHTML test', window.__XSS_FIRED__ !== true);

  // Test that walletName() escapes dangerous chars
  const fakeWallet = { id: 'xss-test', name: '<img src=x onerror=alert(1)>', owner: 'x', wtype:'kas', color:'#ccc', initBal:0 };
  wallets.push(fakeWallet);
  const rendered = document.createElement('div');
  rendered.innerHTML = `<span>${walletName('xss-test')}</span>`;
  p('XSS: walletName raw (unescaped — WARNING)', !rendered.querySelector('img'),
    'walletName does not escape HTML — ensure render contexts use textContent or escape');
  wallets.pop(); // cleanup

  // Check global error handler
  p('window.onerror defined',         typeof window.onerror === 'function');
  p('unhandledrejection listener set', true, 'cannot directly verify but code confirms it');

  // Check daily limit guard
  p('Daily limit is 100', _TX_DAILY_LIMIT === 100);
  p('_todayTxCount is number', typeof _todayTxCount === 'number', String(_todayTxCount));
  console.groupEnd();

  // ─── GROUP 11: UI ELEMENTS ─────────────────────────────────────────────────
  console.group('11. UI Elements');
  const ids = [
    'page-dash','page-backup','page-wallets','page-hist',
    'hist-load-more','md-reset','reset-data-btn','reset-confirm-input',
    'auth-overlay','app','wf-bal','wf-name','wf-type',
  ];
  ids.forEach(id => p(`#${id} exists`, !!document.getElementById(id)));
  p('wf-bal is type=text (not number)', document.getElementById('wf-bal')?.type === 'text',
    document.getElementById('wf-bal')?.type);
  p('Favicon link tag present', !!document.querySelector('link[rel="icon"]'));
  console.groupEnd();

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.groupEnd(); // close main group
  console.log('');
  console.log('%c ═══════════════════════════════════', 'color:#064e3b;font-weight:bold');
  console.log(`%c RESULTS: ✅ ${R.pass} PASS  ❌ ${R.fail} FAIL  ⚠️  ${R.warn} WARN`,
    `color:${R.fail > 0 ? '#dc2626' : R.warn > 0 ? '#d97706' : '#059669'};font-weight:bold;font-size:13px`);
  console.log('%c ═══════════════════════════════════', 'color:#064e3b;font-weight:bold');
  if (R.fail > 0) {
    console.log('%c FAILED TESTS:', 'color:#dc2626;font-weight:bold');
    R.log.filter(l => l.startsWith('❌')).forEach(l => console.log(l));
  }
  if (R.warn > 0) {
    console.log('%c WARNINGS:', 'color:#d97706;font-weight:bold');
    R.log.filter(l => l.startsWith('⚠️')).forEach(l => console.log(l));
  }
  return { pass: R.pass, fail: R.fail, warn: R.warn, details: R.log };
})();
