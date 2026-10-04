// Bank of Romni loans. Borrow Glorp Coins, pay back 20% more within 5 minutes of play.
// At 5 minutes the loan is overdue; 30 seconds after that Winty comes to collect.
// The clock only runs while you're actually playing (not in menus, not with the tab closed).
import { read, write } from '../../scores.js';

export const LOAN_AMOUNTS = [100, 250, 500, 1000];
export const INTEREST = 0.2;
export const DUE = 300; // seconds
export const COLLECT = DUE + 30;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createLoans({ wallet, hud, sfx, onCollect }) {
  const st = read('simloan', null) || { owed: 0, t: 0, principal: 0 };
  let saveT = 0;
  let collecting = false;
  let warned = false;
  const save = () => write('simloan', st);

  function chip() {
    if (!st.owed) return hud.setLoan(null);
    if (collecting) return hud.setLoan(`🏃 WINTY IS COLLECTING ${st.owed} 🪙`, 'collect');
    if (st.t < DUE) return hud.setLoan(`💸 OWE ${st.owed} 🪙 · ${mmss(DUE - st.t)}`, st.t > DUE - 60 ? 'soon' : 'ok');
    return hud.setLoan(`⚠️ OVERDUE ${st.owed} 🪙 · WINTY IN ${mmss(COLLECT - st.t)}`, 'late');
  }
  chip();

  const api = {
    get owed() {
      return st.owed;
    },
    get collecting() {
      return collecting;
    },
    borrow(amount) {
      if (st.owed) return false;
      st.principal = amount;
      st.owed = Math.round(amount * (1 + INTEREST));
      st.t = 0;
      warned = false;
      wallet.add(amount);
      save();
      chip();
      return true;
    },
    repay() {
      if (!st.owed || !wallet.spend(st.owed)) return false;
      st.owed = 0;
      st.t = 0;
      collecting = false;
      save();
      chip();
      return true;
    },
    // Winty caught you: she takes what you have (up to what you owe) and the loan is closed
    settle() {
      const take = Math.min(wallet.coins, st.owed);
      if (take > 0) wallet.spend(take);
      st.owed = 0;
      st.t = 0;
      collecting = false;
      save();
      chip();
      return take;
    },
    // call while playing (not paused)
    update(dt) {
      if (!st.owed) return;
      const before = st.t;
      st.t += dt;
      if (before < DUE && st.t >= DUE) {
        hud.banner('YOUR LOAN IS OVERDUE', `Pay Romni ${st.owed} 🪙 NOW. Winty comes in 30 seconds.`);
        sfx.fail();
      }
      if (!warned && st.t >= COLLECT - 10) {
        warned = true;
        hud.say('ROMNI', 'Last chance. Winty is putting her boots on.', { color: '#f5cd30', ms: 4000 });
      }
      if (st.t >= COLLECT && !collecting) {
        collecting = true;
        onCollect();
      }
      saveT -= dt;
      if (saveT <= 0) {
        saveT = 2;
        save();
      }
      chip();
    },
    panel() {
      const root = el('div', 'casino bank');
      const coins = el('div', 'casino-coins');
      root.appendChild(coins);
      const status = el('div', 'slot-result');
      root.appendChild(status);
      const row = el('div', 'bets');
      root.appendChild(row);
      root.appendChild(el('p', 'fine', `Loans cost ${INTEREST * 100}% interest. Pay back within 5 minutes of play. Miss it by 30 seconds and Winty comes to collect, takes what you have, and locks you in her dungeon.`));
      function render() {
        coins.textContent = `🪙 ${wallet.coins} Glorp Coins`;
        row.innerHTML = '';
        if (st.owed) {
          status.textContent = st.t < DUE ? `You owe ${st.owed} 🪙 · due in ${mmss(DUE - st.t)}` : `OVERDUE: ${st.owed} 🪙 · Winty in ${mmss(Math.max(0, COLLECT - st.t))}`;
          status.style.color = st.t < DUE ? '#ffe14d' : '#ff4f6d';
          const pay = el('button', 'btn primary spin', `REPAY ${st.owed} 🪙`);
          pay.type = 'button';
          pay.disabled = wallet.coins < st.owed;
          pay.addEventListener('click', () => {
            if (api.repay()) {
              sfx.win();
              status.textContent = 'PAID IN FULL. Romni respects you now.';
              status.style.color = '#7CFF4F';
              setTimeout(render, 900);
            }
          });
          row.appendChild(pay);
          if (wallet.coins < st.owed) row.appendChild(el('p', 'fine', `You need ${st.owed - wallet.coins} more 🪙. Go knock stuff over, fish, or gamble (bad idea).`));
        } else {
          status.textContent = 'How much do you need?';
          status.style.color = '';
          for (const a of LOAN_AMOUNTS) {
            const b = el('button', 'btn small primary', `BORROW ${a} 🪙 (repay ${Math.round(a * (1 + INTEREST))})`);
            b.type = 'button';
            b.addEventListener('click', () => {
              if (api.borrow(a)) {
                sfx.ding();
                render();
              }
            });
            row.appendChild(b);
          }
        }
      }
      render();
      return root;
    },
  };
  return api;
}
