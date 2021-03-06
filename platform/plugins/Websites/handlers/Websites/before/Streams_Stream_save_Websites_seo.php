<?php

function Websites_before_Streams_Stream_save_Websites_seo($params)
{
	$stream = $params['stream'];
	if (!$stream->wasModified('attributes')) return;

	$uri = $stream->getAttribute('uri', null);
	if (!$uri) return;
	
	$wp = new Websites_Permalink();
	$wp->uri = $uri;
	$wp->retrieve('*', false, true)->ignoreCache()->resume();
	
	if ($url = $stream->getAttribute('url', null)) {
		$url = Q_Html::themedUrl($url);
		if (!isset($wp->url) or $wp->url !== $url) {
			$wp->url = $url;
			$wp->save();
		}
	} else {
		$wp->remove();
	}
}