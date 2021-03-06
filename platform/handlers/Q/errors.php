<?php

/**
 * The default implementation.
 */
function Q_errors($params) {
	extract($params);
	/**
	 * @var Exception $exception
	 * @var boolean $response_started
	 */

	if (!empty($exception)) {
		Q_Response::addError($exception);
	}
	$errors = Q_Response::getErrors();

	$errors_array = Q_Exception::toArray($errors);

	// Simply return the errors, if this was an AJAX request
	if ($is_ajax = Q_Request::isAjax()) {
		switch (strtolower($is_ajax)) {
		case 'json':
		default:
			$errors_json = @Q::json_encode($errors_array);
			$json = "{\"errors\": $errors_json}";
			$callback = Q_Request::callback();
			header("Content-type: " . ($callback ? "application/javascript" : "application/json"));
			echo $callback ? "$callback($json)" : $json;
		}
		return;
	}

	// Forward internally, if it was requested
	if (Q_Request::special('onErrors', null)) {
		$uri = Q_Dispatcher::uri();
		$uri2 = Q_Uri::from(Q_Request::special($snf, null));
		if ($uri !== $uri2) {
			Q_Dispatcher::forward($uri2);
			return; // we don't really need this, but it's here anyway
		}
	}
	
	$params2 = compact('errors', 'exception', 'errors_array', 'exception_array');
	
	if (Q::eventStack('Q/response')) {
		// Errors happened while rendering response. Just render errors view.
		return Q::view('Q/errors.php', $params2);
	}

	if (!$response_started) {
		try {
			// Try rendering the response, expecting it to
			// display the errors along with the rest.
			$ob = new Q_OutputBuffer();
			Q::event('Q/response', $params2);
			$ob->endFlush();
			return;
		} catch (Exception $e) {
			if (get_class($e) === 'Q_Exception_DispatcherForward') {
				throw $e; // if forwarding was requested, do it
				// for all other errors, continue trying other things
			}
			$output = $ob->getClean();
		}
	}
	if ($errors) {
		// Try rendering the app's errors response, if any.
		$app = Q_Config::expect('Q', 'app');
		Q_Dispatcher::forward("$app/errors");
	}
	if (!empty($e)) {
		return Q::event('Q/exception', array('exception' => $e));
	}
}
