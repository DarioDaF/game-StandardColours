
import { html, render, Component } from 'https://unpkg.com/htm/preact/index.mjs?module';

import { observable, autorun } from 'https://unpkg.com/mobx@5?module';
import { observer } from 'https://unpkg.com/mobx-preact?module';

const CHEAT = window.location.hash === '#cheat';

const model = observable({ bars: {}, circles: {}, difficulty: 10, page: [ 'pgMenu' ], extraTop: '', extraBottom: '' });

function obsComp(comp, $el) {
    render(html`<${observer(comp)} />`, $el);
}

for(const $el of document.getElementsByClassName('my-bar')) {
    const id = $el.id;
    console.log(`Preparing ${id}`);
    model.bars[id] = observable({ val: 0, max: $el.dataset.max ?? 1, bg: $el.dataset.bg ?? '', fill: $el.dataset.fill, nodifficulty: !!$el.dataset.nodifficulty, readonly: !!$el.dataset.readonly });
    obsComp(
        () => {
            const res = [];
            for(let i = 0; i < model.bars[id].max; ++i) {
                res.push(html`
                    <div style="background-color: ${model.bars[id].val > i ? model.bars[id].fill : model.bars[id].bg };" onclick="${() => { if(!model.bars[id].readonly) model.bars[id].val = i; }}"></div>
                `);
            }
            res.push(html`<div onclick="${() => { model.bars[id].val = model.bars[id].max; }}">MAX</div>`)
            return html`${ res }`;
        },
        $el
    )
}

function getRatio(mBar) {
    return mBar.val / mBar.max;
}

