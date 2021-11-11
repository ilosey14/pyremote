window.onerror = function () {
	alert(Array.from(arguments).join('\n'))
};

(function () {

const remote = {
	DBLCLICK: -1,
	LEFT: 0,
	MIDDLE: 1,
	RIGHT: 2,
	BACK: 3,
	FORWARD: 4,
	move: (x, y) => request('MOVE', { x, y }),
	down: () => request('DOWN'),
	up: () => request('UP'),
	click: b => request('CLICK', { b }),
	dblclick: () => request('DBLCLICK'),
	scroll: d => request('SCROLL', { d }),
	key: k => request('KEY', { k }),
	back: () => remote.key('alt+left'),
	forward: () => remote.key('alt+right'),
	menu: () => menu.classList.toggle('show')
};

function request(method, data) {
	let url = data
		? '/?' + new URLSearchParams(data).toString()
		: '/';

	return fetch(url, { method });
};

function debounce(f, delay) {
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

	this.downTimestamp
		= this.upTimestamp
		= Date.now();

	this.dblClickDelay = Pointer.dblClickDelay;
	this.rClickDelay = Pointer.rClickDelay;
}

Pointer.dblClickDelay = 500;
Pointer.rClickDelay = 500;

/**
 * Sets the pointer in the down position.
 * @param {number} x
 * @param {number} y
 */
Pointer.prototype.setDown = function (x, y) {
	let now = Date.now();

	this.lastX = x;
	this.lastY = y;
	this.isDown = true;
	this.isDblClick = (now - this.dblClickDelay < this.downTimestamp); // before setting timestamp
	this.didMove = false;
	this.downTimestamp = now;
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
	let now = Date.now();

	this.lastX = x;
	this.lastY = y;
	this.isDown = false;
	this.isRClick = (now - this.rClickDelay > this.downTimestamp);
	this.upTimestamp = now;
};

// init
let $ = a => document.getElementById(a),
	touchPad = $('touch-pad'),
	scrollPad = $('scroll-pad'),
	scrollDown = $('scroll-down'),
	scrollUp = $('scroll-up'),
	textForm = $('text-form'),
	textInput = $('text-input'),
	menu = $('menu'),
	actionButtons = document.querySelectorAll('[data-action]'),
	touch = new Pointer(3),
	scroll = new Pointer(0.2),
	round = (x, digits = 0) => {
		let factor = Math.pow(10, digits);
		return Math.round(factor * x) / factor;
	};

// set up touch actions
touchPad.onpointerdown = function (e) {
	touch.setDown(e.clientX, e.clientY);
};

touchPad.onpointermove = debounce(function (e) {
	if (!touch.isDown) return;

	let dx = touch.scale * (e.clientX - touch.lastX),
		dy = touch.scale * (e.clientY - touch.lastY);

	// ignore sending no debounced movement
	if (dx === 0 && dy === 0) return;

	// check for click and drag
	if (touch.isDblClick && !touch.didMove)
		remote.down();

	remote.move(dx, dy);
	touch.setMove(e.clientX, e.clientY);
}, 100);

touchPad.onpointerup = function(e) {
	touch.setUp(e.clientX, e.clientY)

	// ignore drag
	if (touch.didMove) {
		// finish click and drag
		touch.isDblClick && remote.up();

		return;
	}

	// check for right click
	let button = e.button;

	if (touch.isRClick)
		button = remote.RIGHT;

	// invoke action
	switch (button) {
		case remote.LEFT:
		case remote.MIDDLE:
		case remote.RIGHT:
			remote.click(button);
			break;
		case remote.BACK:
			remote.back();
			break;
		case remote.FORWARD:
			remote.forward();
			break;
	}
};

scrollPad.onpointerdown = function (e) {
	scroll.setDown(0, e.clientY);
};

scrollPad.onpointermove = debounce(function (e) {
	// can invert scrolling with negative scale
	let dy = round(scroll.scale * (e.clientY - scroll.lastY), 1);

	// ignore sending no debounced movement
	if (!dy) return;

	scroll.setUp(0, e.clientY);
	remote.scroll(dy);
}, 100);

scrollDown.onclick = function () {
	remote.scroll(-scroll.scale);
};

scrollUp.onclick = function () {
	remote.scroll(scroll.scale);
};

// set button actions

textForm.onsubmit = e => e.preventDefault();
textInput.onkeyup = e => remote.key(e.key);
textInput.onblur = () => window.scrollTo({ top: 0 });

for (let button of actionButtons) {
	let { action, value } = button.dataset;

	button.onclick = () => remote[action]?.(value);
}

})()