window.addEventListener('error', e => {
	if (e.message !== 'Script error.')
		alert(`${e.filename} (${e.lineno},${e.colno}): ${e.message}`)
});

(function () {

const buttons = {
	DBLCLICK: -1,
	LEFT: 0,
	MIDDLE: 1,
	RIGHT: 2,
	BACK: 3,
	FORWARD: 4
};
const keyState = { };
const remote = {
	ping: () => request('PING').then(
		() => isErrorBanner() && showSuccessBanner('Connected!')),
	move: (x, y) => request('MOVE', { x, y }),
	down: b => request('DOWN', { b }),
	up: b => request('UP', { b }),
	click: b => request('CLICK', { b }),
	dblclick: b => request('DBLCLICK', { b }),
	scroll: d => request('SCROLL', { d }),
	key: k => request('KEY', { k }),
	keyWithModifiers: k => remote.key(
		Object.keys(keyState)
			.filter(key => keyState[key]).join('+') + '+' + k),
	toggleModifier: (key, state) => keyState[key] = (state === undefined)
		? !keyState[key]
		: (state === 'true'),
	resetModifiers: () => Object.keys(keyState).forEach(key => delete keyState[key]),
	back: () => remote.key('alt+left'),
	forward: () => remote.key('alt+right'),
	menu: () => menu.classList.toggle('show'),
	popup: name => showPopup(name)
};

function request(method, data) {
	const url = data
		? '/?' + new URLSearchParams(data).toString()
		: '/';

	return fetch(url, { method })
		.catch(e => {
			showErrorBanner('Could not reach server.', true);
			return Promise.reject(e);
		});
};

function throttle(f, delay) {
	if (typeof f !== 'function')
		throw '[debounce] first argument must be a function.';

	let isCalled = false

	return function () {
		if (isCalled) return;

		f(...arguments);
		isCalled = true;

		setTimeout(() => isCalled = false, delay);
	};
}

function Pointer(scale) {
	this.lastX = 0;
	this.lastY = 0;
	this.scale = scale;
	this.isDown = false;
	this.isDblClick = false;
	this.isRClick = false;
	this.didMove = false;
	this.timeoutId = 0;

	this.downTimestamp
		= this.upTimestamp
		= Date.now();

	this.dblClickDelay = Pointer.dblClickDelay;
	this.rClickDelay = Pointer.rClickDelay;
}

Pointer.dblClickDelay = 300;
Pointer.rClickDelay = 300;
Pointer.touchPointRadius = 16;

/**
 * Determines whether the given point is distinct from the current pointer location.
 * @param {number} x
 * @param {number} y
 */
Pointer.prototype.isDistinct = function (x, y) {
	const x1 = this.lastX;
	const y1 = this.lastY;

	return Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2) > Pointer.touchPointRadius;
};

/**
 * Sets the pointer in the down position.
 * @param {number} x
 * @param {number} y
 */
Pointer.prototype.setDown = function (x, y) {
	const now = Date.now();

	this.isDblClick = (now - this.dblClickDelay < this.downTimestamp) && !this.isDistinct(x, y);
	this.lastX = x;
	this.lastY = y;
	this.isDown = true;
	this.didMove = false;
	this.downTimestamp = now;

	if (this.isDblClick)
		window.clearTimeout(this.timeoutId);
};

/**
 * Moves the pointer.
 * @param {number} x
 * @param {number} y
 */
Pointer.prototype.setMove = function (x, y) {
	this.lastX = x,
	this.lastY = y;

	if (!this.didMove) this.didMove = true;
};

/**
 * Sets the pointer in the up position.
 * @param {number} x
 * @param {number} y
 */
Pointer.prototype.setUp = function (x, y) {
	const now = Date.now();

	this.lastX = x;
	this.lastY = y;
	this.isDown = false;
	this.isRClick = (now - this.rClickDelay > this.downTimestamp);
	this.upTimestamp = now;
};

// init
const $ = a => document.getElementById(a);
const touchPad = $('touch-pad');
const scrollPad = $('scroll-pad');
const scrollDown = $('scroll-down');
const scrollUp = $('scroll-up');
const textForm = $('text-form');
const textInput = $('text-input');
const menu = $('menu');
const menuMask = $('menu-mask');
const touch = new Pointer(3);
const scroll = new Pointer(0.2);
const round = (x, digits = 0) => {
	const factor = Math.pow(10, digits);
	return Math.round(factor * x) / factor;
};

// set up touch actions

touchPad.addEventListener('pointerdown', e => touch.setDown(e.clientX, e.clientY));

touchPad.addEventListener('pointermove', throttle(e => {
	if (!touch.isDown) return;

	const dx = touch.scale * (e.clientX - touch.lastX);
	const dy = touch.scale * (e.clientY - touch.lastY);

	// check for click and drag
	// if (touch.isDblClick && !touch.didMove)
	// 	remote.down();

	// ignore sending no debounced movement
	if (dx === 0 && dy === 0) return;

	remote.move(dx, dy);
	touch.setMove(e.clientX, e.clientY);
}, 100));

touchPad.addEventListener('pointerup', e => {
	touch.setUp(e.clientX, e.clientY)

	// ignore drag
	if (touch.didMove) {
		// finish click and drag
		touch.isDblClick && remote.up(buttons.LEFT);

		return;
	}

	// check for right click
	const button = touch.isDblClick
		? buttons.DBLCLICK
		: touch.isRClick
		? buttons.RIGHT
		: e.button;

	// invoke action
	switch (button) {
		case buttons.LEFT:
			remote.down(button);
			touch.timeoutId = window.setTimeout(() => remote.up(button), Pointer.dblClickDelay);
			break;
		case buttons.RIGHT:
		case buttons.MIDDLE:
			remote.click(button);
			break;
		case buttons.DBLCLICK:
			remote.up(button);
			remote.dblclick(button);
			break;
		case buttons.BACK:
			remote.back();
			break;
		case buttons.FORWARD:
			remote.forward();
			break;
	}
});

scrollPad.addEventListener('pointerdown', e => scroll.setDown(0, e.clientY));

scrollPad.addEventListener('pointermove', throttle(e => {
	// can invert scrolling with negative scale
	const dy = round(scroll.scale * (e.clientY - scroll.lastY), 1);

	// ignore sending no debounced movement
	if (!dy) return;

	scroll.setUp(0, e.clientY);
	remote.scroll(dy);
}, 100));

scrollDown.addEventListener('click', () => remote.scroll(-scroll.scale));
scrollUp.addEventListener('click', () => remote.scroll(scroll.scale));

textForm.addEventListener('submit', e => e.preventDefault());

textInput.addEventListener('keyup', e => {
	remote.key(e.key);
	if (e.key === 'Enter') e.target.value = null;
});

textInput.addEventListener('focus', () => window.scrollTo({ top: textInput.offsetTop }));
textInput.addEventListener('blur', () => window.scrollTo({ top: 0 }));
menuMask.addEventListener('click', () => remote.menu());

// set control actions

const controls = Array.from(document.querySelectorAll('*'))
	.filter(node => Object.keys(node.dataset).length);

for (const control of controls) {
	const actions = control.dataset;

	for (const key in actions) {
		if (!key.startsWith('on')) continue;

		const [action, args] = actions[key].split(':');

		if (!(action in remote)) continue;

		const type = key.replace(/^on/, '');
		const argList = args ? args.split(',').map(arg => arg.trim()) : [];

		control.addEventListener(type, () => {
			// get dynamic values
			const values = argList.map(arg => arg.startsWith('#')
				? document.getElementById(arg.slice(1))?.value
				: arg);
			remote[action](...values);
		});
	}
}

// popup functionality

const popupDialog = $('popup-dialog');
const popupContent = $('popup-content');
const popupTemplates = $('popup-templates');

popupDialog.addEventListener('close', () => popupTemplates.appendChild(popupContent.firstElementChild));

function showPopup(name) {
	const content = popupTemplates.querySelector(`#${name}`);

	if (content) {
		popupContent.appendChild(content)
			.dispatchEvent(new Event('load'));
		popupDialog.showModal();
	}
}

// test connection

const banner = $('banner');
const bannerMask = $('banner-mask');

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible')
		remote.ping();
});

window.addEventListener('offline', () => showErrorBanner('No network connection.'));
window.addEventListener('online', () => showSuccessBanner('Connected!'));

function showErrorBanner(message, showRetry = false) {
	banner.textContent = message;

	banner.classList.remove('success');
	banner.classList.add('show', 'error');
	bannerMask.classList.add('show');
	bannerMask.classList.toggle('retry', showRetry);
}

function showSuccessBanner(message) {
	banner.textContent = message;

	banner.classList.remove('error');
	banner.classList.add('show', 'success');
	bannerMask.classList.remove('show');

	window.setTimeout(hideBanner, 3000);
}

function hideBanner() {
	banner.classList.remove('show', 'success', 'error');
	bannerMask.classList.remove('show', 'retry');
}

function isErrorBanner() {
	return banner.classList.contains('error');
}

})()