function mixRGB(r, g, b) {
    return `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
}

function mixCYM(c, y, m) {
    return mixRGB(1-c, 1-m, 1-y);
}

for(const $el of document.getElementsByClassName('rgb')) {
    const id = $el.id;
    console.log(`Preparing ${id}`);
    model.circles[id] = observable({ val: { r: 0, g: 0, b: 0 }, hidden: false });
    obsComp(
        () => html`<div style="display: ${ model.circles[id].hidden ? 'none' : '' }; background-color: ${mixRGB(model.circles[id].val.r, model.circles[id].val.g, model.circles[id].val.b)};"></div>`,
        $el
    );
}

for(const $el of document.getElementsByClassName('cym')) {
    const id = $el.id;
    console.log(`Preparing ${id}`);
    model.circles[id] = observable({ val: { c: 0, y: 0, m: 0 }, hidden: false });
    obsComp(
        () => html`<div style="display: ${ model.circles[id].hidden ? 'none' : '' }; background-color: ${mixCYM(model.circles[id].val.c, model.circles[id].val.y, model.circles[id].val.m)};"></div>`,
        $el
    );
}

obsComp(() => html`${model.extraTop}`, document.getElementById('extraTop'));
obsComp(() => html`${model.extraBottom}`, document.getElementById('extraBottom'));

// Confirm buttons
let confirmCB = () => {};
let confirming = false;
const confirmCBCB = async () => {
    if(!confirming) {
        confirming = true;
        await confirmCB();
        confirming = false;
    }
};
for(const $el of document.getElementsByClassName('confirm')) {
    $el.addEventListener('click', confirmCBCB);
}

// Difficulty settings
autorun(() => {
    for(const bar of Object.values(model.bars)) {
        if(!bar.nodifficulty) {
            bar.max = model.difficulty;
        }
    }
});
autorun(() => {
    model.difficulty = model.bars['bDifficulty'].val;
});

// Current page
autorun(() => {
    for(const $el of document.getElementsByClassName('page')) {
        $el.style.display = model.page.includes($el.id) ? 'block' : 'none';
    }
});

// My circles
autorun(() => {
    model.circles['cMyRGB'].val = { r: getRatio(model.bars['bRed']), g: getRatio(model.bars['bGreen']), b: getRatio(model.bars['bBlue']) };
});
autorun(() => {
    model.circles['cMyCYM'].val = { c: getRatio(model.bars['bCyan']), y: getRatio(model.bars['bYellow']), m: getRatio(model.bars['bMagenta']) };
});

function pickRandom() {
    function getRand() {
        return Math.floor(Math.random() * (model.difficulty + 1)) / model.difficulty;
    }
    model.circles['cTargetRGB'].val = { r: getRand(), g: getRand(), b: getRand() };
    model.circles['cTargetCYM'].val = { c: getRand(), y: getRand(), m: getRand() };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//// GAME CODE

let game;
function resetGame() {
    game = {
        mode: '',
        errorSqSum: 0,
        count: 0
    };
    window.game = game;
}
resetGame();

function sq(x) {
    return x * x;
}

document.getElementById('btnBack').addEventListener('click', () => {
    confirmCB = () => {};
    model.extraTop = '';
    model.page = [ 'pgMenu' ];
});

function addErrorSq() {
    if(model.page.includes('pgRGB')) {
        const my = model.circles['cMyRGB'].val;
        const target = model.circles['cTargetRGB'].val;
        game.errorSqSum += sq(my.r - target.r) + sq(my.g - target.g) + sq(my.b - target.b);
        game.count += 1;
    }
    if(model.page.includes('pgCYM')) {
        const my = model.circles['cMyCYM'].val;
        const target = model.circles['cTargetCYM'].val;
        game.errorSqSum += sq(my.c - target.c) + sq(my.y - target.y) + sq(my.m - target.m);
        game.count += 1;
    }
}

function showMy(val) {
    model.circles['cMyRGB'].hidden = !val;
    model.circles['cMyCYM'].hidden = !val;
}

document.getElementById('lLearning').addEventListener('click', () => {
    game.mode = 'learning';
    showMy(true);
    confirmCB = () => { pickRandom(); };
    model.page = [ 'pgDifficulty', 'pgRGB', 'pgCYM' ];
});
document.getElementById('lQuickplay').addEventListener('click', () => {
    resetGame();
    game.mode = 'quickplay';
    model.page = [ 'pgDifficulty' ];
    if(!CHEAT) {
        showMy(false);
    }
    confirmCB = async () => {
        // Real gameplay
        addErrorSq();
        showMy(true);
        if(game.count < 10) {
            if(game.count > 0) {
                await sleep(1000);
            }
            model.extraTop = `Round: ${game.count + 1} / 10`;
            model.page = [ Math.random() >= 0.5 ? 'pgRGB' : 'pgCYM' ];
        } else {
            await sleep(1000);
            model.extraTop = '';
            // Game over show result and go back to Menu
            const std = Math.round(Math.sqrt(game.errorSqSum / (game.count * 3)) * 100000) / 100000;
            alert(`${CHEAT ? 'CHEATER: ' : ''}Your error standard deviation is: ${std * 100}%`);
            confirmCB = () => {};
            model.extraBottom = `${CHEAT ? 'CHEATER: ' : ''}Last quickplay standard deviation is: ${std * 100}%`;
            model.page = [ 'pgMenu' ];
        }
        if(!CHEAT) {
            showMy(false);
        }
        pickRandom();
    };
});
document.getElementById('l2v2').addEventListener('click', () => {
    alert('Not implemented yet :(');
});
document.getElementById('lHardcore').addEventListener('click', () => {
    resetGame();
    game.mode = 'hardcore';
    model.page = [ 'pgDifficulty' ];
    if(!CHEAT) {
        showMy(false);
    }
    confirmCB = async () => {
        // Real gameplay
        addErrorSq();
        showMy(true);
        if(game.errorSqSum > 0) {
            // Ya lost loozer
            await sleep(1000);
            model.extraTop = '';
            alert(`${CHEAT ? 'CHEATER: ' : ''}Hardcored ${game.count - 1} rounds`);
            confirmCB = () => {};
            model.extraBottom = `${CHEAT ? 'CHEATER: ' : ''}Last hardcore lasted ${game.count - 1} rounds`;
            model.page = [ 'pgMenu' ];
        } else {
            if(game.count > 0) {
                await sleep(1000);
            }
            model.extraTop = `Round: ${game.count + 1} / ∞`;
            model.page = [ Math.random() >= 0.5 ? 'pgRGB' : 'pgCYM' ];
        }
        if(!CHEAT) {
            showMy(false);
        }
        pickRandom();
    };
});

pickRandom(); // ???
