(function () {
  var SIZE = 25;
  var START_BALANCE = 1000;
  var KEY = "minas:balance";

  var GEM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.2 3h11.6l4.2 5.6L12 21.5 2 8.6 6.2 3Z" opacity=".95"/><path d="M2 8.6h20M8.6 8.6 12 3l3.4 5.6M8.6 8.6 12 21.5l3.4-12.9" fill="none" stroke="var(--panel)" stroke-width="1.2" stroke-linejoin="round" opacity=".55"/></svg>';
  var BOMB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="11" cy="14" r="7"/><path d="M16 8.5 18.5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M19 2.5v2M22 5.5h-2M21 3l-1.4 1.4M17 3.5l1.4 1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="8.4" cy="11.6" r="1.7" fill="var(--panel)" opacity=".6"/></svg>';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    balance: $("balance"), grid: $("grid"), message: $("message"),
    mult: $("statMult"), payout: $("statPayout"), next: $("statNext"),
    bet: $("bet"), half: $("half"), double: $("double"), max: $("max"),
    mines: $("mines"), minesOut: $("minesOut"),
    action: $("action"), reset: $("reset"),
    historyWrap: $("historyWrap"), history: $("history")
  };

  var balance = START_BALANCE;
  try {
    var saved = parseInt(localStorage.getItem(KEY), 10);
    if (isFinite(saved) && saved >= 0) balance = saved;
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, String(balance)); } catch (e) {} }

  var game = null;      // { bet, mines, bombs:Set, opened:Set, over, won, hit }
  var history = [];
  var tiles = [];

  var nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  var mf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmt(n) { return nf.format(n); }
  function fmtMult(m) { return mf.format(m) + "×"; }

  // Multiplicador justo (chance real) com 1% de margem da casa.
  function multiplier(picks, mines) {
    if (picks === 0) return 1;
    var m = 1;
    for (var i = 0; i < picks; i++) m *= (SIZE - i) / (SIZE - mines - i);
    return m * 0.99;
  }

  function randInt(n) {
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  }
  function pickBombs(count) {
    var idx = [];
    for (var i = 0; i < SIZE; i++) idx.push(i);
    for (var j = SIZE - 1; j > 0; j--) {
      var k = randInt(j + 1);
      var t = idx[j]; idx[j] = idx[k]; idx[k] = t;
    }
    return new Set(idx.slice(0, count));
  }

  function clampBet() {
    var v = parseInt(el.bet.value, 10);
    if (!isFinite(v) || v < 1) v = 1;
    if (v > balance) v = Math.max(balance, 1);
    el.bet.value = v;
    return v;
  }

  function isPlaying() { return game && !game.over; }

  // ---------- Construção do tabuleiro ----------
  for (var i = 0; i < SIZE; i++) {
    (function (i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.setAttribute("aria-label", "Casa " + (i + 1));
      b.addEventListener("click", function () { openTile(i); });
      el.grid.appendChild(b);
      tiles.push(b);
    })(i);
  }

  // ---------- Ações ----------
  function startGame() {
    var bet = clampBet();
    if (balance < 1 || bet > balance) {
      setMessage("Saldo insuficiente para essa aposta.", "");
      return;
    }
    var mines = parseInt(el.mines.value, 10);
    balance -= bet;
    save();
    game = { bet: bet, mines: mines, bombs: pickBombs(mines), opened: new Set(), over: false, won: false, hit: -1 };
    setMessage("Abra as casas. Cada gema aumenta o multiplicador.", "");
    render();
  }

  function openTile(i) {
    if (!isPlaying() || game.opened.has(i)) return;
    if (game.bombs.has(i)) {
      game.over = true;
      game.hit = i;
      pushHistory(-game.bet);
      setMessage("<strong>Bomba!</strong> Você perdeu " + fmt(game.bet) + ".", "lose");
      render();
      el.grid.classList.remove("shake");
      void el.grid.offsetWidth;
      el.grid.classList.add("shake");
      return;
    }
    game.opened.add(i);
    if (game.opened.size === SIZE - game.mines) {
      cashOut(true);
    } else {
      render();
    }
  }

  function cashOut(perfect) {
    if (!isPlaying() || game.opened.size === 0) return;
    var mult = multiplier(game.opened.size, game.mines);
    var payout = Math.floor(game.bet * mult);
    balance += payout;
    save();
    game.over = true;
    game.won = true;
    pushHistory(payout - game.bet);
    var txt = perfect ? "<strong>Tabuleiro limpo!</strong> " : "<strong>Sacado!</strong> ";
    setMessage(txt + "Você recebeu " + fmt(payout) + " (" + fmtMult(mult) + ").", "win");
    render();
  }

  function pushHistory(delta) {
    history.unshift(delta);
    if (history.length > 8) history.pop();
  }

  function setMessage(html, cls) {
    el.message.className = "message" + (cls ? " " + cls : "");
    el.message.innerHTML = html;
  }

  // ---------- Render ----------
  function render() {
    el.balance.textContent = fmt(balance);
    var playing = isPlaying();

    for (var i = 0; i < SIZE; i++) {
      var t = tiles[i];
      var s = "hidden";
      if (game) {
        if (game.opened.has(i)) s = "gem";
        else if (game.over && game.bombs.has(i)) s = (i === game.hit) ? "hit" : "bomb-ghost";
        else if (game.over) s = "gem-ghost";
      }
      if (t.dataset.s !== s) {
        var changed = t.dataset.s !== undefined;
        t.dataset.s = s;
        var cls = "tile";
        var html = "";
        if (s === "gem") { cls += " gem"; html = GEM; }
        else if (s === "hit") { cls += " bomb hit"; html = BOMB; }
        else if (s === "bomb-ghost") { cls += " bomb ghost"; html = BOMB; }
        else if (s === "gem-ghost") { cls += " gem ghost"; html = GEM; }
        if (playing && s === "hidden") cls += " playable";
        if (changed && (s === "gem" || s === "hit")) cls += " pop";
        t.className = cls;
        t.innerHTML = html;
      } else {
        t.classList.toggle("playable", playing && s === "hidden");
      }
      t.disabled = !(playing && s === "hidden");
    }

    // Estatísticas
    var picks = game ? game.opened.size : 0;
    var mines = game ? game.mines : parseInt(el.mines.value, 10);
    var bet = game ? game.bet : (parseInt(el.bet.value, 10) || 0);
    var cur = multiplier(picks, mines);
    el.mult.textContent = fmtMult(cur);
    el.payout.textContent = fmt(Math.floor(bet * cur));
    if (playing && picks < SIZE - mines) {
      el.next.textContent = fmtMult(multiplier(picks + 1, mines));
    } else {
      el.next.textContent = "—";
    }

    // Botões e campos
    el.bet.disabled = el.half.disabled = el.double.disabled = el.max.disabled = playing;
    el.mines.disabled = playing;
    el.minesOut.textContent = el.mines.value;

    var broke = !playing && balance < 1;
    el.reset.hidden = !broke;
    if (playing) {
      el.action.textContent = picks === 0 ? "Abra uma casa para começar" : "Sacar " + fmt(Math.floor(game.bet * cur));
      el.action.disabled = picks === 0;
    } else {
      el.action.textContent = game ? "Jogar de novo" : "Começar";
      el.action.disabled = broke;
    }

    // Histórico
    el.historyWrap.hidden = history.length === 0;
    el.history.innerHTML = "";
    history.forEach(function (d) {
      var p = document.createElement("span");
      p.className = "pill " + (d > 0 ? "up" : d < 0 ? "down" : "even");
      p.textContent = (d > 0 ? "+" : d < 0 ? "−" : "") + fmt(Math.abs(d));
      el.history.appendChild(p);
    });
  }

  // ---------- Eventos ----------
  el.action.addEventListener("click", function () {
    if (isPlaying()) cashOut(false); else startGame();
  });
  el.reset.addEventListener("click", function () {
    balance = START_BALANCE;
    save();
    game = null;
    el.bet.value = 50;
    setMessage("Saldo restaurado. Boa sorte!", "");
    render();
  });
  el.bet.addEventListener("input", function () { if (!isPlaying()) render(); });
  el.bet.addEventListener("change", function () { clampBet(); render(); });
  el.half.addEventListener("click", function () { el.bet.value = Math.max(1, Math.floor((parseInt(el.bet.value, 10) || 1) / 2)); clampBet(); render(); });
  el.double.addEventListener("click", function () { el.bet.value = (parseInt(el.bet.value, 10) || 1) * 2; clampBet(); render(); });
  el.max.addEventListener("click", function () { el.bet.value = balance; clampBet(); render(); });
  el.mines.addEventListener("input", function () { render(); });

  setMessage("Escolha a aposta e o número de bombas, depois toque em Começar.", "");
  clampBet();
  render();
})();