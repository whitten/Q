<?php

/**
 * Override Q/noModule handler.
 * just goes on to render our app's response,
 * which will echo a 404 view.
 */
function Q_noModule($params)
{
	if (!Q_Request::accepts('text/fbml')) {
		header("HTTP/1.0 404 Not Found");
	}
	Q_Dispatcher::uri()->module = Q_Config::expect('Q', 'app');
	Q_Dispatcher::uri()->action = 'notFound';
	Q::event('Q/response', $params);
}
