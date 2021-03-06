/**
 * Users plugin's front end code
 *
 * @module Users
 * @class Users
 */

(function(Q, $) {

var Users = Q.Users = Q.plugins.Users = {
	info: {}, // this gets filled when a user logs in
	facebookApps: {}, // this info gets added by the server, on the page
	connected: {} // check this to see if you are connected to a provider
};

/*
 * Text messages used in dialogs
 */
Q.text.Users = {

	login: {
		title: 'Welcome',
		directions: 'Create an account, or log in.',
		explanation: null,
		goButton: "Go",
		passphrase: 'Enter your pass phrase:',
		loginButton: "Come Inside",
		registerButton: "Get Started",
		resendButton: "Send Activation Message",
		forgot: "Forgot it?",
		resendConfirm: "Do you want to send a message to reset your passphrase?",
		resendSuccess: "Check for a message to reset your passphrase",
		resendClose: "Close",
		noPassphrase: "Before you can log in, you must set a pass phrase by clicking the link in your activation message.",
		notVerified: "You must send yourself an activation message in order to log in.",
		emailExists: "Did you try to register with this email before? If so, check your inbox to activate your account. <a href='#resend'>Click to re-send the message</a>.",
		mobileExists: "Did you try to register with this mobile number before? If so, check your SMS to activate your account. <a href='#resend'>Click to re-send the message</a>.",
		usingOther: "or you can ",
		facebookSrc: null,
		username: "Choose a username:",
		placeholders: {
			identifier: "your mobile # or email",
			mobile: "enter your mobile number",
			email: "enter your email address",
			username: "username"
		},
		maxlengths: {
			identifier: 100,
			username: 32,
			passphrase: 100
		},
		confirmTerms: "Accept the Terms of Service?"
	},
	
	setIdentifier: {
		title: "My Account Login",
		sendMessage: "Send Activation Message",
		placeholders: {
			identifier: "enter your mobile # or email",
			mobile: "enter your mobile number",
			email: "enter your email address",
			username: "username"
		}
	},
	
	prompt: {
		title: "{$Provider} Account",
		areUsing: "You are using {$provider} as",
		noLongerUsing: "You are no longer connected to {$provider} as",
		doAuth: "Log in with this account",
		doSwitch: "Switch to this account"
	},
	
	authorize: {
		mustAgree: "First you must agree to the terms."
	}

};

var priv = {};

/**
 * This event is fired if an error occurs in any Users function
 */
Users.onError = new Q.Event(function (err, err2) {
	console.warn(Q.firstErrorMessage(err, err2));
}, 'Users.onError');

/**
 * Initialize facebook by adding FB script and running FB.init().
 * Ensures that this is done only once
 */
Users.initFacebook = function(callback) {
	
	if (!Q.plugins.Users.facebookApps[Q.info.app]
	|| !Q.plugins.Users.facebookApps[Q.info.app].appId) {
		throw new Q.Error("Users.initFacebook: missing facebook app info for '" + Q.info.app + "'");
	}
	
	// should be only called once per app
	if (Users.initFacebook.completed[Q.info.app]) {
		callback && callback();
		return;
	}

	function _init () {
		if (!Users.initFacebook.completed[Q.info.app]) {
			FB.init(Q.extend({
				appId: Q.plugins.Users.facebookApps[Q.info.app].appId,
				status: true,
				cookie: true,
				oauth: true,
				xfbml: true,
				frictionlessRequests: Users.initFacebook.options.frictionlessRequests,
				channelUrl: Q.action('Users/facebookChannel')
			}));
			Users.onInitFacebook.handle(Users, window.FB, [Q.info.app]);
		}
		Users.initFacebook.completed[Q.info.app] = true;
		callback && callback();
	}

	if (!$('#fb-root').length) {
		$('body').prepend($('<div id="fb-root"></div>'));
	}
	Q.addScript(
		(window.location.protocol || window.location.protocol === 'file:'
			? 'http:'
			: window.location.protocol) + '//connect.facebook.net/en_US/all.js',
		_init,
		{
			onError: function () {
				console.log("Couldn't load script:", this, arguments);
			}
		}
	);
};
Users.initFacebook.completed = {};
Users.initFacebook.options = {
	frictionlessRequests: true
};

function FB_getLoginStatus(cb, force) {
	var timeout = 2000;
	if (timeout) {
		var t = setTimeout(function () {
			// just in case, if FB is not responding let's still fire the callback
			// FB ignores callback if:
			//	-- domain is not properly setup
			//	-- application is running in sandbox mode and developer is not logged in
			console.warn("Facebook is not responding to FB.getLoginStatus within "+timeout/1000+" sec.");
			cb({});
		}, timeout);
		FB.getLoginStatus(function(response) { 
			clearTimeout(t);
			cb(response);
		}, force);
	} else {
		FB.getLoginStatus(cb, force);
	}
}

/**
 * You can wrap all uses of FB object with this
 */
Users.initFacebook.ready = function (app, callback) {
	if (typeof app === 'function') {
		callback = app;
		app = Q.info.app;
	}
	if (Users.initFacebook.completed[app]) {
		_proceed();
	} else {
		Users.onInitFacebook.set(_proceed, "Users.initFacebook.ready");
	}
	function _proceed() {
		if (FB.getAccessToken()) {
			callback();
		} else {
			FB_getLoginStatus(function (response) {
				callback();
			});
		}
	}
};

/**
 * Authenticates this session with a given provider
 * @param provider String
 *  For now, only "facebook" is supported
 * @param onSuccess Function
 *  Called if the user successfully authenticates with the provider, or was already authenticated.
 *  It is passed the user information if the user changed.
 * @param onCancel Function
 *  Called if the authentication was canceled.
 * @param options Object
 *  Can specify the following options:
 *  "prompt": defaults to null, which shows the usual prompt unless it was already rejected once.
 *     Can be false, in which case the user is never prompted and the authentication just happens.
 *     Can be true, in which case the usual prompt is shown even if it was rejected before.
 *     Can be a function with an onSuccess and onCancel callback, in which case it's used as a prompt.
 *  "force": forces the getLoginStatus to refresh its status
 */
Users.authenticate = function(provider, onSuccess, onCancel, options) {
	if (provider !== 'facebook') {
		throw new Q.Error("Users.authenticate: The only supported provider for now is facebook");
	}
	options = options || {};
	var fields = {};

	// make sure facebook is initialized
	Users.initFacebook(function() {
		// check if user is connected to facebook
		FB_getLoginStatus(function(response) {
			if (response.status === 'connected') {
				var fb_uid = response.authResponse.userID;
				var ignoreUid = Q.cookie('Users_ignore_facebook_uid');
				// the following line prevents multiple prompts for the same user,
				// which can be a problem especially if the authenticate() is called
				// multiple times on the same page, or because the page is reloaded
				Q.cookie('Users_ignore_facebook_uid', fb_uid);
				
				if (Users.loggedInUser && Users.loggedInUser.fb_uid == fb_uid) {
					// The correct user is already logged in.
					// Call onSuccess but do not pass a user object -- the user didn't change.
					_doSuccess();
					return;
				}
				if (options.prompt === undefined || options.prompt === null) {
					// show prompt only if we aren't ignoring this facebook uid
					if (fb_uid === ignoreUid) {
						_doCancel();
					} else {
						Users.prompt('facebook', fb_uid, _doAuthenticate, _doCancel);
					}
				} else if (options.prompt === false) {
					// authenticate without prompting
					_doAuthenticate();
				} else if (options.prompt === true) {
					// show the usual prompt no matter what
					Users.prompt('facebook', fb_uid, _doAuthenticate, _doCancel);
				} else if (typeof options.prompt === 'function') {
					// custom prompt
					options.prompt('facebook', fb_uid, _doAuthenticate, _doCancel);
				} else {
					throw new Q.Error("Users.authenticate: options.prompt is the wrong type");
				}
			} else {
				// let's delete any stale facebook cookies there might be
				// otherwise they might confuse our server-side authentication.
				Q.cookie('fbs_' + Q.plugins.Users.facebookApps[Q.info.app].appId, null, {path: '/'});
				Q.cookie('fbsr_' + Q.plugins.Users.facebookApps[Q.info.app].appId, null, {path: '/'});
				_doCancel();
			}

			function _doSuccess(user) {
				// TODO: check what to do if user has changed
				Users.connected.facebook = true;
				var changed = (!Users.loggedInUser || Users.loggedInUser.fb_uid != response.authResponse.UserID);
				Users.onLogin.handle(user);
				Q.handle(onSuccess, this, [user]);
			}
			
			function _doCancel(ignoreUid) {
				if (ignoreUid) {
					// NOTE: the following line makes us ignore this uid
					// until the user explicitly wants to connect.
					// This usually has the right effect -- because the user
					// doesn't want to see the prompt all the time.
					// However, sometimes if the user is already logged in
					// and then the javascript discovers that the facebook connection was lost,
					// the user will not be prompted to restore it when it becomes available again.
					// They will have to do it explicitly (calling Users.authenticate with prompt: true)
					Q.cookie('Users_ignore_facebook_uid', ignoreUid);
				}
				delete Users.connected.facebook;
				onCancel && onCancel();
			}

			function _doAuthenticate() {
				if (!FB.getAuthResponse()) {
					// in some rare cases, the user may have logged out of facebook
					// while our prompt was visible, so there is no longer a valid
					// facebook authResponse. In this case, even though they want
					// to authenticate, we must cancel it.
					alert("Connection to facebook was lost. Try connecting again.");
					_doCancel();
					return;
				}
				fields['Users'] = {
					'facebook_authResponse': response.authResponse
				};
				$.post(
					Q.ajaxExtend(Q.action("Users/authenticate"), 'data', {method: "post"}),
					$.param(fields),
					function (response) {
						if (response.errors) {
							alert(response.errors[0].message);
							_doCancel();
						} else {
							var user = response.slots.data;
							if (user.authenticated !== true) {
								priv.result = user.authenticated;
							}
							priv.used = 'facebook';
							user.result = user.authenticated;
							user.used = 'facebook';
							Users.loggedInUser = new Users.User(user);
							Q.nonce = Q.cookie('Q_nonce');
							_doSuccess(user);
						}
					}, 'json');
			}
		}, options.force ? true : false);
	});
};

/**
 * Used when provider user is logged in to provider but not to app.
 * Shows prompt asking if user wants to log in to the app as provider user.
 * @param {object} options
 *	may contain 'dialogContainer' param with jQuery identifier of dialog container,
 *	defaults to document.body
 */
Users.prompt = function(provider, uid, authCallback, cancelCallback, options) {
	if (provider !== 'facebook') {
		throw new Q.Error("Users.authenticate prompt: The only supported provider for now is facebook");
	}

	if (!Users.prompt.overlay) {
		var o = Q.extend({}, Users.prompt.options, options);

		Q.addStylesheet(Q.url('plugins/Users/css/Users.css'));
	
		var title = Q.text.Users.prompt.title
			.replace(new RegExp("{\\$provider}", 'g'), provider)
			.replace(new RegExp("{\\$Provider}", 'g'), provider.toCapitalized());
		var areUsing = Q.text.Users.prompt.areUsing
			.replace(new RegExp("{\\$provider}", 'g'), provider)
			.replace(new RegExp("{\\$Provider}", 'g'), provider.toCapitalized());
		var noLongerUsing = Q.text.Users.prompt.noLongerUsing
			.replace(new RegExp("{\\$provider}", 'g'), provider)
			.replace(new RegExp("{\\$Provider}", 'g'), provider.toCapitalized());
		var caption;
		var tookAction = false;

		var content_div = $('<div />');
		if (Users.loggedInUser && Users.loggedInUser.fb_uid) {
			content_div.append(_usingInformation(Users.loggedInUser.fb_uid, noLongerUsing));
			caption = Q.text.Users.prompt.doSwitch
				.replace(new RegExp("{\\$provider}", 'g'), provider)
				.replace(new RegExp("{\\$Provider}", 'g'), provider.toCapitalized());
		} else {
			caption = Q.text.Users.prompt.doAuth
				.replace(new RegExp("{\\$provider}", 'g'), provider)
				.replace(new RegExp("{\\$Provider}", 'g'), provider.toCapitalized());
		}
		content_div.append(_usingInformation(uid, areUsing)).append(_authenticateActions(caption));

		Users.prompt.overlay = $('<div id="Users_prompt_overlay" class="Users_prompt_overlay" />');
		var titleSlot = $('<div class="title_slot" />');
		titleSlot.append($('<h2 class="Users_dialog_title Q_dialog_title" />').html(title));
		var dialogSlot = $('<div class="dialog_slot Q_dialog_content">');
		dialogSlot.append(content_div);
		Users.prompt.overlay.append(titleSlot).append(dialogSlot).appendTo($(o.dialogContainer));

		function _usingInformation(uid, explanation) {
			return $("<table />").append(
				$("<tr />").append(
					$("<td class='Users_profile_pic' />").html(
						"<fb:profile-pic uid='" + uid + "' linked='false' size='square' class='fb_profile_pic'></fb:profile-pic>"
					)
				).append(
					$("<td class='Users_explanation_name' />").append(
						$("<div class='Users_explanation' />").html(explanation)
					).append(
						"<fb:name uid='" + uid + "' useyou='false' linked='false' size='square' class='fb_name'>user id "+uid+"</fb:name>"
					)
				)
			);
		}

		function _authenticateActions(caption) {
			return $("<div class='Users_actions Q_big_prompt' />").append(
				$('<button type="submit" class="Q_button Q_main_button" />').html(caption)
				.click(function () {
					tookAction = true;
					Users.prompt.overlay.data('Q/overlay').close();
					authCallback();
				})
			);
		}
	}
	Q.Dialogs.push({
		dialog: Users.prompt.overlay, 
		alignByParent: true,
		mask: true,
		doNotRemove: true,
		onActivate: function () {
			Users.initFacebook(function () {
				FB.XFBML.parse(content_div.get(0));
			});
		},
		onClose: function () {
			if (!tookAction) {
				if (cancelCallback) cancelCallback(uid);
			}
			tookAction = false;
		}
	});
};


/**
 * Check permissions granted by provider.
 * Currently only facebook supported.
 */
Users.perms = function (provider, callback) {
	if (provider !== 'facebook') {
		throw new Q.Error("Users.perms: The only supported provider for now is facebook");
	}
	Users.initFacebook(function () {
		if (!FB.getAuthResponse()) {
			callback(null);
		}
		FB.api('/me/permissions', function(response) {
			if (response && response.data && response.data[0] !== undefined) {
				callback(response.data[0]);
			} else {
				callback(null);
			}
		});
	});
};

/**
 * Log the user in
 * @param options Object
 *  You can pass several options here, including:
 *  "onSuccess": function to call when login or authentication "using" a provider is successful.
 *     It is passed the user information if the user changed.
 *  "onCancel": function to call if login or authentication "using" a provider was canceled.
 *  "homeUrl": defaults to Q.uris[Q.info.app+'/home'].
 *     If the default onSuccess implementation is used, the browser is redirected here
 *  "accountStatusUrl": if passed, this URL is hit to determine if the account is complete
 *  "onRequireComplete": function to call if the user logged in but account is incomplete.
 *     It is passed the user information as well as the response from hitting accountStatusUrl
 *  "using": can be "native", "facebook" or "native,facebook"
 *  "tryQuietly": if true, this is same as Users.authenticate, with provider = "using" option
 *  "perms": permissions to request from the authentication provider. Defaults to "email,publish_stream"
 *  "identifierType": the type of the identifier, which could be "mobile" or "email" or "email,mobile"
 */
Users.login = function(options) {

	if (typeof options === 'function') {
		options = { onSuccess: { 'options': options } };
		if (arguments.length > 1) {
			options.onRequireComplete = { 'Users.login.options': arguments[1] };
		}
	}
	var o = Q.extend({}, Users.login.options, options);
	
	$.fn.plugin.load('Q/dialog', function () {
	
		var dest;

		if (typeof o.using === 'string') {
			o.using = o.using.split(',');
		}

		// try quietly, possible only with facebook
		if (o.tryQuietly) {
			if (o.using.indexOf('facebook') >= 0) {
				o.force = true;
				Users.authenticate('facebook', function (user) {
					_onConnect(user);
				}, function () {
					_onCancel();
				}, o);
			}
			return false;
		}
		
		priv.result = null;
		priv.used = null;

		// perform actual login
		if (o.using.indexOf('native') >= 0) {
			var usingProviders = o.using.indexOf('facebook') >= 0 ? ['facebook'] : [];
			// set up dialog
			login_setupDialog(usingProviders, o.perms, o.dialogContainer, o.identifierType);
			priv.login_onConnect = _onConnect;
			priv.login_onCancel = _onCancel;
			priv.linkToken = null;
			priv.perms = o.perms;
			priv.activation = o.activation;
			var d = login_setupDialog.dialog;
			if (d.css('display') == 'none') {
				d.data('Q/dialog').load();
			}
			$('#Users_login_step1').show();
			$('#Users_login_usingProviders').show();
			$('#Users_login_step1_form *').removeAttr('disabled');
			$('#Users_login_identifierType').val(o.identifierType);
		} else if (o.using[0] === 'facebook') { // only facebook used. Open facebook login right away
			Users.initFacebook(function () {
				var opts = o.perms ? {scope: o.perms} : undefined;
				FB.login(function(response) {
					if (!response.authResponse) {
						_onCancel();
						return;
					}
					if (!o.perms) {
						_success();
						return;
					}
					// some permissions were requested
					Users.perms('facebook', function(perms) {
						if (!perms) {
							_onCancel(null);
							return;
						}
						var permsRequested = o.perms.split(',');
						for (var i=0; i < permsRequested.length; ++i) {
							if (!permsRequested[i]) {
								_onCancel(perms); // at least some permission was not granted
								return;
							}
						}
						_success();

						function _success() {
							Users.authenticate('facebook', function (user) {
								_onConnect(user);
							}, function () {
								_onCancel();
							}, { "prompt": false });
						}
					});
				}, opts);
			});
		}
	
		delete priv.login_connected; // if we connect, it will be filled
	
	});
	
	// you can now require login and do FQL queries:
	return false;

	function _onConnect(user) {
		if (user) {
			user.result = priv.result;
			user.used = priv.used;
			Users.loggedInUser = new Users.User(user);
			Q.nonce = Q.cookie('Q_nonce');
		}
		if (!o.accountStatusUrl) {
			_onComplete(user);
			return;
		}
		Q.request(o.accountStatusUrl, 'accountStatus', function(err, response2) {
			// DEBUGGING: For debugging purposes
			if (!response2.slots) {
				if (response2.errors && response2.errors[0].message) {
					alert(response2.errors[0].message);
				}
				return;
			}

			if (!o.onRequireComplete || response2.slots.accountStatus === 'complete') {
				_onComplete(user);
			} else if (response2.slots.accountStatus === 'refresh') {
				// we are logged in, refresh the page
				Q.handle(window.location);
				return;
			} else {
				// take the user to the profile page which will ask
				// the user to complete their registration process
				// by entering additional information
				if (typeof(o.onRequireComplete) !== 'function' && typeof(o.onRequireComplete) !== 'string') {
					alert('Need an url in the onRequireComplete option');
					return;
				}
				Q.handle(o.onRequireComplete, this, [user, response2]);
			}
		});
	}
	
	// User clicked "cancel" or closed login dialog
	function _onCancel(perms) {
		Q.handle(o.onCancel, this, [perms]);
	}
	
	// login complete - run onSuccess handler
	function _onComplete(user) {
		if (!o.onSuccess && typeof(o.onSuccess) !== 'function' && typeof(o.onSuccess) !== 'string') {
			alert('Need an url in the onSuccess option');
			return;
		}
		Users.onLogin.handle(user);
		Q.handle(o.onSuccess, this, [user, o, priv.result, priv.used || 'native']);
	}
};

/**
 * Log the user out
 * @param options Object
 *  You can pass several options here, including:
 *  "onSuccess": function to call when login is successful.
 *     It is passed the user information if the user changed.
 *  "url": the URL to hit to log out. You should usually not change this.
 *  "using": can be "native" or "native,facebook" to log out of both
 */
Users.logout = function(options) {
	if (typeof options === 'function') {
		options = { onSuccess: { 'options': options } };
	}
	var o = Q.extend({}, Users.logout.options, options);
	if (typeof o.using === 'string') {
		o.using = o.using.split(',');
	}

	function callback(response) {
		if (response && response.slots && response.slots.script) {
			// This script is coming from our server - it's safe.
			try {
				eval(response.slots.script);
			} catch (e) {
				alert(e);
			}
		}
		if (Q.plugins.Users.facebookApps[Q.info.app]
		&& (o.using.indexOf('facebook') >= 0)) {
			Q.cookie('fbs_' + Q.plugins.Users.facebookApps[Q.info.app].appId, null, {path: '/'});
			Q.cookie('fbsr_' + Q.plugins.Users.facebookApps[Q.info.app].appId, null, {path: '/'});
			if ((o.using[0] === 'native' || o.using[1] === 'native')) {
				Users.loggedInUser = null;
				Q.nonce = Q.cookie('Q_nonce');
			}
			Users.initFacebook(function logoutCallback () {
				FB_getLoginStatus(function (response) {
					if (response.authResponse) {
						FB.logout(function() {
							delete Users.connected.facebook;
							Users.onLogout.handle.call(this, o);
							Q.handle(o.onSuccess, this, [o]);
						});
					} else {
						Users.onLogout.handle.call(this, o);
						Q.handle(o.onSuccess, this, [o]);
					}
				}, true);
			});
		} else {
			// if we log out without logging out of facebook,
			// then we should ignore the logged-in user's fb_uid
			// when authenticating, until it is forced
			if (Users.loggedInUser && Users.loggedInUser.fb_uid)
			Q.cookie('Users_ignore_facebook_uid', Users.loggedInUser.fb_uid);
			Users.loggedInUser = null;
			Q.nonce = Q.cookie('Q_nonce');
			Users.onLogout.handle.call(this, o);
			Q.handle(o.onSuccess, this, [o]);
		}
	}
	
	if (!o.url) {
		callback();
		return false;
	}
	
	var url = o.url + (o.url.indexOf('?') < 0 ? '?' : '') + '&logout=1';
	Q.request(url, 'script', callback, {"method": "post"});
	return true;
};

/**
 * Users batch getter.
 * @method get
 * @param userId {string}
 *  The user's id
 * @param callback {function}
 *	if there were errors, first parameter is an array of errors
 *  otherwise, first parameter is null and second parameter is a Users.User object
 */
Users.get = Q.getter(function (userId, callback) {
	var url = Q.action('Users/avatar');
	var func = Users.batchFunction(Q.baseUrl({
		userIds: userId
	}), 'avatar');
	func.call(this, userId, function Users_get_response_handler (err, data) {
		var msg = Q.firstErrorMessage(err) || Q.firstErrorMessage(data && data.errors);
		if (!msg && !data.avatar) {
			msg = "Users.get: data.avatar is missing";
		}
		if (msg) {
			Users.onError.handle.call(this, msg, err, data.avatar);
			Users.get.onError.handle.call(this, msg, err, data.avatar);
			return callback && callback.call(this, msg);
		}
		var user = new Users.User(data.avatar);
		callback.call(user, err, user);
	});
});
Users.get.onError = new Q.Event();

/**
 * Constructs a user from fields, which are typically returned from the server.
 * @param {String} fields
 */
Users.User = function (fields) {
    Q.extend(this, fields);
    this.typename = 'Q.Users.User';
};

Users.User.get = Users.get;

/**
 * Calculate the url of a user's icon
 * @param {String} icon the value of the user's "icon" field
 * @param {Number} [size=40] the size of the icon to render. Defaults to 40.
 * @return {String} the url
 */
Users.iconUrl = function(icon, size) {
	if (!icon) {
		console.warn("Users.iconUrl: icon is empty");
		return '';
	}
	if (!size) {
		size = '40';
	}
	size = (String(size).indexOf('.') >= 0) ? size : size+'.png';
	return icon.isUrl()
		? icon + '/' + size
		: Q.url('plugins/Users/img/icons/'+icon+'/'+size);
};

function _constructUser (fields) {
	var user = new Users.User(fields);

	// update the Users.get cache
	Users.get.cache.each([fields.id], function (k, v) {
		Users.get.cache.remove(k);
	});
	if (fields.id) {
		Users.get.cache.set(
			[fields.id], 0,
			user, [null, user]
		);
	}
}

Users.batchFunction = function Users_batchFunction(baseUrl, action) {
    return Q.batcher.factory(
		Users.batchFunction.functions, baseUrl, 
		"/action.php/Users/"+action, "batch", "batch",
		{
			preprocess: function (args) {
				var userIds = [], i;
				for (i=0; i<args.length; ++i) {
					userIds.push(args[i][0]);
				}
				return {userIds: userIds};
			}
		}
	);
};
Users.batchFunction.functions = {};

Q.onActivate.set(function (elem) {
	$(elem || document).off('click.Users').on('click.Users', 'a', function (e) {
		var href = $(this).attr('href');
		if (Users.requireLogin && Users.requireLogin[href]) {
			if (Users.requireLogin[href] === 'facebook') {
				if (!Users.connected.facebook) {
					// note: the following may automatically log you in
					// if you authorized this app with facebook
					// and you are already logged in with facebook.
					Users.login({
						'using': 'facebook',
						onSuccess: href
					});
					e.preventDefault();
				}
			} else if (Users.requireLogin[href] === true) {
				Users.login({
					onSuccess: href
				});
				e.preventDefault();
			}
		}
	});
}, 'Users');

Users.importContacts = function(provider)
{
	window.open(Q.action("Users/importContacts?provider=" + provider), "import_contacts", "scrollbars,resizable,width=700,height=500");
};

Users.setIdentifier = function(options) {
	var o = Q.extend({}, Users.setIdentifier.options, options);
	
	function onSuccess(user) {
		Q.handle(o.onSuccess, this, [user]);
	}
	
	function onCancel(perms) {
		Q.handle(o.onCancel, this, [perms]);
	}
	
	priv.setIdentifier_onSuccess = onSuccess;
	priv.setIdentifier_onCancel = onCancel;
	
	$.fn.plugin.load(['Q/dialog', 'Q/placeholders'], function () {
		setIdentifier_setupDialog(o.identifierType);
		var d = setIdentifier_setupDialog.dialog;
		if (d.css('display') == 'none') {
			d.data('Q/dialog').load();
		}
		$('#Users_setIdentifier_type').val(o.identifierType);
	});
};

/**
 * Private functions
 */
function login_callback(response) {
	var identifier_input = $('#Users_login_identifier');
	var form = $('#Users_login_step1_form');
	identifier_input.css('background-image', 'none');

	if (response.errors) {
		// There were errors
		form.data('validator').invalidate(Q.ajaxErrors(response.errors, ['identifier']));
		identifier_input.plugin('Q/clickfocus');
		return;
	}

	// Remove any errors we may have displayed
	form.data('validator').reset();
	identifier_input.blur();

	var json = response.slots.data;
	var step2_form;
	var autologin = false;
	setupRegisterForm = Users.login.options.setupRegisterForm || defaultSetupRegisterForm;
	if (form.data('used') === 'facebook') {
		// logged in with FB
		autologin = true;
		// auto-login by authenticating with facebook
		Users.authenticate('facebook', function (user) {
			var msg = user && user.username ? 'Welcome, ' + user.username + '!' : 'Success!';

			if(step2_form !== undefined) {
				$('button', step2_form).html(msg).attr('disabled', 'disabled');
			}

			if (priv.login_onConnect) {
				priv.login_connected = true;
				if (setIdentifier_setupDialog.dialog) {
					setIdentifier_setupDialog.dialog.data('Q/dialog').close();
				}
				if (login_setupDialog.dialog) {
					login_setupDialog.dialog.data('Q/dialog').close();
				}
				priv.login_onConnect(user);
			}
		}, function () {
			alert("Could not authenticate with facebook. Try again.");
			// why would this be canceled?
		}, { "prompt": false });
	} else if (!json.exists) {
		// no username available. This user has no password set yet and will activate later
		step2_form = setupRegisterForm(identifier_input.val(), json, priv, login_setupDialog.dialog.data('Q/dialog'));
	} else if (json.passphrase_set) {
		// check password
		step2_form = setupLoginForm();
	} else if (json.verified) {
		// let the user gain access by resending an activation message
		step2_form = setupResendForm(true);
	} else {
		// remind to activate -- this is probably a futureUser created using an invite
		step2_form = setupResendForm(false);
	}
	
	var userId = response.slots.data.exists;

	function onFormSubmit(event) {
		var $this = $(this);
		event.preventDefault();
		if ($this.data('cancelSubmit')) {
			return;
		}
		if (!$this.is(':visible')) {
			return;
		}
		var first_input = $('input:not([type=hidden])', $this).add('button', $this).eq(0);
		$('input', $this).css({
			'background-image': 'url(' + Q.url('plugins/Q/img/throbbers/loading.gif') + ')',
			'background-repeat': 'no-repeat'
		});
		if (window.CryptoJS) {
			var p = $('#Users_form_passphrase');
			if (p.val()) {
				p.val(CryptoJS.SHA1(p.val() + "\t" + userId));
				$('#Users_login_isHashed').attr('value', 1);
			} else {
				$('#Users_login_isHashed').attr('value', 0);
			}
		}
		var url = $this.attr('action')+'?'+$this.serialize();
		Q.request(url, 'data', function (err, response) {
			
			$('#Users_form_passphrase').attr('value', '');
			
			$('input', $this).css('background-image', 'none');
			if (err) {
				var msg = Q.firstErrorMessage(err);
				return;
			}
			if (err || response.errors) {
				// there were errors
				if (response.errors) {
					$this.data('validator').invalidate(Q.ajaxErrors(response.errors, [first_input.attr('name')]));
				}
				$('#Users_login_identifier').blur();
				first_input.plugin('Q/clickfocus');
				return;
			}
			// success!
			switch ($this.data('form-type')) {
				case 'resend': 
					$('button', $this).html('Sent').attr('disabled', 'disabled');
					login_setupDialog.dialog.data('Q/dialog').close();
					return;
				case 'register':
					priv.result = 'registered';
					break;
			}
			priv.used = $('#Users_login_step1_form').data('used');
			var msg = 'Success!';
			if (response.slots.data.user) {
				if (response.slots.data.user.displayName) msg = 'Welcome, '+response.slots.data.user.displayName+'!';
				else if (response.slots.data.user.username) msg = 'Welcome, '+response.slots.data.user.username+'!';
			}
			$('button', $this).html(msg).attr('disabled', 'disabled');

			if (priv.login_onConnect) {
				priv.login_connected = true;
				if (login_setupDialog.dialog) {
					login_setupDialog.dialog.data('Q/dialog').close();
				}
				priv.login_onConnect(response.slots.data.user);
			}
		}, {"method": "post"});
	}

	function setupLoginForm() {
		var passphrase_input = $('<input type="password" name="passphrase" id="Users_form_passphrase" class="Q_password" />')
			.attr('maxlength', Q.text.Users.login.maxlengths.passphrase)
			.attr('maxlength', Q.text.Users.login.maxlengths.passphrase)
			.on('change keyup input', function () {
				$('#Users_login_passphrase_forgot')
					.css('display', $(this).val() ? 'none' : 'inline');
			});
		var login_form = $('<form method="post" />')
		.attr('action', Q.action("Users/login"))
		.data('form-type', 'login')
		.append($("<div id='Users_login_label_div'>").append(
			$('<label for="Users_login_passphrase" />').html(Q.text.Users.login.passphrase)
		)).append(
			$("<div id='Users_login_passphrase_div' >").append(
				passphrase_input,
				$('<a id="Users_login_passphrase_forgot" href="#forgot"/>')
				.html(Q.text.Users.login.forgot)
				.click(function() {
					if (Q.text.Users.login.resendConfirm) {
						if (confirm(Q.text.Users.login.resendConfirm)) {
							_resend();
						}
					} else {
						_resend();
					}
					function _resend() {
						Q.req('Users/resend', 'data', function (err) {
							$('#Users_login_step1').hide();
							$('#Users_login_step2').empty().append(
								$('<div id="Users_login_resend_success" />').append(
									$('<p />').html(Q.text.Users.login.resendSuccess),
									$('<button class="Q_button Q_main_button" />')
										.html(Q.text.Users.login.resendClose)
										.click(function () {
											login_setupDialog.dialog.data('Q/dialog').close();		
										})
								)
							);
						}, {
							method: 'post',
							fields: {identifier: identifier_input.val()}
						});
					};
					return false;
				})
			)
		).append($('<input type="hidden" name="identifier" />').val(identifier_input.val()))
		.append($('<div class="Q_buttons"></div>').append(
			$('<a class="Q_button Users_login_start Q_main_button" />')
			.html(Q.text.Users.login.loginButton)
			.click(submitClosestForm)
		)).append($('<input type="hidden" name="isHashed" id="Users_login_isHashed" value="0" />'));
		setTimeout(function () {
			$('#Users_login_passphrase_div').width(passphrase_input.outerWidth());
		}, 10);
		return login_form;
	}
	
	function setupResendForm(verified) {
		var explanation = verified 
			? $('<p id="Users_login_noPassphrase"></p>').html(Q.text.Users.login.noPassphrase)
			: $('<p id="Users_login_notVerified"></p>').html(Q.text.Users.login.notVerified);
		var identifier_form = $('<form method="post" />')
		.attr('action', Q.action("Users/resend"))
		.data('form-type', 'resend')
		.append(explanation)
		.append($('<div class="Q_buttons"></div>').append(
			$('<button id="Users_login_resend" class="Q_button Users_login_start Q_main_button" />')
			.html(Q.text.Users.login.resendButton)
			.attr('name', 'resend')
			.click(submitClosestForm)
		)).append($('<input type="hidden" name="identifier" />').val(identifier_input.val()));
		return identifier_form;
	}

	function defaultSetupRegisterForm(identifier, json, priv, dialog) {
		var src = json.entry[0].photos && json.entry[0].photos.length ? json.entry[0].photos[0].value : json.entry[0].thumbnailUrl;
		var src40 = src, src50 = src, src80w = src;
		var username = json.entry[0].preferredUsername || json.entry[0].displayName;
		if (priv.registerInfo) {
			if (priv.registerInfo.username){
				username = priv.registerInfo.username;
			}
			if (priv.registerInfo.pic_square) {
				src40 = src50 = src = priv.registerInfo.pic_square;
			}
			if (priv.registerInfo.pic) {
				src80w = priv.registerInfo.pic;
			}
		}
		var img = $('<img />').attr('src', src).attr('title', 'You can change this picture later');
		if (img.tooltip) {
			img.tooltip();
		}
		var td, table = $('<table />').append(
			$('<tr />').append(
				$('<td class="Users_login_picture" />').append(img)
			).append(
				td = $('<td class="Users_login_username_block" />').append(
					$('<label for="Users_login_username" />').html(Q.text.Users.login.username)
				).append(
					$('<input id="Users_login_username" name="username" type="text" class="text" />')
					.attr('maxlength', Q.text.Users.login.maxlengths.username)
					.attr('placeholder', Q.text.Users.login.placeholders.username)
					.val(username)
					.width($('#Users_login_identifier').width() - 30)
				)
			)
		);
		var register_form = $('<form method="post" class="Users_register_form" />')
		.attr('action', Q.action("Users/register"))
		.data('form-type', 'register')
		//.append($('<div class="Users_login_appear" />'))
		.append(table)
		.append($('<input type="hidden" name="identifier" />').val(identifier))
		.append($('<input type="hidden" name="icon[40.png]" />').val(src40))
		.append($('<input type="hidden" name="icon[50.png]" />').val(src50))
		.append($('<input type="hidden" name="icon[80w.png]" />').val(src80w))
		.append($('<div class="Users_login_get_started">&nbsp;</div>')
		.append(
			$('<button type="submit" class="Q_button Users_login_start Q_main_button" />')
			.html(Q.text.Users.login.registerButton)
		)).submit(function () {
			$(this).removeData('cancelSubmit');
			if (!$('#Users_agree').attr('checked')) {
				if (!confirm(Q.text.Users.login.confirmTerms)) {
					$(this).data('cancelSubmit', true);
				} else {
					$('#Users_agree').attr('checked', 'checked');
				}
			}
		});
		
		if (priv.activation) {
			register_form.append($('<input type="hidden" name="activation" />').val(priv.activation));
		}

		if (json.termsLabel) {
			td.append(
				$('<div />').attr("id", "Users_register_terms")
					.append($('<input type="checkbox" name="agree" id="Users_agree" value="yes">'))
					.append($('<label for="Users_agree" />').html(json.termsLabel))
			);
		}
		
		var authResponse, fields = {};
		if ($('#Users_login_step1_form').data('used') === 'facebook') {
			Users.initFacebook(function() {
				var k;
				if ((authResponse = FB.getAuthResponse())) {
					fields['Users'] = {
						'facebook_authResponse': authResponse
					};
					for (k in authResponse) {
						register_form.append(
							$('<input type="hidden" />')
							.attr('name', 'Users[facebook_authResponse][' + k + ']')
							.attr('value', authResponse[k])
						);
					}
				}
			});
		}
		
		if ($('#Users_login_step1_form').data('used') === 'facebook') {
			register_form.append($('<input type="hidden" name="provider" value="facebook" />'));
		}
		if (json.emailExists || json.mobileExists) {
			var p = $('<p id="Users_login_identifierExists" />')
				.html(
					json.emailExists ? Q.text.Users.login.emailExists : Q.text.Users.login.mobileExists
				);
			$('a', p).click(function() {
				$.post(
					Q.ajaxExtend(Q.action("Users/resend"), 'data'),
						'identifier='+encodeURIComponent(identifier_input.val()),
						function () { dialog.close(); }
				);
				return false;
			});
			register_form.append(p);
		}
		return register_form;
	}

	$('#Users_login_usingProviders').hide();
	if (form.data('used')) {
		$('*', form).attr('disabled', 'disabled');
	}
	if (!autologin) {
		var step2 = $('#Users_login_step2').html(step2_form);
		if (Q.info && Q.info.isTouchscreen) {
			step2.show();
			$('input', step2_form).eq(0).plugin('Q/clickfocus').select();
		} else {
			step2.slideDown('fast', function () {
				step2_form.plugin('Q/placeholders');
				if (step2_form.data('form-type') === 'resend') {
					$('.Q_main_button', step2_form).focus();
				} else if (!Q.info.isTouchscreen) {
					$('input', step2_form).eq(0).plugin('Q/clickfocus').select();
				}
			});
		}
		Q.activate($('#Users_login_step2').get(0));
	}
	$('#Users_login_step1').animate({"opacity": 0.5}, 'fast');
	$('#Users_login_step1 .Q_button').attr('disabled', 'disabled');
	if (!autologin) {
		step2_form.validator().submit(onFormSubmit);
		$('input', step2_form).add('select', step2_form).on('input', function () {
			if (step2_form.data('validator')) {
				step2_form.data('validator').reset($(this));
			}
		});
	}
	if (priv.linkToken) {
		$('#Users_login_step1').hide();
	}
}

/*
 * Set up login dialog.
 * login_setupDialog.dialog will contain the dialog
 */
function login_setupDialog(usingProviders, perms, dialogContainer, identifierType)
{
	$('#Users_login_step1_form').data('used', null);
	if (login_setupDialog.dialog) {
		return;
	}
	var step1_form = $('<form id="Users_login_step1_form" method="post" autocomplete="on" />');
	var step1_div = $('<div id="Users_login_step1" class="Q_big_prompt" />').html(step1_form);
	var step2_div = $('<div id="Users_login_step2" class="Q_big_prompt" />');
	// step1_form request identifier
	var placeholder = Q.text.Users.login.placeholders.identifier;
	var type = 'email';
	var parts = identifierType ? identifierType.split(',') : [];
	if (parts.length === 1) {
		if (parts[0] == 'email') {
			type = 'email';
			placeholder = Q.text.Users.login.placeholders.email;
		} else if (parts[0] == 'mobile') {
			type = 'tel';
			placeholder = Q.text.Users.login.placeholders.mobile;
		}
	}
	
	Q.addScript("plugins/Q/js/sha1.js");
	
	var identifierInput = $('<input id="Users_login_identifier" autocomplete="email" type="'+type+'" class="text" />')
	.attr('maxlength', Q.text.Users.login.maxlengths.identifier)
	.attr('placeholder', placeholder)
	.focus(hideForm2);

	if (type === 'email') {
		identifierInput.attr('name', 'email');
	} else if (type === 'mobile') {
		identifierInput.attr('name', 'phone');
	}

	step1_form.html(
		$('<label for="Users_login_identifier" />').html(Q.text.Users.login.directions)
	).append('<br />').append(
		identifierInput
	).append(
		$('<input id="Users_login_identifierType" type="hidden" name="identifierType" />').val(identifierType)
	).append('&nbsp;').append(
		$('<a class="Q_button Users_login_go Q_main_button" />')
			.append(
			$('<span id="Users_login_go_span">'  + Q.text.Users.login.goButton + '</span>')
		).click(submitClosestForm)
		.on('touchend', function () {
			if ($('#Users_login_identifier').is(':focus')) {
				$('#Users_login_identifier').blur();
			}
		})
	).append(
		$('<div id="Users_login_explanation" />').html(Q.text.Users.login.explanation)
	).submit(function(event) {
		$('#Users_login_identifier').attr('name', 'identifier');
		if (!$(this).is(':visible')) {
			event.preventDefault();
			return;
		}
		$('.Q_button', $(this)).focus();
		$('#Users_login_identifier').css({
			'background-image': 'url(' + Q.url('plugins/Q/img/throbbers/loading.gif') + ')',
			'background-repeat': 'no-repeat'
		}).trigger('Q_refresh');
		var url = Q.action(Users.login.options.userQueryUri) + '?' + $(this).serialize();
		$.ajax({
			url: Q.ajaxExtend(url, 'data'),
			success: login_callback,
			async: !Q.info.isTouchscreen
		});
		event.preventDefault();
		return;
	}).on('keydown change click input', hideForm2);

	if (Q.info.isTouchscreen) {
		identifierInput.on('keyup', function () {
			var i, found=0, val = $(this).val();
			if (val.length === 0) return;
			
			var number = val.replace(/[^0-9]/g, '');
			if ((number[0] === '1' && number.length === 11)
			|| (number[0] !== '1' && number.length === 10)) {
				$(this).blur(); // prepare user to press Go button
				return;
			}
			
			if (val.indexOf('@') >= 0) {
				var ext = val.split('.').pop();
				var exts = ["com", "net", "org", "edu", "gov", "info", "mil"];
				if (exts.indexOf(ext) >= 0) {
					$(this).blur();
					return;
				}
			}
		});
	}

	step1_form.validator();
	var step1_usingProviders_div = $('<div id="Users_login_usingProviders" />');
	var providerCount = 0;
	for (var i = 0; i < usingProviders.length; ++i) {
		switch (usingProviders[i]) {
			case 'facebook':
				if (!Q.plugins.Users.facebookApps[Q.info.app]
				|| !Q.plugins.Users.facebookApps[Q.info.app].appId) {
					break;
				}
				++providerCount;
				var facebookLogin = $('<a href="#login_facebook" id="Users_login_with_facebook" />').append(
					$('<img alt="login with facebook" />')
					.attr('src', Q.text.Users.login.facebookSrc || Q.url('plugins/Users/img/facebook-login.png'))
				).css({'display': 'inline-block', 'vertical-align': 'middle'})
				.click(function () {
					Users.initFacebook(function() {
						FB.login(function(response) {
							if (!response.authResponse) {
								// The user is still staring at our native login dialog
								return;
							}
							step1_form.data('used', 'facebook');
							FB.api({
								method: 'fql.query',
								query: "SELECT username, first_name, last_name, email, pic_small, pic_big, pic_square, pic FROM user WHERE uid="+response.authResponse.userID
							}, function(rows) {
								priv.registerInfo = {
									username: rows[0].username,
									firstName: rows[0].first_name,
									lastName: rows[0].last_name,
									pic_square: rows[0].pic_square,
									pic: rows[0].pic
								};
								$('#Users_login_identifier').val(rows[0].email).closest('form').submit();
								// The login onSuccess callback is about to be called
							});
						}, perms ? {scope: perms} : undefined);
					});
					return false;
				});
				step1_usingProviders_div.append(Q.text.Users.login.usingOther).append(facebookLogin);
				// Load the facebook script now, so clicking on the facebook button
				// can trigger a popup directly, otherwise popup blockers may complain:
				Q.addScript('http://connect.facebook.net/en_US/all.js');
				break;
		}
	}
	if (providerCount) {
		step1_div.append(step1_usingProviders_div);
	}

	$('input', step1_form).add('select', step1_form).on('input', function () {
		if (step1_form.data('validator')) {
			step1_form.data('validator').reset($(this));
		}
	});
	
	var dialog = $('<div id="Users_login_dialog" class="Users_login_dialog" />');
	var titleSlot = $('<div class="title_slot" />');
	titleSlot.append($('<h2 class="Users_dialog_title Q_dialog_title" />').html(Q.text.Users.login.title));
	var dialogSlot = $('<div class="dialog_slot Q_dialog_content">');
	dialogSlot.append(step1_div).append(step2_div);
	dialog.append(titleSlot).append(dialogSlot).appendTo($(dialogContainer));
	dialog.plugin('Q/dialog', {
		alignByParent: true,
		mask: true,
		beforeLoad: function()
		{
			$('#Users_login_step1').css('opacity', 1).nextAll().hide();
			$('input', dialog).val('');
		},
		onActivate: function()
		{
			dialog.plugin('Q/placeholders');
			$('input', dialog).eq(0).val('').plugin('Q/clickfocus');
		},
		onClose: function()
		{
			$('#Users_login_step1 .Q_button').removeAttr('disabled');
			$('form', dialog).each(function() {
				var v = $(this).data('validator');
				if (v) v.reset();
			});
			$('#Users_login_step1').nextAll().hide();
			if (!priv.login_connected && priv.login_onCancel) {
				priv.login_onCancel();
			}
		}
	});
	
	login_setupDialog.dialog = dialog;

	function hideForm2() {
		if ($('#Users_login_step1').next().is(':visible')) {
			$('#Users_login_step1').animate({"opacity": 1}, 'fast');
			$('#Users_login_step1 *').removeAttr('disabled');
		}
		priv.registerInfo = null;
		$('#Users_login_step1').nextAll().slideUp('fast').each(function() {
			var v = $('form', $(this)).data('validator');
			if (v) {
				v.reset();
			}
		});
		if ($('#Users_login_usingProviders').css('display') === 'none') {
			$('#Users_login_usingProviders').css({opacity: 0}).show()
				.animate({opacity: 1}, 'fast');
		}
	}
}

function setIdentifier_callback(err, response) {
	var identifier_input = $('#Users_setIdentifier_identifier');
	var form = $('#Users_setIdentifier_step1_form');
	identifier_input.css('background-image', 'none');

	var msg = Q.firstErrorMessage(err);
	if (msg) {
		return alert(msg);
	}
	if (response.errors) {
		// There were errors
		form.data('validator').invalidate(Q.ajaxErrors(response.errors, 'identifier'));
		identifier_input.plugin('Q/clickfocus');
		return;
	}

	// Remove any errors we may have displayed
	form.data('validator').reset();

	setIdentifier_setupDialog.dialog.data('Q/dialog').close();
}

function setIdentifier_setupDialog(identifierType) {
	if (setIdentifier_setupDialog.dialog) {
		return;
	}

	var placeholder = Q.text.Users.setIdentifier.placeholders.identifier;
	var type = 'email';
	var parts = identifierType ? identifierType.split(',') : [];
	if (parts.length === 1) {
		if (parts[0] == 'email') {
			type = 'email';
			placeholder = Q.text.Users.setIdentifier.placeholders.email;
		} else if (parts[0] == 'mobile') {
			type = 'tel';
			placeholder = Q.text.Users.setIdentifier.placeholders.mobile;
		}
	}
	
	var step1_form = $('<form id="Users_setIdentifier_step1_form" />');
	var step1_div = $('<div id="Users_setIdentifier_step1" class="Q_big_prompt" />').html(step1_form);

	step1_form.empty().append(
		$('<input id="Users_setIdentifier_identifier" type="email" name="identifier" class="text" />')
		.attr('maxlength', Q.text.Users.login.maxlengths.identifier)
		.attr('placeholder', placeholder)
	).append(
		$('<input id="Users_setIdentifier_type" type="hidden" name="identifierType" />').val(identifierType)
	).append(
		$('<div class="Q_buttons"/>').html(
			$('<button type="submit" class="Q_button Users_setIdentifier_go Q_main_button" />').html(
				Q.text.Users.setIdentifier.sendMessage
			)
		)
	).submit(function(event) {
		$('#Users_setIdentifier_identifier').css({
			'background-image': 'url(' + Q.url('plugins/Q/img/throbbers/loading.gif') + ')',
			'background-repeat': 'no-repeat'
		});
		var url = Q.action('Users/identifier') + '?' + $(this).serialize();
		Q.request(url, 'data', setIdentifier_callback, {"method": "post"});
		event.preventDefault();
		return;
	});
	step1_form.validator();
	
	var dialog = $('<div id="Users_setIdentifier_dialog" class="Users_setIdentifier_dialog" />');
	var titleSlot = $('<div class="title_slot">').append(
		$('<h2 class="Users_dialog_title Q_dialog_title" />').html(Q.text.Users.setIdentifier.title)
	);
	var dialogSlot = $('<div class="dialog_slot Q_dialog_content">').append(step1_div);
	dialog.append(titleSlot).append(dialogSlot).appendTo(document.body);
	dialog.plugin('Q/dialog', {
		alignByParent: true,
		mask: true,
		beforeLoad: function()
		{
			$('input', dialog).val('');
		},
		onActivate: function()
		{
			dialog.plugin('Q/placeholders');
			$('input', dialog).eq(0).val('').plugin('Q/clickfocus');
		},
		onClose: function()
		{
			$('form', dialog).each(function() {
				var v = $(this).data('validator');
				if (v) {
					v.reset();
				}
			});
			if (priv.setIdentifier_onCancel) {
				priv.setIdentifier_onCancel();
			}
		}
	});
	
	setIdentifier_setupDialog.dialog = dialog;
}

function submitClosestForm () {
	$(this).closest('form').submit();
	return false;
}

/**
 * Makes a dialog that looks closely to facebook standard.
 * @param options Object
 *   A hash of options, that can include:
 *   "title": Required. Dialog title.
 *   "content": Required. Dialog content, can be plain text or some html.
 *   "buttons": Required. Array of object containing fields:
 *      'label' is the label of the button,
 *      'handler' is a click handler for the button, and
 *      'default' is a boolean which makes this button styled as default.
 *   "position": Optional. Hash of x/y coordinates. By default (or if null) dialog is centered on the screen.
 *   "shadow": Optional. Whether to make a full screen shadow behind the dialog, making other elements on the page inaccessible.
 *   Default is false.
 */
Users.facebookDialog = function(options)
{
	$('.Users_facebookDialog').remove();
	$('.Users_facebookDialog_shadow').remove();

	var o = $.extend({
		'position': null,
		'shadow': false,
		'title': 'Needs a title',
		'content': 'Needs content',
		'buttons': {}
	}, options);
	
	if (!Q.isPlainObject(o.buttons)) {
		return alert("Please provide a plain object for Users.facebookDialog buttons");
	}
	if (o.shadow) {
		var shadow = $('<div class="Users_facebookDialog_shadow" />');
		$('body').append(shadow);
	}
	var dialog = $('<div class="Users_facebookDialog">' +
		'<div class="Users_facebookDialog_title">' + o.title + '</div>' +
		'<div class="Users_facebookDialog_content">' + o.content + '</div>' +
		'</div>');
	var buttonsBlock = $('<div class="Users_facebookDialog_buttons" />');
	Q.each(o.buttons, function (k, b) {
		function _buttonHandler(handler) {
			return function() {
				if (handler) {
					handler(dialog);
				} else {
					alert("Users.facebookDialog has no click handler for this button");
					dialog.close();
				}
			};
		}
		var button = $('<button />')
			.html(b.label || 'Needs a label')
			.click(_buttonHandler(b.handler))
			.appendTo(buttonsBlock);
		if (b['default']) {
			button.addClass('Q_button Users_facebookDialog_default_button');
		}
	});
	dialog.append(buttonsBlock);
	$('body').append(dialog);
	if (o.position) {
		dialog.css({ 
			left: o.position.x + 'px', 
			top: o.position.y + 'px'
		});
	} else {
		dialog.css({ 
			left: (($(window).width() - dialog.width()) / 2) + 'px',
			top: (($(window).height() - dialog.height()) / 2) + 'px'
		});
	}
	dialog.show();

	dialog.close = function() {
		dialog.remove();
		if (typeof(shadow) != 'undefined') {
			shadow.remove();
		}
	};
};

Q.Tool.define({
    "Users/avatar": "plugins/Users/js/tools/avatar.js",
	"Users/status": "plugins/Users/js/tools/status.js",
	"Users/friendSelector": "plugins/Users/js/tools/friendSelector.js",
	"Users/getintouch": "plugins/Users/js/tools/getintouch.js"
});

Q.onInit.add(function () {
	if (Q.Users.loggedInUser
	&& Q.typeOf(Q.Users.loggedInUser) !== 'Q.Users.User') {
	    Q.Users.loggedInUser = new Users.User(Q.Users.loggedInUser);
		Q.nonce = Q.cookie('Q_nonce');
	}
	document.documentElement.className += Users.loggedInUser ? ' Users_loggedIn' : ' Users_loggedOut';
    
	if (Q.plugins.Users.facebookApps[Q.info.app]
	&& Q.plugins.Users.facebookApps[Q.info.app].appId) {
		Users.initFacebook();
	}
	
	Q.Users.login.options = Q.extend({
		'onCancel': new Q.Event(),
		'onSuccess': new Q.Event(function (user) {
			// default implementation
			if (user) {
				// the user changed, redirect to their home page
				var urls = Q.urls || {};
				var url = Q.Users.login.options.homeUrl || urls[Q.info.app+'/home'] || Q.url('');
				Q.handle(url);
			}
		}, 'Users.login'),
		'onRequireComplete': new Q.Event(),
		"accountStatusUrl": null,
		'tryQuietly': false,
		'using': 'native', // can also be 'facebook'
		'perms': 'email,publish_stream', // the permissions to ask for on facebook
		'linkToken': null,
		'dialogContainer': 'body',
		'setupRegisterForm': null,
		'identifierType': 'email,mobile',
		'activation': 'activation'
	}, Q.Users.login.options, Q.Users.login.serverOptions);

	Q.Users.logout.options = Q.extend({
		'url': Q.action('Users/logout'),
		'using': 'native',
		'onSuccess': new Q.Event(function () {
			var urls = Q.urls || {};
			Q.handle( Q.Users.login.options.welcomeUrl || urls[Q.info.app+'/welcome'] || Q.url(''));
		}, 'Users.logout')
	}, Q.Users.logout.options, Q.Users.logout.serverOptions);

	Q.Users.setIdentifier.options = Q.extend({
		'onCancel': null,
		'onSuccess': null, // gets passed session
		'identifierType': 'email,mobile'
	}, Q.Users.setIdentifier.options, Q.Users.setIdentifier.serverOptions);
	
	Q.Users.prompt.options = Q.extend({
		'dialogContainer': document.body
	}, Q.Users.prompt.options, Q.Users.prompt.serverOptions);
}, 'Users');

Q.onReady.set(function Users_Q_onReady_handler() {
	$.fn.plugin.load('Q/dialog');
	$.fn.plugin.load('Q/placeholders');
}, 'Users');

Q.beforeActivate.add(function (elem) {
	// Every time before anything is activated,
	// process any preloaded users data we find
	Q.each(Users.User.preloaded, function (i, fields) {
		_constructUser(fields);
	});
	Users.preloaded = null;
}, 'Users');

Users.onInitFacebook = new Q.Event();
Users.onLogin = new Q.Event(function () {
	document.documentElement.className.replace(' Users_loggedOut', '');
	document.documentElement.className += ' Users_loggedIn';
}, 'Users');
Users.onLogout = new Q.Event(function () {
	document.documentElement.className.replace(' Users_loggedIn', '');
	document.documentElement.className += ' Users_loggedOut';
});

})(Q, jQuery);
