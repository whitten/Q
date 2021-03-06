(function (Q, $, window, document, undefined) {

/**
 * Makes an overlay to show some content above the page.
 * Suitable for showing dialogs, for example.
 * This is replacement for jQuery Tools overlay, it has similar behavoir and API.
 * @param options Object
 * A hash of options, that can include:
 * "left": Optional. Defaults to 'center'. Horizontal position of the overlay. May have 'center' value to be centered horizontally
 *         or have a percentage or absolute (pixels) value of offset from the left border of 'alignParent' (see below).
 * "top": Optional. Defaults to 'middle'. Vertical position of the overlay. May have 'middel' value to be centered vertically
 *        or have a percentage or absolute (pixels) value of offset from the top border of 'alignParent' (see below).
 * "alignParent": Optional. Can be DOM element, jQuery object or jQuery selector. If provided overlay will be positioned relatively
 * to that element. If null, overlay will be positioned considering window dimensions.
 * "mask": Defaults to false. If true, mask behind the overlay will be shown, making it modal-like.
 * "noClose": Defaults to false. If true, overlay close button will not appear and overlay won't be closed by pressing 'Esc' key. 
 * "closeOnEsc": Defaults to true. Indicates whether to close overlay on 'Esc' key press. Has sense only if 'noClose' is false.
 * "fadeInOut": Defaults to true. Indicates whether to use fadeIn() / fadeOut() animations when loading dialog.
 *              Note: if set to false, 'onLoad' callback will be called synchronously with dialog load,
 *              otherwise it will be called on fadeIn() animation completion.
 * "beforeLoad": Optional. Q.Event or function which is called before overlay is loaded (shown).
 *	 "onLoad": Optional. Q.Event or function which is called when overlay is loaded (shown).
 * "beforeClose": Optional. Q.Event or function which is called when overlay closing initiated and it's still visible.
 * "onClose": Optional. Q.Event or function which is called when overlay is closed and hidden.
 */
Q.Tool.jQuery('Q/overlay',

function (o) {
	function calculatePosition($this) {
		var width = $this.outerWidth(), height = $this.outerHeight();
		if (!width && $this.css('width'))
			width = parseInt($this.css('width'));
		if (!height && $this.css('height'))
			height = parseInt($this.css('height'));

		if (o.left == 'center') {
			var parentWidth = o.alignParent ? $(o.alignParent).width() : window.innerWidth;
			$this.css({ 'left': ((parentWidth - width) / 2) + 'px' });
		} else if (typeof(o.left) == 'string' && o.left.indexOf('%') != -1) {
			var percentage = parseInt(o.left) / 100;
			$this.css({ 'left': (o.alignParent ? $(o.alignParent).width() * percentage : window.innerWidth * percentage) + 'px' });
		} else {
			$this.css({ 'left': o.left + 'px' });
		}

		if (o.top == 'middle') {
			var parentHeight = o.alignParent ? $(o.alignParent).height() : window.innerHeight;
			$this.css({ 'top': ((parentHeight - height) / 2) + 'px' });
		} else if (typeof(o.top) == 'string' && o.top.indexOf('%') != -1) {
			percentage = parseInt(o.top) / 100;
			$this.css({ 'top': (o.alignParent ? $(o.alignParent).height() * percentage : window.innerHeight * percentage) + 'px' });
		} else {
			$this.css({ 'top': o.top + 'px' });
		}
	}

	var $this = this;
	$this.addClass('Q_overlay');
	$this.css({ 'position': Q.info.platform == 'ios' ? 'absolute' : 'fixed' });

	function closeThisOverlayOnEsc(e)
	{
		if (o.noClose || !o.closeOnEsc)
			return;
			
		if (e.keyCode == 27)
			$this.data('Q/overlay').close();
	}

	$this.data('Q/overlay', {
		options: o,
		load: function()
		{
			var $overlay = $this.data('Q/overlay');
			if ($this.css('display') != 'block')
			{
				Q.handle($overlay.options.beforeLoad, $this, [$this]);
				calculatePosition($this);
				if ($overlay.options.fadeInOut)
				{
					$this.fadeIn(o.fadeTime, function()
					{
						if (!$overlay.options.noClose && $overlay.options.closeOnEsc)
						{
							$(document).bind('keydown', closeThisOverlayOnEsc);
						}
						Q.handle($overlay.options.onLoad, $this, [$this]);
					});
					if ($overlay.options.mask)
					{
						Q.Mask.show('Q.screen.mask', { 
							fadeTime: o.fadeTime,
							className: 'Q_screen_shadow_mask'
						});
					}
				}
				else
				{
					$this.show();
					if ($overlay.options.mask)
					{
						Q.Mask.show('Q.screen.mask', { 'className': 'Q_screen_shadow_mask' });
					}
					if (!$overlay.options.noClose && $overlay.options.closeOnEsc)
					{
						$(document).bind('keydown', closeThisOverlayOnEsc);
					}
					Q.handle($overlay.options.onLoad, $this, [$this]);
				}
			}
		},
		close: function()
		{
			var $overlay = $this.data('Q/overlay');
			if (!$overlay.options.noClose)
			{
				$(document).unbind('keydown', closeThisOverlayOnEsc);
			}
			$this.find('input, select, textarea').trigger('blur');
			Q.handle($overlay.options.beforeClose, $this, [$this]);
			if ($overlay.options.fadeInOut)
			{
				$this.fadeOut(o.fadeTime, function()
				{
					Q.handle($overlay.options.onClose, $this, [$this]);
				});
				if ($overlay.options.mask)
				{
					Q.Mask.hide('Q.screen.mask');
				}
			}
			else
			{
				$this.hide();
				if ($overlay.options.mask)
				{
					Q.Mask.hide('Q.screen.mask');
				}
				Q.handle($overlay.options.onClose, $this, [$this]);
			}
		}
	});

	if (!o.noClose)
	{
		var close = $('<a class="close" />');
		$this.prepend(close);
		close.bind(Q.Pointer.click, $this.data('Q/overlay').close);
	}
},


{
	'left': 'center',
	'top': 'middle',
	'alignParent': null,
	'applyIScroll': false,
	'mask': false,
	'noClose': false,
	'closeOnEsc': true,
	'fadeInOut': true,
	'fadeTime': 300,
	'beforeLoad': new Q.Event(),
	'onLoad': new Q.Event(),
	'beforeClose': new Q.Event(),
	'onClose': new Q.Event()
},

{
	load: function () {
		this.data('Q/overlay').load();
	},
	close: function () {
		this.data('Q/overlay').close();
	},
	destroy: function () {
		this.each(function() {
			var $this = $(this);
			$this.find('a.close').remove();
			$this.removeClass('Q_overlay');
			$this.removeData('Q/overlay');
		});
	}
}

);

/**
 * Opens a dialog
 * @param options Object
 * A hash of options, that can include:
 * "url": Optional. If provided, this url will be used to fetch the "title" and "dialog" slots, to display in the dialog.
 * "alignByParent": Defaults to false. If true, the dialog will be aligned to the center of not the entire window,
 *                  but to the center of containing element instead.
 * "mask": Defaults to false. If true, adds a mask to cover the screen behind the dialog.
 * "fullscreen": Defaults to true only on Android and false on all other platforms. If true, dialog will be shown not as overlay
 *               but instead will be prepended to document.body and all other child elements of the body will be hidden.
 *               Thus dialog will occupy all window space, but still will behave like regular dialog, i.e. it can be closed
 *               by clicking / tapping close icon.
 * "asyncLoad": Defaults to true for desktop and false for touch devices. If true, dialog will load asynchronously
 *              with fade animation and 'onLoad' will be called when fade animation is completed.
 *              If false, dialog will appear immediately and 'onLoad' will be called at the same time.
 * "noClose": Defaults to false. If true, overlay close button will not appear and overlay won't be closed by pressing 'Esc' key.
 * "closeOnEsc": Defaults to true. Indicates whether to close dialog on 'Esc' key press. Has sense only if 'noClose' is false.
 * "destroyOnClose": Defaults to false. If true, dialog DOM element will be removed from the document on close.
 * "beforeLoad": Optional. Q.Event or function which is called before dialog is loaded.
 * "onActivate": Optional. Q.Event or function which is called when dialog is activated
 *               (all inner tools, if any, are activated and dialog is fully loaded and shown).
 * "beforeClose": Optional. Q.Event or function which is called when dialog closing initiated but it's still visible and exists in DOM.
 * "onClose": Optional. Q.Event or function which is called when dialog is closed and hidden and probably removed from DOM (if 'destroyOnClose' is 'true').
 */
Q.Tool.jQuery('Q/dialog', function (o) {
	
	return this.each(function(index)
	{
		var $this = $(this);
		var ots = $('.title_slot', $this);
		var ods = $('.dialog_slot', $this);
		if (!ots.length) {
			alert("Please add an element with the class 'title_slot' before calling dialog()");
			return;
		}
		if (!ods.length) {
			alert("Please add an element with the class 'dialog_slot' before calling dialog()");
			return;
		}
		
		if (!o.fullscreen) {
			var topPos = Q.Dialogs.options.topMargin;
			if (Q.info.isMobile) {
				if (topPos.indexOf('%') != -1) {
					topPos = parseInt(topPos) / 100 * window.innerHeight;
				}
				var noticeSlot = $('#notices_slot');
				if (noticeSlot.length && noticeSlot.outerHeight() >= topPos) {
					topPos += noticeSlot.outerHeight();
				}
			}
	
			$.fn.plugin.load('Q/iScroll');
			$this.plugin('Q/overlay', {
				top: topPos,
				mask: o.mask,
				noClose: o.noClose,
				beforeLoad: o.beforeLoad,
				onLoad: { "Q/dialog": function() {
					function _onLoadUrl() {
						Q.activate(this, {}, function() {
							_handlePosAndScroll.call($this, o);
							Q.handle(o.onActivate, $this, [$this]);
						});
					}
					if (o.url) {
						_loadUrl.call($this, o, _onLoadUrl);
					} else {
						_onLoadUrl();
					}
				}},
				beforeClose: o.beforeClose,
				onClose: { "Q/dialog": function () {
					if (o.destroyOnClose) {
						$this.remove();
					}
					Q.handle(o.onClose, $this, [$this]);
				}},
				alignParent: (o.alignByParent && !Q.info.isMobile ? $this.parent() : null),
				fadeInOut: o.asyncLoad
			});
			$this.data('Q/dialog', $this.data('Q/overlay'));
		} else {
			Q.handle(o.beforeLoad, $this, [$this]);
			var hiddenChildren = [];
			if (Q.info.platform == 'android')
			{
				$(document.body).children().each(function() {
					var child = $(this);
					if (child[0] != $this[0] && child.css('display') != 'none' && this.className.indexOf('mask') == -1) {
						child.hide();
						hiddenChildren.push(child);
					}
				});
			}
			$(document.body).prepend($this);
			$this.addClass('Q_fullscreen_dialog');
			$this.css({
				'width': window.innerWidth + 'px',
				'height': window.innerHeight + 'px'
			});
			var close = $('<a class="close" />');
			$this.prepend(close);
			$this.hide();

			var dialogData = {
				load: function() {
					if ($this.css('display') != 'block') {
						$this.css({
							'width': window.innerWidth + 'px',
							'height': window.innerHeight + 'px'
						});
						for (var i = 0; i < hiddenChildren.length; i++) {
							hiddenChildren[i].hide();
						}
						$this.show();
						
						if (o.url) {
							_loadUrl.call($this, o, function() {
								Q.activate(this, {}, function () {
									Q.handle(o.onActivate, $this, [$this]);
								});
							});
						} else {
							Q.activate(this, {}, function () {
								Q.handle(o.onActivate, $this, [$this]);
							});
						}
					}
				},
				close: function() {
					Q.handle(o.beforeClose, $this, [$this]);
					for (var i = 0; i < hiddenChildren.length; i++) {
						hiddenChildren[i].show();
					}
					
					if (o.destroyOnClose) {
						$this.remove();
					} else {
						$this.hide();
					}
					
					Q.handle(o.onClose, $this, [$this]);
				}
			};

			close.on(Q.Pointer.end, dialogData.close);

			$(document).bind('keydown', function(e) {
				if (e.which == 27) {
					dialogData.close();
				}
			});

			$this.data('Q/dialog', dialogData);
		}
		
		$this.data('Q/dialog').load();
	});
},

{
	'alignByParent': false,
	'mask': false,
	'fullscreen': Q.info.platform == 'android' ? true : false,
	'asyncLoad': !Q.info.isTouchscreen,
	'noClose': false,
	'closeOnEsc': true,
	'destroyOnClose': false,
	'beforeLoad': new Q.Event(function() {}),
	'onActivate': new Q.Event(function() {}),
	'beforeClose': new Q.Event(function() {}),
	'onClose': new Q.Event(function() {})
},

{
	load: function () {
		this.data('Q/dialog').load();
	},
	close: function () {
		this.data('Q/dialog').close();
	}
}

);

function _loadUrl(o, cb) {
	var $this = this;
	var ots = $('.title_slot', $this);
	var ods = $('.dialog_slot', $this);
	$this.addClass('Q_loading');
	ods.empty().addClass('Q_throb');

	Q.loadUrl(o.url, { 
		ignoreHistory: true,
		onActivate: cb,
		slotNames: 'title,dialog',
		handler: function(response) {
			ods.removeClass('Q_throb');
			$this.removeClass('Q_loading');

			var elementsToActivate = [];
			if ('title' in response.slots) {
				ots.html($('<h2 class="Q_dialog_title" />').html(response.slots.title));
				elementsToActivate.push(ots[0]);
			}
			ods.html(response.slots.dialog);
			elementsToActivate['dialog'] = ods[0];

			return elementsToActivate;
		}
	});
}

function _handlePosAndScroll(o)
{
	var $this = this;
	var ots = $('.title_slot', $this);
	var ods = $('.dialog_slot', $this);
	var parent = $this.parent();
	var topMargin = 0, bottomMargin = 0, parentHeight = 0;
	var lastOrientation = null; // for touch devices
		
	var contentsWrapper = null, contentsLength = 0;
	var iScrollBar = null;
	
	function applyIScroll(maxContentsHeight)
	{
		contentsWrapper = ods.parent('.Q_iscroll_dialog_wrapper');
		if (contentsWrapper.length != 0)
		{
			contentsWrapper.css({ 'max-height': maxContentsHeight + 'px' });
			var topOffset = contentsWrapper.offset().top;
			iScrollBar.css({
				'top': topOffset + 'px',
				'left': (contentsWrapper.offset().left + contentsWrapper.width() - iScrollBar.width()) + 'px',
				'height': maxContentsHeight + 'px'
			});
			contentsWrapper.plugin('Q/iScroll', 'refresh');
		}
		else
		{
			ods.wrap('<div class="Q_iscroll_dialog_wrapper" />');
			contentsWrapper = ods.parent();
			contentsWrapper.css({ 'max-height': maxContentsHeight + 'px' });
			contentsWrapper.plugin('Q/iScroll', function () {
				contentsLength = ods.html().length;
				iScrollBar = contentsWrapper.children('div:last');
				iScrollBar.detach().appendTo(document.body);
				var topOffset = contentsWrapper.offset().top;
				iScrollBar.css({
					'top': topOffset + 'px',
					'left': (contentsWrapper.offset().left + contentsWrapper.width() - iScrollBar.width()) + 'px',
					'height': maxContentsHeight + 'px',
					'z-index': '20100'
				});
				contentsWrapper.plugin('Q/iScroll', 'refresh');
			});
		}
	}
	
	if (Q.Interval.exists('Q_dialog_correction'))
	{
		Q.Interval.clear('Q_dialog_correction');
	}
	Q.Interval.set(function()
	{
		var maxContentsHeight;
		if ($this.css('display') == 'block')
		{
			topMargin = Q.Dialogs.options.topMargin;
			parentHeight = (!o.alignByParent || parent[0] == document.body) ? window.innerHeight : parent.height();
			if (typeof(topMargin) == 'string') // percentage
				topMargin = Math.round(parseInt(Q.Dialogs.options.topMargin) / 100 * parentHeight);
			bottomMargin = Q.Dialogs.options.bottomMargin;
			if (typeof(bottomMargin) == 'string') // percentage
				bottomMargin = Math.round(parseInt(Q.Dialogs.options.bottomMargin) / 100 * parentHeight);
			
			if (Q.info.isMobile)
			{
				// correcting x-pos
				if (parseInt($this.css('left')) != ((window.innerWidth - $this.outerWidth()) / 2))
				{
					$this.css({ 'left': ((window.innerWidth - $this.outerWidth()) / 2) + 'px' });
					if (iScrollBar)
					{
						iScrollBar.css({ 'left': (contentsWrapper.offset().left + contentsWrapper.width() - iScrollBar.width()) + 'px' });
					}
				}
				
				// for mobile devices any height and y-pos corrections are done only if keyboard is not visible on the screen
				if (Q.Layout && Q.Layout.keyboardVisible) return;
				
				// correcting height
				if ($this.outerHeight() > window.innerHeight && o.applyIScroll)
				{
					$this.data('Q_dialog_default_height', $this.outerHeight());
					$this.css({ 'top': '0' });
					maxContentsHeight = window.innerHeight - ots.outerHeight()
																- parseInt($this.css('border-top-width')) * 2;
					applyIScroll(maxContentsHeight);
				}
				// in case if screen height got to value where dialog may fit we're removing iScroll and height restriction
				else if ($this.data('Q_dialog_default_height') !== undefined &&
				         $this.data('Q_dialog_default_height') <= window.innerHeight)
				{
					$this.removeData('Q_dialog_default_height');
					contentsWrapper.plugin('Q/iScroll', 'destroy');
					ods.unwrap();
					$this.css({ 'top': topMargin + 'px' });
				}
				// correcting top position
				else if ($this.offset().top + $this.outerHeight() > window.scrollY + window.innerHeight)
				{
					$this.data('Q_dialog_top_corrected', true);
					$this.css({ 'top': '0' });
				}
				// if case if dialog may fit on screen with topMargin we're setting it
				else if ((topMargin + $this.outerHeight() < window.scrollY + window.innerHeight) && $this.data('Q_dialog_top_corrected'))
				{
					$this.removeData('Q_dialog_top_corrected');
					$this.css({ 'top': topMargin + 'px' });
				}
			}
			else
			{
				// correcting x-pos
				if (parseInt($this.css('left')) != ((window.innerWidth - $this.outerWidth()) / 2))
				{
					$this.css({ 'left': ((window.innerWidth - $this.outerWidth()) / 2) + 'px' });
					if (iScrollBar)
					{
						iScrollBar.css({ 'left': (contentsWrapper.offset().left + contentsWrapper.width() - iScrollBar.width()) + 'px' });
					}
				}
				
				// for touchscreen devices any height and y-pos corrections are done only if keyboard is not visible on the screen
				if (Q.info.isTouchscreen && Q.Layout && Q.Layout.keyboardVisible) return;

				// correcting height
				if ($this.outerHeight() + topMargin + bottomMargin > parentHeight)
				{
					$this.data('Q_dialog_default_height', $this.outerHeight());
					$this.css({ 'top': topMargin + 'px' });
					maxContentsHeight = parentHeight - topMargin - bottomMargin - ots.outerHeight()
						- parseInt($this.css('border-top-width')) * 2;
					if (maxContentsHeight < 0) maxContentsHeight = 0;
					if (Q.info.isTouchscreen && $.fn.iScroll && o.applyIScroll)
					{
						applyIScroll(maxContentsHeight);
					}
					else
					{
						ods.css({ 'max-height': maxContentsHeight + 'px', 'overflow': 'auto' });
					}
				}
				// in case if screen height got to value where dialog may fit we're height restriction (and iScroll for touchscreen)
				else if ($this.data('Q_dialog_default_height') !== undefined &&
				         $this.data('Q_dialog_default_height') + topMargin + bottomMargin <= parentHeight)
				{
					$this.removeData('Q_dialog_default_height');
					if (Q.info.isTouchscreen && $.fn.iScroll)
					{
						contentsWrapper.plugin('Q/iScroll', 'destroy');
						ods.unwrap();
					}
					else
					{
						ods.css({ 'max-height': '', 'overflow': '' });
					}
					$this.css({ 'top': topMargin + 'px' });
				}
				// if case if dialog may fit on screen with topMargin we're setting it
				else if ($this.data('Q_dialog_default_height') === undefined &&
				         $this.offset().top + parent.offset().top != topMargin)
				{
					$this.css({ 'top': topMargin + 'px' });
				}
			}
			
			// also considering orientation
			if (Q.info.isTouchscreen)
			{
				if (!lastOrientation)
					lastOrientation = Q.Layout.orientation;
				if (Q.Layout.orientation != lastOrientation)
				{
					lastOrientation = Q.Layout.orientation;
					parentHeight = (parent[0] == document.body) ? window.innerHeight : parent.height();
					topMargin = Q.Dialogs.options.topMargin;
					if (typeof(topMargin) == 'string') // percentage
						topMargin = Math.round(parseInt(Q.Dialogs.options.topMargin) / 100 * parentHeight);
					var curTop = parseInt($this.css('top'));
					if (curTop != 0)
						$this.css({ 'top': topMargin + 'px' });
				}
			}
			
			if (contentsWrapper && contentsLength != ods.html().length)
			{
				contentsLength = ods.html().length;
				contentsWrapper.plugin('Q/iScroll', 'refresh');
			}
		}
		else
		{
			Q.Interval.clear('Q_dialog_correction');
		}
	}, 100, 'Q_dialog_correction');
};

})(Q, jQuery, window, document);
